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

type UniversityQuery = {
    question: string;
    context?: string;
    searchHistory?: string[];
};

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

    private createAnswerChain() {
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

        return RunnableSequence.from([
            {
                initialResponse: async (input: UniversityQuery) => {
                    const formattedPrompt = await answerPrompt.formatMessages({
                        format: answerParser.getFormatInstructions(),
                        searchHistory: input.searchHistory?.join(", ") || "Brak",
                        ...input,
                    });

                    const response = await this.openai.invoke(formattedPrompt);
                    return answerParser.parse(response.content as string);
                },
                originalInput: (input: UniversityQuery) => input,
            },
            {
                critique: async (input) => {
                    const formattedPrompt = await critiquePrompt.formatMessages({
                        format: critiqueParser.getFormatInstructions(),
                        question: input.originalInput.question,
                        answer: input.initialResponse.answer,
                        reasoning: input.initialResponse.reasoning,
                    });

                    const response = await this.openai.invoke(formattedPrompt);
                    return critiqueParser.parse(response.content as string);
                },
                answer: (input) => input.initialResponse,
            },
            (input): AssistantResponse => ({
                ...input.answer,
                ...input.critique,
            }),
        ]);
    }

    private async retrieveContext(question: string) {
        return await this.qdrantVectorDB.searchStore(question);
    }

    private async processQuestionWithContext(
        question: string,
        context: string,
        searchHistory: string[] = [],
        iteration = 0
    ): Promise<AssistantResponse> {
        const chain = this.createAnswerChain();
        const response = await chain.invoke({
            question,
            context,
            searchHistory,
        });

        if (response.needs_more_context && response.follow_up_query && iteration < this.maxSearchIterations) {
            const newContext = await this.retrieveContext(response.follow_up_query);
            const updatedContext = `${context}\n\nDodatkowy kontekst:\n${JSON.stringify(newContext)}`;
            const updatedHistory = [...searchHistory, response.follow_up_query];

            return this.processQuestionWithContext(question, updatedContext, updatedHistory, iteration + 1);
        }

        return response;
    }

    async askQuestion(question: string): Promise<AssistantResponse> {
        try {
            const initialContext = await this.retrieveContext(question);
            const contextAsString = JSON.stringify(initialContext);

            const response = await this.processQuestionWithContext(question, contextAsString);

            if (response.confidence < 50) {
                throw new Error("Low confidence in answer. Please provide more specific information or rephrase the question.");
            }

            return response;
        } catch (error) {
            console.error("Error processing question:", error);
            throw error;
        }
    }
}

export default AIAssistant;
