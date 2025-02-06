import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import { facts } from "./global.ts";
import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { ChatPromptTemplate } from "https://esm.sh/v135/@langchain/core@0.3.6/prompts.js";

export const QuestionExtractSchema = z.object({
    question: z
        .string()
        .describe(
            "Pełne pytanie użytkownika, wynikające z kontekstu rozmowy. Krótkie i zwięzłe pytanie, które jest zapytaniem do bazy wektorowej.",
        ),
});

export const questionExtractParser = StructuredOutputParser.fromZodSchema(
    QuestionExtractSchema,
);

export const questionExtractPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Jestem specjalistą od analizy tekstu! Spróbuję wyodrębnić pytanie z Twojej wypowiedzi, na bazie kontekstu rozmowy. Jeżeli użytkownik pyta o jakiś konkretny skrót, którego nie znam, to zostawiam go jak jest.
        <examples>
            <input>
                Historia czatu: "Brak historii"
                Pytanie użytkownika: "co to wrs"
            </input>
            <output>
                question: "Co to wrs?"
            </output>

            <input>
                Historia czatu: 
                    User: "Jade na wtyczke w tym miesiacu"
                    Assistant: "O to super"
                Pytanie użytkownika: "A co to jest w ogóle, wiesz może?"
            </input>
            <output>
                question: "Co to wtyczka?"
            </output>
        </examples>

        ${facts()}
        `,
    ],
    [
        "user",
        `Historia czatu: {chatHistory}
Pytanie użytkownika: {question}`,
    ],
]);
