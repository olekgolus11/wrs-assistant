import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import {
    AssistantResponse,
    CallbackHandlerConfig,
    CritiqueStepInput,
    FollowUp,
    QdrantDocument,
    QuestionEvaluationType,
    QuickAssistantResponse,
    ResponseStepInput,
    SearchResult,
    SequenceInput,
} from "../types/index.ts";
import {
    CallbackHandler,
    Langfuse,
} from "https://esm.sh/langfuse-langchain@3.29.1";
import { LangfuseTraceClient } from "https://esm.sh/v135/langfuse-core@3.29.1/lib/index.d.mts";
import {
    answerParser,
    answerPrompt,
    contextParser,
    contextPrompt,
    critiqueParser,
    critiquePrompt,
    questionEvalParser,
    questionEvalPrompt,
    quickAnswerParser,
    quickAnswerPrompt,
    rerankParser,
    rerankPrompt,
} from "../prompts/index.ts";

class AIAssistant {
    public parentTrace: LangfuseTraceClient;
    public questionType: string | undefined;

    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;
    private maxSearchIterations: number;
    private callbackHandlerConfig: CallbackHandlerConfig;
    private sessionId: string;
    private langfuse: Langfuse;
    private question: string;

    constructor(question: string) {
        this.question = question;
        this.langfuse = new Langfuse();
        this.sessionId = `${Date.now()}-${
            Math.random().toString(36).substring(2, 9)
        }`;
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
            maxTokens: 4000,
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
            this.questionType = await this.evaluateQuestion(this.question);
            let quickResponsePromise;
            let responsePromise;
            switch (this.questionType) {
                case "question":
                    quickResponsePromise = this.processQuestion(
                        this.question,
                        this.questionType,
                    );
                    responsePromise = this.processQuestionWithContext(
                        this.sessionId,
                        this.question,
                    );
                    break;
                case "casual":
                case "attack":
                case "nonsense":
                    quickResponsePromise = this.processQuestion(
                        this.question,
                        this.questionType,
                    );
                    responsePromise = new Promise<null>((
                        resolve,
                    ) => resolve(null));
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
                quickResponsePromise: new Promise((resolve) =>
                    resolve(response)
                ),
                responsePromise: new Promise((resolve) => resolve(null)),
            };
        }
    }

    private async evaluateQuestion(
        question: string,
    ): Promise<QuestionEvaluationType> {
        const formattedPrompt = await questionEvalPrompt.formatMessages({
            format: questionEvalParser.getFormatInstructions(),
            question,
        });

        const response = await this.openai.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });
        const parsedResponse = await questionEvalParser.parse(
            response.content as string,
        );

        const availableFormats: QuestionEvaluationType[] = [
            "question",
            "casual",
            "attack",
            "nonsense",
        ];
        if (!availableFormats.includes(parsedResponse.questionType)) {
            throw new Error(
                `Invalid request type: ${parsedResponse.questionType}`,
            );
        }
        return parsedResponse.questionType;
    }

    private async processQuestion(
        question: string,
        questionType: string,
    ) {
        const formattedPrompt = await quickAnswerPrompt.formatMessages({
            format: quickAnswerParser.getFormatInstructions(),
            question,
            questionType,
        });
        const quickAnswerResponse = await this.openai.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });
        const parsedResponse = await quickAnswerParser.parse(
            quickAnswerResponse.content as string,
        );

        return {
            answer: parsedResponse.answer,
            questionType,
        } as QuickAssistantResponse;
    }

    private async processQuestionWithContext(
        executionId: string,
        originalQuestion: string,
        searchHistory: string[] = [],
        iteration = 0,
        followUp?: FollowUp,
    ): Promise<AssistantResponse> {
        const context = await this.getContext({
            originalQuestion,
            followUp,
            searchHistory,
        });

        const response = await this.getResponse({
            originalQuestion,
            searchResult: context,
        });

        const critique = await this.getCritique({
            originalQuestion,
            response,
            searchResult: context,
        });

        if (
            (response.needsMoreContext && !critique.didAnswerTheQuestion) &&
            iteration < this.maxSearchIterations
        ) {
            return this.processQuestionWithContext(
                executionId,
                originalQuestion,
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
            confidence: critique.confidence,
            didAnswerTheQuestion: critique.didAnswerTheQuestion,
            needsMoreContext: response.needsMoreContext,
            improvementSuggestions: critique.improvementSuggestions,
            urls: context.context.map((doc) => doc.payload.url),
        };

        return wholeResponse;
    }

    private async getContext(
        input: SequenceInput,
    ): Promise<SearchResult> {
        let dbResults: QdrantDocument[] = [];

        const ragSpan = this.parentTrace.span({
            name: "Context Retrieval",
            input: [],
        });

        try {
            const searchVectorDBSpan = ragSpan.span({
                name: "Search Vector DB",
                input: input,
            });
            if (input.followUp) {
                const formattedPrompt = await contextPrompt.formatMessages({
                    format: contextParser.getFormatInstructions(),
                    question: input.originalQuestion,
                    improvementSuggestions:
                        input?.followUp?.improvementSuggestions?.join(", ") ||
                        "Brak sugestii",
                });
                const response = await this.openai.invoke(formattedPrompt, {
                    callbacks: [
                        new CallbackHandler(this.callbackHandlerConfig),
                    ],
                });
                const parsedResponse = await contextParser.parse(
                    response.content as string,
                );

                ragSpan.update({ input: parsedResponse.queries });
                searchVectorDBSpan.update({ input: parsedResponse.queries });

                const results = await Promise.all(
                    parsedResponse.queries.map((query: string) => {
                        input.searchHistory.push(query);
                        return this.qdrantVectorDB.searchStore(query);
                    }),
                );
                dbResults = results.flat();
                // delete duplicates by ids
                const uniqueResults = new Map<string, QdrantDocument>();
                dbResults.forEach((doc) => {
                    uniqueResults.set(doc.id, doc);
                });
                dbResults = Array.from(uniqueResults.values());
            } else {
                ragSpan.update({ input: [input.originalQuestion] });
                dbResults = await this.qdrantVectorDB.searchStore(
                    input.originalQuestion,
                );
            }
            searchVectorDBSpan.update({ output: dbResults });
            searchVectorDBSpan.end();

            const rerankedResults = await this.rerankResponses(
                dbResults,
                input.originalQuestion,
            );

            ragSpan.update({ output: rerankedResults });
            ragSpan.end();

            return {
                searchHistory: input.searchHistory,
                context: rerankedResults,
            };
        } catch (error) {
            ragSpan.update({
                output: error,
            });
            ragSpan.end();
            throw error;
        }
    }

    private async rerankResponses(
        qdrantDocuments: QdrantDocument[],
        originalQuestion: string,
    ) {
        const formattedPrompts = await Promise.all(
            qdrantDocuments.map((doc) => {
                return rerankPrompt.formatMessages({
                    format: rerankParser.getFormatInstructions(),
                    question: originalQuestion,
                    document: doc,
                });
            }),
        );

        const responses = await Promise.all(
            formattedPrompts.map((prompt) => {
                return this.openai.invoke(prompt);
            }),
        );

        const parsedResponses = await Promise.all(
            responses.map((response) => {
                return rerankParser.parse(response.content as string);
            }),
        );

        const filteredDocuments = qdrantDocuments.filter((_, index) => {
            return parsedResponses[index].isDocumentUseful;
        });

        return filteredDocuments;
    }

    private async getResponse(input: ResponseStepInput) {
        const formattedPrompt = await answerPrompt.formatMessages({
            format: answerParser.getFormatInstructions(),
            searchHistory: "Próbowałem wyszukać już: " +
                (input.searchResult?.searchHistory?.join(", ") ||
                    "Jeszcze niczego nie wyszukiwałem") +
                (input.followUp?.previousAnswer
                    ? `Warto zaznaczyć, że ostatnio odpowiedziałem tak: ${input?.followUp?.previousAnswer}, ale poproszono mnie o więcej informacji.`
                    : ""),
            question: input.originalQuestion,
            context: input.searchResult.context,
        });
        const response = await this.openai.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler(this.callbackHandlerConfig)],
        });
        const parsedResponse = await answerParser.parse(
            response.content as string,
        );
        return parsedResponse;
    }

    private async getCritique(
        input: CritiqueStepInput,
    ) {
        const formattedPrompt = await critiquePrompt.formatMessages({
            format: critiqueParser.getFormatInstructions(),
            question: input.originalQuestion,
            answer: input.response.answer,
            reasoning: input.response._thinking,
            searchResult: input.searchResult.context,
        });
        const response = await this.openai.invoke(formattedPrompt, {
            callbacks: [new CallbackHandler({ ...this.callbackHandlerConfig })],
        });
        const parsedResponse = await critiqueParser.parse(
            response.content as string,
        );

        return parsedResponse;
    }
}

export default AIAssistant;
