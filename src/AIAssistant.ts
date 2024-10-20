import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { RunnableSequence } from "https://esm.sh/v135/@langchain/core@0.3.6/runnables.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";

const AnswerSchema = z.object({
    answer: z.string().describe("Bezpośrednia odpowiedź na pytanie"),
    reasoning: z.string().describe("Wyjaśnienie, jak odpowiedź została wyprowadzona z kontekstu"),
    needs_more_context: z.boolean().describe("Wskazuje, czy potrzebne jest dodatkowe wyszukiwanie kontekstu"),
    follow_up_query: z.string().optional().describe("Dodatkowe zapytanie wyszukiwania, jeśli potrzebny jest więcej kontekstu"),
});

const CritiqueSchema = z.object({
    critique: z.string().describe("Krytyczna analiza odpowiedzi"),
    confidence: z.number().min(0).max(100).describe("Wskaźnik pewności od 0 do 100"),
    improvement_suggestions: z.array(z.string()).describe("Lista konkretnych sugestii dotyczących poprawy odpowiedzi"),
});

type SequenceInput = {
    question: string;
    searchHistory?: string[];
};

type ResponseStepInput = {
    question: string;
    context: string;
    searchHistory: string[];
};

type CritiqueStepInput = {
    response: AnswerResponse;
    originalQuestion: string;
};

type SequenceResult = {
    response: AnswerResponse;
    critique: CritiqueResponse;
};

const answerParser = StructuredOutputParser.fromZodSchema(AnswerSchema);
const critiqueParser = StructuredOutputParser.fromZodSchema(CritiqueSchema);

const answerPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Jesteś pomocnym asystentem uniwersyteckim. Użyj poniższego kontekstu, aby odpowiedzieć na pytanie. 
        Jeśli potrzebujesz więcej informacji, ustaw needs_more_context na true i podaj follow_up_query.
        Historia wyszukiwania pomoże Ci uniknąć powtarzania tych samych zapytań.`,
    ],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Historia wyszukiwania: {searchHistory}\nKontekst: {context}\n\nPytanie: {question}"],
]);

const critiquePrompt = ChatPromptTemplate.fromMessages([
    ["system", "Przeanalizuj poniższą odpowiedź pod kątem dokładności, kompletności i potencjalnych ulepszeń."],
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    ["user", "Pytanie: {question}\nOdpowiedź: {answer}\nUzasadnienie: {reasoning}"],
]);

type AnswerResponse = z.infer<typeof AnswerSchema>;
type CritiqueResponse = z.infer<typeof CritiqueSchema>;
type AssistantResponse = AnswerResponse & CritiqueResponse;

class AIAssistant {
    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;
    private maxSearchIterations: number;

    constructor() {
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
        });
        this.qdrantVectorDB = new QDrantVectorDB();
        this.maxSearchIterations = 3;
    }

    private getContextStep(): { context: (input: SequenceInput) => Promise<ResponseStepInput> } {
        return {
            context: async (input: SequenceInput) => {
                console.info("\n\n[GetContextStep]");
                const context = await this.qdrantVectorDB.searchStore(input.question);
                const contextAsString = JSON.stringify(context);
                console.info(`Searched context with query "${input.question}" and found:\n${JSON.stringify(context, null, 2)}`);
                return {
                    question: input.question,
                    context: contextAsString,
                    searchHistory: input.searchHistory || [],
                };
            },
        };
    }

    private getResponseStep(): {
        response: (input: ResponseStepInput) => Promise<AnswerResponse>;
        originalQuestion: (input: ResponseStepInput) => string;
    } {
        return {
            response: async (input: ResponseStepInput) => {
                console.info("\n\n[GetResponseStep]");
                const formattedPrompt = await answerPrompt.formatMessages({
                    format: answerParser.getFormatInstructions(),
                    searchHistory: input.searchHistory?.join(", ") || "Brak",
                    question: input.question,
                    context: input.context,
                });

                const response = await this.openai.invoke(formattedPrompt);
                const parsedResponse = await answerParser.parse(response.content as string);
                console.info(`Received response from OpenAI:\n${parsedResponse}`);
                return parsedResponse;
            },
            originalQuestion: (input: ResponseStepInput) => input.question,
        };
    }

    private getCritiqueStep(): {
        critique: (input: CritiqueStepInput) => Promise<CritiqueResponse>;
        response: (input: CritiqueStepInput) => AnswerResponse;
    } {
        return {
            critique: async (input: CritiqueStepInput): Promise<CritiqueResponse> => {
                console.info("\n\n[GetCritiqueStep]");
                console.info(`Answer: ${input.response.answer}`);
                const formattedPrompt = await critiquePrompt.formatMessages({
                    format: critiqueParser.getFormatInstructions(),
                    question: input.originalQuestion,
                    answer: input.response.answer,
                    reasoning: input.response.reasoning,
                });

                const response = await this.openai.invoke(formattedPrompt);
                const parsedResponse = await critiqueParser.parse(response.content as string);
                console.info(`Received critique from OpenAI:\n${parsedResponse}`);
                return parsedResponse;
            },
            response: (input: CritiqueStepInput) => input.response,
        };
    }

    private createAnswerChain(): RunnableSequence<SequenceInput, AssistantResponse> {
        return RunnableSequence.from([
            this.getContextStep(),
            this.getResponseStep(),
            this.getCritiqueStep(),
            (result: SequenceResult): AssistantResponse => ({
                answer: result.response.answer,
                reasoning: result.response.reasoning,
                critique: result.critique.critique,
                confidence: result.critique.confidence,
                needs_more_context: result.response.needs_more_context,
                follow_up_query: result.response.follow_up_query,
                improvement_suggestions: result.critique.improvement_suggestions,
            }),
        ]);
    }

    private async processQuestionWithContext(question: string, searchHistory: string[] = [], iteration = 0): Promise<AssistantResponse> {
        const chain = this.createAnswerChain();
        const response = await chain.invoke({
            question,
            searchHistory,
        });

        if (response.needs_more_context && response.follow_up_query && iteration < this.maxSearchIterations) {
            const updatedHistory = [...searchHistory, response.follow_up_query];
            return this.processQuestionWithContext(question, updatedHistory, iteration + 1);
        }

        return response;
    }

    async askQuestion(question: string): Promise<AssistantResponse> {
        try {
            const response = await this.processQuestionWithContext(question);
            return response;
        } catch (error) {
            console.error("Error processing question:", error);
            throw error;
        }
    }
}

export default AIAssistant;
