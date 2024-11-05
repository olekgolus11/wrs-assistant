import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const CritiqueSchema = z.object({
    critique: z.string().describe("Krytyczna analiza odpowiedzi"),
    confidence: z.number().min(0).max(100).describe("Wskaźnik pewności od 0 do 100"),
    improvementSuggestions: z.array(z.string()).describe("Lista konkretnych sugestii dotyczących poprawy odpowiedzi"),
    followUpQuestion: z.string().optional().describe("Dodatkowe zapytanie wyszukiwania, jeśli potrzeba jest więcej kontekstu"),
});
