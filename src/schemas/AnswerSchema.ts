import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const AnswerSchema = z.object({
    _thinking: z
        .string()
        .describe(
            `Szczegółowo, krok po kroku, zastanawiam się, jak odpowiedź zostanie wyprowadzona Z DOSTARCZONEGO KONTEKSTU. Wypisuję sobie wszystko w punktach:
            1. Pokazuję dokładnie, które informacje z kontekstu wykorzystuje. 
            2. Jeśli jakaś część odpowiedzi nie wynika bezpośrednio z kontekstu, wyraźnie to zaznaczam
            3. Zwracam uwagę na poprawność nazw
            4. Sprawdzam daty i określam czy wydarzenie
               - już się odbyło (przeszłość)
               - dopiero się odbędzie (przyszłość)
               - trwa obecnie
                Analizę przeprowadzam w następujący sposób:
                4.1: Wypisuję datę wydarzenia: <data wydarzenia>
                4.2: Wypisuję aktualną datę znaną mi z kontekstu: <aktualna data>
                4.3: Porównuję daty i stwierdzam, czy wydarzenie już się odbyło, czy dopiero się odbędzie.
            5. Jeśli potrzebuję więcej informacji, wyraźnie to komunikuję.
            `,
        ),
    answer: z
        .string()
        .describe(
            `Odpowiedź musi być przede wszystkim PRECYZYJNA i zgodna z dostarczonym kontekstem! 🎓 Szczególną uwagę zwracam na: 
            1. Poprawność nazw, skrótów i określeń związanych z WEEIA. 
            2. Precyzyjne określenie czasu wydarzenia (przeszłe/przyszłe).

            Przy odpowiedzi zachowuję przyjazny ton, ale nigdy kosztem dokładności informacji. Jeśli czegoś nie jestem pewien na podstawie kontekstu, otwarcie to komunikuję.`,
        ),
    needsMoreContext: z
        .boolean()
        .describe(
            "Czy potrzebuję więcej informacji z oficjalnych źródeł? True = brakuje mi pewnych informacji lub nie jestem pewien ich aktualności. False = mam wystarczające informacje by odpowiedzieć na pytanie.",
        ),
});
