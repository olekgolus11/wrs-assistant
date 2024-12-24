import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const QuickAnswerSchema = z.object({
    answer: z
        .string()
        .describe(
            "Szybka, przyjazna odpowiedź dla rozmówcy! 🎓 Jeśli to pytanie wymagające researchu, dam znać że poszukam informacji. Przy luźnej rozmowie będę bardziej swobodny. Zawsze zachowuję pomocny i przyjazny ton, nawet gdy ktoś próbuje mnie przechytrzyć 😉 Jeśli czegoś nie rozumiem, grzecznie poproszę o wyjaśnienie!",
        ),
});
