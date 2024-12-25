import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const ContextSchema = z.object({
    queries: z.array(z.string()).describe(
        `Zapytania do bazy wektorowej, które potencjalnie mogą pomóc w znalezieniu odpowiedzi. Powinny być bardzo proste, jak najmniej złożone.
        <examples>
            Pytanie: "Kto jest dziekanem WEEIA?"
            Odpowiedź: ["Imię dziekana", "Dziekan WEEIA", "Dziekan wydziału"]

            Pytanie: "Co to jest wtyczka i kiedy się odbywa?"
            Odpowiedź: ["Wtyczka", "Kiedy wtyczka", "Wydarzenie wtyczka"]
        </examples>
        `,
    ).min(1).max(3),
});
