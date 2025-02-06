import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/v135/@langchain/openai@0.3.5";
import {
    AssistantResponse,
    CallbackHandlerConfig,
    ChatHistory,
    CritiqueStepInput,
    FollowUp,
    QdrantDocument,
    QuestionEvaluationType,
    QuickAssistantResponse,
    ResponseStepInput,
    SearchContextInput,
    SearchResult,
} from "../types/index.ts";
import {
    CallbackHandler,
    Langfuse,
} from "https://esm.sh/v135/langfuse-langchain@3.29.1";
import { LangfuseTraceClient } from "https://esm.sh/v135/langfuse-core@3.29.1/lib/index.d.mts";
import {
    answerPrompt,
    AnswerSchema,
    contextPrompt,
    ContextSchema,
    critiquePrompt,
    CritiqueSchema,
    questionEvalPrompt,
    QuestionEvalSchema,
    questionExtractPrompt,
    QuestionExtractSchema,
    quickAnswerPrompt,
    QuickAnswerSchema,
    rerankPrompt,
    RerankSchema,
} from "../prompts/index.ts";
import { ChatGoogleGenerativeAI } from "https://esm.sh/v135/@langchain/google-genai@0.1.8";
import {
    getImprovementSuggestions,
    getSearchHistory,
    getUniqueDocuments,
} from "../helpers/helpers.ts";

class AIAssistant {
    public parentTrace: LangfuseTraceClient;
    public questionType: string | undefined;

    private openai: ChatOpenAI;
    private gemini: ChatGoogleGenerativeAI;
    private qdrantVectorDB: QDrantVectorDB;
    private maxSearchIterations: number;
    private callbackHandlerConfig: CallbackHandlerConfig;
    private sessionId: string;
    private langfuse: Langfuse;
    private question: string;
    private chatHistory: ChatHistory[];

    constructor(question: string, history: ChatHistory[]) {
        this.question = question;
        this.chatHistory = history;
        this.langfuse = new Langfuse();
        this.sessionId = `${Date.now()}-${
            Math.random().toString(36).substring(2, 9)
        }`;
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
            maxTokens: 4000,
            temperature: 0.5,
        });
        this.gemini = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            temperature: 0.5,
        });
        this.qdrantVectorDB = new QDrantVectorDB();
        this.maxSearchIterations = 2;
        this.parentTrace = this.langfuse.trace({
            sessionId: this.sessionId,
            name: question.replace(/\s/g, "-"),
            input: question,
        });
        this.callbackHandlerConfig = {
            sessionId: this.sessionId,
            root: this.parentTrace,
        };
    }

    async askQuestion(): Promise<{
        responsePromise: Promise<AssistantResponse | null>;
        quickResponsePromise: Promise<QuickAssistantResponse>;
    }> {
        try {
            this.questionType = await this.evaluateQuestion(
                this.question,
                this.chatHistory,
            );
            let quickResponsePromise;
            let responsePromise;
            switch (this.questionType) {
                case "question":
                    quickResponsePromise = this.processQuestion(
                        this.question,
                        this.chatHistory,
                        this.questionType,
                    );
                    responsePromise = this.processQuestionWithContext(
                        this.sessionId,
                        this.question,
                        this.chatHistory,
                    );
                    break;
                case "casual":
                case "attack":
                case "nonsense":
                    quickResponsePromise = this.processQuestion(
                        this.question,
                        this.chatHistory,
                        this.questionType,
                    );
                    responsePromise = Promise.resolve(null);
                    break;
                default:
                    throw new Error(
                        `Invalid question type: ${this.questionType}`,
                    );
            }
            return { quickResponsePromise, responsePromise };
        } catch (error) {
            const response = {
                answer:
                    "Przepraszam. Wystąpił błąd podczas przetwarzania pytania.",
                questionType: "casual",
            } as QuickAssistantResponse;
            this.parentTrace.update({
                output: error,
                name: "error",
            });
            return {
                quickResponsePromise: Promise.resolve(response),
                responsePromise: Promise.resolve(null),
            };
        }
    }

    private async evaluateQuestion(
        question: string,
        chatHistory: ChatHistory[] = [],
    ): Promise<QuestionEvaluationType> {
        const structuredModel = this.gemini.withStructuredOutput(
            QuestionEvalSchema,
            { name: "QuestionEvalSchema" },
        );
        const formattedPrompt = await questionEvalPrompt.formatMessages({
            chatHistory: chatHistory.length > 0 ? chatHistory : "Brak historii",
            question,
        });

        const response = await structuredModel.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });
        console.log(response);

        const availableFormats: QuestionEvaluationType[] = [
            "question",
            "casual",
            "attack",
            "nonsense",
        ];
        if (!availableFormats.includes(response.questionType)) {
            throw new Error(
                `Invalid request type: ${response.questionType}`,
            );
        }
        return response.questionType;
    }

    private async processQuestion(
        question: string,
        chatHistory: ChatHistory[],
        questionType: string,
    ) {
        const structuredModel = this.gemini.withStructuredOutput(
            QuickAnswerSchema,
            { name: "QuickAnswerSchema" },
        );
        const formattedPrompt = await quickAnswerPrompt.formatMessages({
            question,
            chatHistory: chatHistory.length > 0 ? chatHistory : "Brak historii",
            questionType,
        });
        const quickAnswerResponse = await structuredModel.invoke(
            formattedPrompt,
            {
                callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
            },
        );
        console.log(quickAnswerResponse);

        return {
            answer: quickAnswerResponse.answer,
            questionType,
        } as QuickAssistantResponse;
    }

    private async processQuestionWithContext(
        executionId: string,
        originalQuestion: string,
        chatHistory: ChatHistory[],
        searchHistory: string[] = [],
        iteration = 0,
        followUp?: FollowUp,
    ): Promise<AssistantResponse> {
        const questionAsked = await this.extractQuestion(
            originalQuestion,
            chatHistory,
        );

        const context = await this.getContext({
            originalQuestion: questionAsked,
            followUp,
            searchHistory,
        });

        const response = await this.getResponse({
            originalQuestion: questionAsked,
            searchResult: context,
        });

        const critique = await this.getCritique({
            originalQuestion: questionAsked,
            response,
            searchResult: context,
        });

        if (
            (response.needsMoreContext && !critique.didAnswerTheQuestion) &&
            iteration < this.maxSearchIterations
        ) {
            return this.processQuestionWithContext(
                executionId,
                questionAsked,
                chatHistory,
                searchHistory,
                iteration + 1,
                {
                    previousAnswer: response.answer,
                    improvementSuggestions: critique.improvementSuggestions,
                },
            );
        }
        const wholeResponse = {
            answer: response.answer,
            _thinking: response._thinking,
            critique: critique.critique,
            didAnswerTheQuestion: critique.didAnswerTheQuestion,
            needsMoreContext: response.needsMoreContext,
            improvementSuggestions: critique.improvementSuggestions,
            urls: Array.from(
                new Set(context.context.map((doc) => doc.payload.url)),
            ),
        };

        return wholeResponse;
    }

    private async extractQuestion(
        originalQuestion: string,
        chatHistory: ChatHistory[],
    ): Promise<string> {
        const structuredModel = this.gemini.withStructuredOutput(
            QuestionExtractSchema,
            { name: "QuestionExtractSchema" },
        );
        const formattedPrompt = await questionExtractPrompt.formatMessages({
            question: originalQuestion,
            chatHistory,
        });
        const response = await structuredModel.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });

        return response.question;
    }

    private async getContext(
        input: SearchContextInput,
    ): Promise<SearchResult> {
        let dbResults: QdrantDocument[] = [];

        const getContextSpan = this.parentTrace.span({
            name: "Context Retrieval",
            input: [],
        });
        let ragInput;

        try {
            const searchVectorDBSpan = getContextSpan.span({
                name: "Search Vector DB",
                input: input,
            });

            if (input.followUp) {
                const structuredModel = this.gemini.withStructuredOutput(
                    ContextSchema,
                    { name: "ContextSchema" },
                );
                const formattedPrompt = await contextPrompt.formatMessages({
                    question: input.originalQuestion,
                    improvementSuggestions: getImprovementSuggestions(
                        input?.followUp?.improvementSuggestions,
                    ),
                });
                const response = await structuredModel.invoke(formattedPrompt, {
                    callbacks: [
                        new CallbackHandler({
                            sessionId: this.sessionId,
                            root: getContextSpan,
                        }),
                    ],
                });
                ragInput = response.queries;

                const results = await Promise.all(
                    response.queries.map((query: string) => {
                        input.searchHistory.push(query);
                        return this.qdrantVectorDB.searchStore(query);
                    }),
                );
                dbResults = getUniqueDocuments(results);
            } else {
                ragInput = [input.originalQuestion];
                dbResults = await this.qdrantVectorDB.searchStore(
                    input.originalQuestion,
                );
            }
            getContextSpan.update({ input: ragInput });
            searchVectorDBSpan.update({ input: ragInput, output: dbResults });
            searchVectorDBSpan.end();

            const rerankedResults = await this.correctResponses(
                dbResults,
                input.originalQuestion,
            );

            getContextSpan.update({ output: rerankedResults });
            getContextSpan.end();

            return {
                searchHistory: input.searchHistory,
                context: rerankedResults,
            };
        } catch (error) {
            getContextSpan.update({
                output: error,
            });
            getContextSpan.end();
            throw error;
        }
    }

    private async correctResponses(
        qdrantDocuments: QdrantDocument[],
        originalQuestion: string,
    ) {
        const structuredModel = this.gemini.withStructuredOutput(
            RerankSchema,
            { name: "RerankSchema" },
        );
        const formattedPrompts = await Promise.all(
            qdrantDocuments.map((doc) => {
                return rerankPrompt.formatMessages({
                    question: originalQuestion,
                    document: doc,
                });
            }),
        );

        const responses = await Promise.all(
            formattedPrompts.map((prompt) => {
                return structuredModel.invoke(prompt);
            }),
        );

        const filteredDocuments = qdrantDocuments.filter((_, index) => {
            return responses[index].isDocumentUseful;
        });

        return filteredDocuments;
    }

    private async getResponse(input: ResponseStepInput) {
        const structuredModel = this.gemini.withStructuredOutput(
            AnswerSchema,
            { name: "AnswerSchema" },
        );
        const formattedPrompt = await answerPrompt.formatMessages({
            searchHistory: getSearchHistory(input),
            question: input.originalQuestion,
            context: input.searchResult.context,
        });
        const response = await structuredModel.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });
        return response;
    }

    private async getCritique(
        input: CritiqueStepInput,
    ) {
        const structuredModel = this.gemini.withStructuredOutput(
            CritiqueSchema,
            { name: "CritiqueSchema" },
        );
        const formattedPrompt = await critiquePrompt.formatMessages({
            question: input.originalQuestion,
            answer: input.response.answer,
            reasoning: input.response._thinking,
            searchResult: input.searchResult.context,
        });
        const response = await structuredModel.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });

        return response;
    }
}

export default AIAssistant;
