import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import QDrantVectorDB from "./QdrantVectorDB.ts";
import { HumanMessage, SystemMessage } from "https://esm.sh/v135/@langchain/core@0.3.6/messages.js";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core@0.3.6/prompts.js";
import { RunnableSequence } from "https://esm.sh/v135/@langchain/core@0.3.6/runnables.js";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";

const AnswerSchema = z.object({
    answer: z.string().describe("The direct answer to the question"),
    reasoning: z.string().describe("Explanation of how the answer was derived from the context"),
});

const CritiqueSchema = z.object({
    critique: z.string().describe("Critical analysis of the answer"),
    confidence: z.number().min(0).max(100).describe("Confidence score from 0 to 100"),
    improvement_suggestions: z.array(z.string()).describe("List of specific suggestions for improving the answer"),
});

// Type definitions
type UniversityQuery = {
    question: string;
    context?: string;
};

type AnswerResponse = z.infer<typeof AnswerSchema>;
type CritiqueResponse = z.infer<typeof CritiqueSchema>;
type AssistantResponse = AnswerResponse & CritiqueResponse;

class AIAssistant {
    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;

    constructor() {
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
        });
        this.qdrantVectorDB = new QDrantVectorDB();
    }

    private createAnswerChain() {
        const answerParser = StructuredOutputParser.fromZodSchema(AnswerSchema);
        const critiqueParser = StructuredOutputParser.fromZodSchema(CritiqueSchema);

        const answerPrompt = ChatPromptTemplate.fromMessages([
            [
                "system",
                "Jesteś pomocnym asystentem uniwersyteckim. Użyj poniższego kontekstu, aby odpowiedzieć na pytanie. Jeśli nie możesz znaleźć odpowiedzi w kontekście, szczerze to powiedz.",
            ],
            ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
            ["user", "Kontekst: {context}\n\nPytanie: {question}"],
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

    async retrieveContext(question: string) {
        return await this.qdrantVectorDB.searchStore(question);
    }

    async processQuestion(question: string): Promise<AssistantResponse> {
        const context = await this.retrieveContext(question);
        const contextAsString = JSON.stringify(context);
        const chain = this.createAnswerChain();

        return await chain.invoke({
            question,
            context: contextAsString,
        });
    }

    async askQuestion(question: string): Promise<AssistantResponse> {
        try {
            const response = await this.processQuestion(question);

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
