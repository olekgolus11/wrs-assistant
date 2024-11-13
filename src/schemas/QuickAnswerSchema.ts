import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const QuickAnswerSchema = z.object({
    answer: z
        .string()
        .describe(
            "Bezpośrednia odpowiedź na pytanie użytkownika. Ma być krótka i zwięzła, tak aby użytkownik mógł szybko zrozumieć odpowiedź. Jeśli nie znasz odpowiedzi na pytanie, powiedz o tym wprost."
        ),
});
