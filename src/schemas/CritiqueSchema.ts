import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const CritiqueSchema = z.object({
    critique: z
        .string()
        .describe(
            "Krytyczna analiza odpowiedzi w kontekście pytania powiązanego z wydziałem WEEIA Politechniki Łódzkiej. Odpowiedź również jest poparta uzasadnieniem, w celu lepszego zrozumienia przez ciebie."
        ),
    confidence: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Wskaźnik pewności od 0 do 100. Pewna wiadomość to taka, która odpowiada celnie na pytanie, bez zbędnego przedłużania, bez dodatkowych informacji. Jeżeli uzasadnienie odwołuje się do kontekstu, to jest ono poprawne."
        ),
    improvementSuggestions: z
        .array(z.string())
        .describe(
            "WAŻNE: Pozostaw to pole puste (nie generuj go wcale) jeśli wskaźnik pewności jest >= 75. Lista konkretnych sugestii dotyczących poprawy odpowiedzi."
        )
        .optional(),
    followUpQuestion: z
        .string()
        .optional()
        .describe(
            "WAŻNE: Pozostaw to pole puste (nie generuj go wcale) jeśli wskaźnik pewności jest >= 75. Dodatkowe zapytanie wyszukiwania by poprawić odpowiedź o brakujący kontekst."
        )
        .optional(),
});
