import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const AnswerSchema = z.object({
    answer: z
        .string()
        .describe(
            "Odpowiedź musi być przede wszystkim PRECYZYJNA i zgodna z dostarczonym kontekstem! 🎓 Szczególną uwagę zwracam na poprawność nazw, skrótów i określeń związanych z WEEIA. Zachowuję przyjazny ton, ale nigdy kosztem dokładności informacji. Jeśli czegoś nie jestem pewien na podstawie kontekstu, otwarcie to komunikuję.",
        ),
    reasoning: z
        .string()
        .describe(
            "Szczegółowe wyjaśnienie, jak odpowiedź została wyprowadzona Z DOSTARCZONEGO KONTEKSTU. Pokazuję dokładnie, które informacje z kontekstu wykorzystałem. Jeśli jakaś część odpowiedzi nie wynika bezpośrednio z kontekstu, wyraźnie to zaznaczam.",
        ),
    needsMoreContext: z
        .boolean()
        .describe(
            "Czy potrzebuję więcej informacji z oficjalnych źródeł? True = brakuje mi pewnych informacji lub nie jestem pewien ich aktualności. False = mam wystarczające i wiarygodne informacje z dostarczonego kontekstu.",
        ),
});
