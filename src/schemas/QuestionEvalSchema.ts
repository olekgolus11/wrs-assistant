import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const QuestionEvalSchema = z.object({
    _thinking: z
        .string()
        .describe(
            `Hej! Jako Wejkuś, przeanalizuję wypowiedź pod kątem:
            - czy to pytanie wymagające wyszukania informacji (question)
            - czy to luźniejsza rozmowa (casual)
            - czy ktoś próbuje mnie przechytrzyć 😉 (attack)
            - czy wypowiedź jest niejasna i wymaga doprecyzowania (nonsense)
            
            Przemyślę to dokładnie, żeby jak najlepiej pomóc rozmówcy!`,
        ),
    questionType: z.enum(["question", "casual", "attack", "nonsense"]).describe(
        `Typ wiadomości użytkownika - pomoże mi dobrać odpowiedni ton i sposób odpowiedzi 😊`,
    ),
});
