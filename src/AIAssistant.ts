import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { RunnableSequence } from "https://esm.sh/v135/@langchain/core@0.3.6/runnables.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";

const AnswerSchema = z.object({
    answer: z.string().describe("Bezpośrednia odpowiedź na pytanie"),
    reasoning: z.string().describe("Wyjaśnienie, jak odpowiedź została wyprowadzona z kontekstu"),
    needsMoreContext: z.boolean().describe("Wskazuje, czy potrzebne jest dodatkowe wyszukiwanie kontekstu"),
    followUpQuery: z.string().optional().describe("Dodatkowe zapytanie wyszukiwania, jeśli potrzebny jest więcej kontekstu"),
});

const CritiqueSchema = z.object({
    critique: z.string().describe("Krytyczna analiza odpowiedzi"),
    confidence: z.number().min(0).max(100).describe("Wskaźnik pewności od 0 do 100"),
    improvement_suggestions: z.array(z.string()).describe("Lista konkretnych sugestii dotyczących poprawy odpowiedzi"),
});

type SequenceInput = {
    originalQuestion: string;
    searchHistory: string[];
    followUpQuery?: string;
};

type SearchResult = {
    searchHistory: string[];
    context: string;
};

type ResponseStepInput = {
    searchResult: SearchResult;
    originalQuestion: string;
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
        Jeśli potrzebujesz więcej informacji, ustaw needsMoreContext na true i podaj followUpQuery.
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

    private getContextStep(): { searchResult: (input: SequenceInput) => Promise<SearchResult>; originalQuestion: (input: SequenceInput) => string } {
        return {
            searchResult: async (input: SequenceInput) => {
                const query = input.followUpQuery || input.originalQuestion;
                input.searchHistory.push(query);
                const context = await this.qdrantVectorDB.searchStore(query);
                const contextAsString = JSON.stringify(context);
                return {
                    searchHistory: input.searchHistory,
                    context: contextAsString,
                };
            },
            originalQuestion: (input: SequenceInput) => input.originalQuestion,
        };
    }

    private getResponseStep(): {
        response: (input: ResponseStepInput) => Promise<AnswerResponse>;
        originalQuestion: (input: ResponseStepInput) => string;
    } {
        return {
            response: async (input: ResponseStepInput) => {
                const formattedPrompt = await answerPrompt.formatMessages({
                    format: answerParser.getFormatInstructions(),
                    searchHistory: "Próbowałem wyszukać już: " + (input.searchResult?.searchHistory?.join(", ") || "Brak"),
                    question: input.originalQuestion,
                    context: input.searchResult.context,
                });

                const response = await this.openai.invoke(formattedPrompt);
                const parsedResponse = await answerParser.parse(response.content as string);
                return parsedResponse;
            },
            originalQuestion: (input: ResponseStepInput) => input.originalQuestion,
        };
    }

    private getCritiqueStep(): {
        critique: (input: CritiqueStepInput) => Promise<CritiqueResponse>;
        response: (input: CritiqueStepInput) => AnswerResponse;
    } {
        return {
            critique: async (input: CritiqueStepInput): Promise<CritiqueResponse> => {
                const formattedPrompt = await critiquePrompt.formatMessages({
                    format: critiqueParser.getFormatInstructions(),
                    question: input.originalQuestion,
                    answer: input.response.answer,
                    reasoning: input.response.reasoning,
                });

                const response = await this.openai.invoke(formattedPrompt);
                const parsedResponse = await critiqueParser.parse(response.content as string);
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
                needsMoreContext: result.response.needsMoreContext,
                followUpQuery: result.response.followUpQuery,
                improvement_suggestions: result.critique.improvement_suggestions,
            }),
        ]);
    }

    private async processQuestionWithContext(
        originalQuestion: string,
        searchHistory: string[] = [],
        iteration = 0,
        followUpQuery?: string
    ): Promise<AssistantResponse> {
        const chain = this.createAnswerChain();
        const response = await chain.invoke({
            originalQuestion,
            followUpQuery,
            searchHistory,
        });

        if (response.needsMoreContext && response.followUpQuery && iteration < this.maxSearchIterations) {
            return this.processQuestionWithContext(originalQuestion, searchHistory, iteration + 1, response.followUpQuery);
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
