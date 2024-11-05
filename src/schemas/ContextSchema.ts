import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";

export const ContextSchema = z.object({
    queries: z.array(z.string()).describe("Zapytania do bazy wektorowe, które potencjalnie mogą pomóc w znalezieniu odpowiedzi").min(1).max(3),
});
