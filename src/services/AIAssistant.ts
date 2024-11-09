import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { AnswerSchema, CritiqueSchema } from "../schemas/index.ts";
import { SequenceInput, ResponseStepInput, CritiqueStepInput, AssistantResponse, FollowUp, LangfuseSessionConfig } from "../types/index.ts";
import ExecutionLogger from "./ExecutionLogger.ts";
import { ContextSchema } from "../schemas/ContextSchema.ts";
import { CallbackHandler, Langfuse } from "https://esm.sh/langfuse-langchain@3.29.1";

const contextParser = StructuredOutputParser.fromZodSchema(ContextSchema);
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
        "Przeanalizuj poniższą odpowiedź pod kątem dokładności, kompletności i potencjalnych ulepszeń. Wyprowadź sugestie, na ich postawie zaproponuj followUpQuestion. Historia wyszukiwania pomoże Ci uniknąć powtarzania tych samych zapytań.",
    ],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Pytanie: {question}\nOdpowiedź: {answer}\nUzasadnienie: {reasoning}"],
]);

const contextPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        "Zaproponuj kilka zapytań do bazy wektorowej, które mogą pomóc w znalezieniu odpowiedzi. Jeśli dostępne, skorzytaj z sugestii: {improvementSuggestions}",
    ],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Pytanie: {question}"],
]);

class AIAssistant {
    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;
    private maxSearchIterations: number;
    private logger: ExecutionLogger;
    private langfuseSessionConfig: LangfuseSessionConfig;
    private sessionId: string;

    constructor() {
        const langfuse = new Langfuse();
        this.sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.langfuseSessionConfig = {
            callbacks: [
                new CallbackHandler({
                    sessionId: this.sessionId,
                    root: langfuse.trace(),
                    updateRoot: true,
                }),
            ],
        };

        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
        });
        this.qdrantVectorDB = new QDrantVectorDB();
        this.maxSearchIterations = 3;
        this.logger = new ExecutionLogger();
    }

    private async getContext(executionId: string, input: SequenceInput) {
        const formattedPrompt = await contextPrompt.formatMessages({
            format: contextParser.getFormatInstructions(),
            question: input?.followUp?.followUpQuestion || input.originalQuestion,
            improvementSuggestions: input?.followUp?.improvementSuggestions?.join(", ") || "Brak sugestii",
        });
        const response = await this.openai.invoke(formattedPrompt, this.langfuseSessionConfig);
        const parsedResponse = await contextParser.parse(response.content as string);

        const dbResults = await Promise.all(
            parsedResponse.queries.map((query: string) => {
                input.searchHistory.push(query);
                return this.qdrantVectorDB.searchStore(query);
            })
        );
        const context = JSON.stringify(dbResults);

        this.logger.logStep(executionId, "getContextStep", input, dbResults);

        return {
            searchHistory: input.searchHistory,
            context,
        };
    }

    private async getResponse(executionId: string, input: ResponseStepInput) {
        const formattedPrompt = await answerPrompt.formatMessages({
            format: answerParser.getFormatInstructions(),
            searchHistory:
                "Próbowałem wyszukać już: " +
                (input.searchResult?.searchHistory?.join(", ") || "Jeszcze niczego nie wyszukiwałem") +
                (input.followUp?.previousAnswer
                    ? `Warto zaznaczyć, że ostatnio odpowiedziałem tak: ${input?.followUp?.previousAnswer}, ale poproszono mnie o więcej informacji.`
                    : ""),
            question: input.originalQuestion,
            context: input.searchResult.context,
        });
        const response = await this.openai.invoke(formattedPrompt, this.langfuseSessionConfig);
        const parsedResponse = await answerParser.parse(response.content as string);

        this.logger.logStep(executionId, "getResponseStep", input, parsedResponse);

        return parsedResponse;
    }

    private async getCritique(executionId: string, input: CritiqueStepInput) {
        const formattedPrompt = await critiquePrompt.formatMessages({
            format: critiqueParser.getFormatInstructions(),
            question: input.originalQuestion,
            answer: input.response.answer,
            reasoning: input.response.reasoning,
        });
        const response = await this.openai.invoke(formattedPrompt, this.langfuseSessionConfig);
        const parsedResponse = await critiqueParser.parse(response.content as string);

        this.logger.logStep(executionId, "getCritiqueStep", input, parsedResponse);

        return parsedResponse;
    }

    private async processQuestionWithContext(
        executionId: string,
        originalQuestion: string,
        searchHistory: string[] = [],
        iteration = 0,
        followUp?: FollowUp
    ): Promise<AssistantResponse> {
        const context = await this.getContext(executionId, {
            originalQuestion,
            followUp,
            searchHistory,
        });

        const response = await this.getResponse(executionId, {
            originalQuestion,
            searchResult: context,
        });

        const critique = await this.getCritique(executionId, {
            originalQuestion,
            response,
        });

        if ((response.needsMoreContext || critique.confidence < 70) && critique.followUpQuestion && iteration < this.maxSearchIterations) {
            return this.processQuestionWithContext(executionId, originalQuestion, searchHistory, iteration + 1, {
                followUpQuestion: critique.followUpQuestion,
                previousAnswer: response.answer,
                improvementSuggestions: critique.improvementSuggestions,
            });
        }

        return {
            answer: response.answer,
            reasoning: response.reasoning,
            critique: critique.critique,
            confidence: critique.confidence,
            needsMoreContext: response.needsMoreContext,
            followUpQuestion: critique.followUpQuestion,
            improvementSuggestions: critique.improvementSuggestions,
        };
    }

    async askQuestion(question: string): Promise<AssistantResponse> {
        this.logger.startExecution(this.sessionId, question);

        try {
            const response = await this.processQuestionWithContext(this.sessionId, question);
            this.logger.endExecution(this.sessionId, response);
            return response;
        } catch (error) {
            this.logger.endExecution(this.sessionId, undefined, error as Error);
            throw error;
        }
    }
}

export default AIAssistant;
