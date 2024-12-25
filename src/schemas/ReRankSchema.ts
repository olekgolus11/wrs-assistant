import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { ChatPromptTemplate } from "https://esm.sh/v135/@langchain/core@0.3.6/prompts.js";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const RerankSchema = z.object({
    isDocumentUseful: z.boolean().describe(`Czy dokument jest użyteczny?`),
});

export const rerankParser = StructuredOutputParser.fromZodSchema(
    RerankSchema,
);

export const rerankSystemPrompt =
    `Jesteś pomocnym asystentem, który ocenia, czy dany dokument jest użyteczny dla konkretnego zapytania. Odpowiedz true jeśli użyteczny, false jeśli nie.`;

export const rerankPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Jesteś pomocnym asystentem, który ocenia, czy dany dokument jest użyteczny dla konkretnego zapytania. Odpowiedz true jeśli użyteczny, false jeśli nie.`,
    ],
    [
        "system",
        "Musisz odpowiedzieć w języku polskim w następującym formacie:\n{format}.",
    ],
    [
        "system",
        `Pytanie: {question},
        Dokument: {document}`,
    ],
]);
