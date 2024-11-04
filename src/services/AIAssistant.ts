import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { RunnableSequence } from "https://esm.sh/v135/@langchain/core@0.3.6/runnables.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { AnswerSchema, CritiqueSchema } from "../schemas/index.ts";
import {
    SequenceInput,
    SearchResult,
    ResponseStepInput,
    AnswerResponse,
    CritiqueStepInput,
    CritiqueResponse,
    AssistantResponse,
    SequenceResult,
} from "../types/index.ts";
import ExecutionLogger from "./ExecutionLogger.ts";

const answerParser = StructuredOutputParser.fromZodSchema(AnswerSchema);
const critiqueParser = StructuredOutputParser.fromZodSchema(CritiqueSchema);

const answerPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Jesteś pomocnym asystentem uniwersyteckim. Użyj poniższego kontekstu, aby odpowiedzieć na pytanie. 
        Jeśli potrzebujesz więcej informacji, ustaw needsMoreContext na true, inny asystent pomoże ci później dobrać odpowiednie pytanie do wyszukania.`,
    ],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Historia wyszukiwania: {searchHistory}\nKontekst: {context}\n\nPytanie: {question}"],
]);

const critiquePrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        "Przeanalizuj poniższą odpowiedź pod kątem dokładności, kompletności i potencjalnych ulepszeń. Wyprowadź sugestie, na ich postawie zaproponuj followUpQuery. Historia wyszukiwania pomoże Ci uniknąć powtarzania tych samych zapytań.",
    ],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Pytanie: {question}\nOdpowiedź: {answer}\nUzasadnienie: {reasoning}"],
]);

class AIAssistant {
    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;
    private maxSearchIterations: number;
    private logger: ExecutionLogger;

    constructor() {
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
        });
        this.qdrantVectorDB = new QDrantVectorDB();
        this.maxSearchIterations = 3;
        this.logger = new ExecutionLogger();
    }

    private getContextStep(executionId: string): {
        searchResult: (input: SequenceInput) => Promise<SearchResult>;
        originalQuestion: (input: SequenceInput) => string;
    } {
        return {
            searchResult: (input: SequenceInput) => {
                return this.logger.logStep(executionId, "get_context", { input }, async () => {
                    const query = input.followUpQuery || input.originalQuestion;
                    input.searchHistory.push(query);
                    const context = await this.qdrantVectorDB.searchStore(query);
                    const contextAsString = JSON.stringify(context);
                    return {
                        searchHistory: input.searchHistory,
                        context: contextAsString,
                    };
                });
            },
            originalQuestion: (input: SequenceInput) => input.originalQuestion,
        };
    }

    private getResponseStep(executionId: string): {
        response: (input: ResponseStepInput) => Promise<AnswerResponse>;
        originalQuestion: (input: ResponseStepInput) => string;
    } {
        return {
            response: (input: ResponseStepInput) => {
                return this.logger.logStep(executionId, "generate_response", { input }, async () => {
                    const formattedPrompt = await answerPrompt.formatMessages({
                        format: answerParser.getFormatInstructions(),
                        searchHistory: "Próbowałem wyszukać już: " + (input.searchResult?.searchHistory?.join(", ") || "Brak"),
                        question: input.originalQuestion,
                        context: input.searchResult.context,
                    });

                    const response = await this.openai.invoke(formattedPrompt);
                    return await answerParser.parse(response.content as string);
                });
            },
            originalQuestion: (input: ResponseStepInput) => input.originalQuestion,
        };
    }

    private getCritiqueStep(executionId: string): {
        critique: (input: CritiqueStepInput) => Promise<CritiqueResponse>;
        response: (input: CritiqueStepInput) => AnswerResponse;
    } {
        return {
            critique: (input: CritiqueStepInput): Promise<CritiqueResponse> => {
                return this.logger.logStep(executionId, "generate_critique", { input }, async () => {
                    const formattedPrompt = await critiquePrompt.formatMessages({
                        format: critiqueParser.getFormatInstructions(),
                        question: input.originalQuestion,
                        answer: input.response.answer,
                        reasoning: input.response.reasoning,
                    });

                    const response = await this.openai.invoke(formattedPrompt);
                    return await critiqueParser.parse(response.content as string);
                });
            },
            response: (input: CritiqueStepInput) => input.response,
        };
    }

    private createAnswerChain(executionId: string): RunnableSequence<SequenceInput, AssistantResponse> {
        return RunnableSequence.from([
            this.getContextStep(executionId),
            this.getResponseStep(executionId),
            this.getCritiqueStep(executionId),
            (result: SequenceResult): AssistantResponse => ({
                answer: result.response.answer,
                reasoning: result.response.reasoning,
                critique: result.critique.critique,
                confidence: result.critique.confidence,
                needsMoreContext: result.response.needsMoreContext,
                followUpQuery: result.critique.followUpQuery,
                improvement_suggestions: result.critique.improvement_suggestions,
            }),
        ]);
    }

    private async processQuestionWithContext(
        executionId: string,
        originalQuestion: string,
        searchHistory: string[] = [],
        iteration = 0,
        followUpQuery?: string
    ): Promise<AssistantResponse> {
        const chain = this.createAnswerChain(executionId);
        const response = await chain.invoke({
            originalQuestion,
            followUpQuery,
            searchHistory,
        });

        if (response.needsMoreContext && response.followUpQuery && iteration < this.maxSearchIterations) {
            return this.processQuestionWithContext(executionId, originalQuestion, searchHistory, iteration + 1, response.followUpQuery);
        }

        return response;
    }

    async askQuestion(question: string): Promise<AssistantResponse> {
        const executionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.logger.startExecution(executionId, question);

        try {
            const response = await this.processQuestionWithContext(executionId, question);
            this.logger.endExecution(executionId, response);
            return response;
        } catch (error) {
            this.logger.endExecution(executionId, undefined, error as Error);
            throw error;
        }
    }
}

export default AIAssistant;
