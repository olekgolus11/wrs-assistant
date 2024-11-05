import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { AnswerSchema, CritiqueSchema } from "../schemas/index.ts";
import { SequenceInput, ResponseStepInput, CritiqueStepInput, AssistantResponse } from "../types/index.ts";
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

    private async getContextStep(executionId: string, input: SequenceInput) {
        const query = input.followUpQuery || input.originalQuestion;
        input.searchHistory.push(query);
        const context = await this.qdrantVectorDB.searchStore(query);
        const contextAsString = JSON.stringify(context);

        this.logger.logStep(executionId, "getContextStep", input, context);

        return {
            searchHistory: input.searchHistory,
            context: contextAsString,
        };
    }

    private async getResponseStep(executionId: string, input: ResponseStepInput) {
        const formattedPrompt = await answerPrompt.formatMessages({
            format: answerParser.getFormatInstructions(),
            searchHistory: "Próbowałem wyszukać już: " + (input.searchResult?.searchHistory?.join(", ") || "Brak"),
            question: input.originalQuestion,
            context: input.searchResult.context,
        });
        const response = await this.openai.invoke(formattedPrompt);
        const parsedResponse = await answerParser.parse(response.content as string);

        this.logger.logStep(executionId, "getResponseStep", input, parsedResponse);

        return parsedResponse;
    }

    private async getCritiqueStep(executionId: string, input: CritiqueStepInput) {
        const formattedPrompt = await critiquePrompt.formatMessages({
            format: critiqueParser.getFormatInstructions(),
            question: input.originalQuestion,
            answer: input.response.answer,
            reasoning: input.response.reasoning,
        });
        const response = await this.openai.invoke(formattedPrompt);
        const parsedResponse = await critiqueParser.parse(response.content as string);

        this.logger.logStep(executionId, "getCritiqueStep", input, parsedResponse);

        return parsedResponse;
    }

    private async processQuestionWithContext(
        executionId: string,
        originalQuestion: string,
        searchHistory: string[] = [],
        iteration = 0,
        followUpQuery?: string
    ): Promise<AssistantResponse> {
        const context = await this.getContextStep(executionId, {
            originalQuestion,
            followUpQuery,
            searchHistory,
        });

        const response = await this.getResponseStep(executionId, {
            originalQuestion,
            searchResult: context,
        });

        const critique = await this.getCritiqueStep(executionId, {
            originalQuestion,
            response,
        });

        if (response.needsMoreContext && critique.followUpQuery && iteration < this.maxSearchIterations) {
            return this.processQuestionWithContext(executionId, originalQuestion, searchHistory, iteration + 1, critique.followUpQuery);
        }

        return {
            answer: response.answer,
            reasoning: response.reasoning,
            critique: critique.critique,
            confidence: critique.confidence,
            needsMoreContext: response.needsMoreContext,
            followUpQuery: critique.followUpQuery,
            improvement_suggestions: critique.improvement_suggestions,
        };
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
