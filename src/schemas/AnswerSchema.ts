import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const AnswerSchema = z.object({
    answer: z.string().describe("Bezpośrednia odpowiedź na pytanie"),
    reasoning: z.string().describe("Wyjaśnienie, jak odpowiedź została wyprowadzona z kontekstu"),
    needsMoreContext: z.boolean().describe("Wskazuje, czy potrzebne jest dodatkowe wyszukiwanie kontekstu"),
    followUpQuery: z.string().optional().describe("Dodatkowe zapytanie wyszukiwania, jeśli potrzebny jest więcej kontekstu"),
});
