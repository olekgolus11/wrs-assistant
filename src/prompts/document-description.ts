import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { ChatPromptTemplate } from "https://esm.sh/v135/@langchain/core@0.3.6/prompts.js";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const DocumentDescriptionSchema = z.object({
    isPageUseful: z.boolean().describe(
        "Czy strona jest użyteczna? Strona nieużyteczna to taka, która jest pusta / nie zawiera żadnych informacji",
    ),
    description: z.string().describe(
        "Zwięzły opis (max 100 słów) zawierający główne tezy, cel i wartość strony",
    ),
    keywords: z.array(z.string()).min(3).max(7).describe(
        "Lista 3,7 kluczowych słów lub fraz najlepiej charakteryzujących zawartość strony",
    ),
});

export const documentDescriptionParser = StructuredOutputParser.fromZodSchema(
    DocumentDescriptionSchema,
);

export const documentDescriptionPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Jesteś ekspertem w analizie treści stron internetowych. Twoim zadaniem jest:
        1. Przeanalizowanie podanego tekstu i stworzenie zwięzłego opisu (max 100 słów) oddającego główną wartość i cel strony
        2. Wyodrębnienie 3,7 kluczowych słów/fraz, które najlepiej kategoryzują i opisują zawartość

        Skup się na:
        - Głównym przekazie i celu strony
        - Najważniejszych informacjach i faktach
        - Unikalnych cechach i wartościach
        - Grupie docelowej treści
        Unikaj ogólników i nieistotnych szczegółów.`,
    ],
    [
        "user",
        `Treść pobranej strony:
        {document}`,
    ],
]);
