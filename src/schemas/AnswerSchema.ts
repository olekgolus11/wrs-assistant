import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const AnswerSchema = z.object({
    answer: z
        .string()
        .describe(
            "Bezpośrednia odpowiedź na pytanie użytkownika. Poprzyj szczegółami jeśli uważasz, że są one istotne. Jeśli nie znasz odpowiedzi na pytanie, powiedz o tym wprost.",
        ),
    reasoning: z.string().describe(
        "Wyjaśnienie, jak odpowiedź została wyprowadzona z kontekstu",
    ),
    needsMoreContext: z
        .boolean()
        .describe(
            "Wskazuje, czy potrzebne jest dodatkowe wyszukiwanie kontekstu. Jeśli uważasz, że historia wyszukiwania nie jest wystarczająca, ustaw na true. Natomiast, jeśli widzisz, że podjęto już próby znalezienia odpowiedzi, ustaw na false.",
        ),
});
