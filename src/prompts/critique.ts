import { StructuredOutputParser } from "https://esm.sh/v135/@langchain/core@0.3.6/dist/output_parsers/structured.js";
import { ChatPromptTemplate } from "https://esm.sh/v135/@langchain/core@0.3.6/prompts.js";
import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import { factsPrompt } from "./global.ts";

export const CritiqueSchema = z.object({
    critique: z
        .string()
        .describe(
            "Krytyczna analiza odpowiedzi w kontekście pytania powiązanego z wydziałem WEEIA Politechniki Łódzkiej. Odpowiedź również jest poparta uzasadnieniem, w celu lepszego zrozumienia przez ciebie. Nie przesadzaj z wymaganą ilością szczegółów. Jeżeli uzasadnienie odwołuje się do kontekstu, to jest ono poprawne i wystarczające.",
        ),
    didAnswerTheQuestion: z
        .boolean()
        .describe(
            `Czy udzieliłem odpowiedzi na pytanie? True = tak, False = nie. Udzielenie odpowiedzi to podanie informacji, która bezpośrednio odpowiada na pytanie - nie jest to np. odesłanie do źródeł.
            <examples>
                Pytanie: "Kiedy odbywa się sesja egzaminacyjna?"
                Odpowiedź: "Sesja egzaminacyjna odbywa się w czerwcu."
                didAnswerTheQuestion: true

                Pytanie: "Kto jest dziekanem wydziału WEEIA?"
                Odpowiedź: "Nie mam tej informacji, ale możesz sprawdzić na stronie wydziału."
                didAnswerTheQuestion: false

                Pytanie: "Jakie są godziny otwarcia dziekanatu?"
                Odpowiedź: "Dziekanat jest otwarty od poniedziałku do piątku w godzinach 9-15."
                didAnswerTheQuestion: true
            </examples>
            `,
        ),
    confidence: z
        .number()
        .min(0)
        .max(100)
        .describe(
            `Wskaźnik pewności od 0 do 100. Pewna wiadomość to taka, która odpowiada celnie na pytanie, bez zbędnego przedłużania, bez zbędnych dodatkowych informacji. Jeżeli uzasadnienie odwołuje się do kontekstu, to jest ono poprawne i wystarczające.
            <examples>
                Pytanie: "Jak ma na imię dziekan?"
                Odpowiedź: "Dziekanem Wydziału Elektrotechniki, Elektroniki, Informatyki i Automatyki jest dr hab. inż. Jacek Kucharski, prof. uczelni."
                confidence: 100 (Pewne, krótka odpowiedź na pytanie)

                Pytanie: "Kto jest dziekanem wydziału WEEIA?"
                Odpowiedź: "Nie mam tej informacji, ale możesz sprawdzić na stronie wydziału."
                confidence: undefined (Nieudzielenie odpowiedzi)

                Pytanie: "Co to wtyczka?"
                Odpowiedź: "Wtyczka to 4-dniowy wyjazd szkoleniowo-integracyjny organizowany przez Wydział Elektrotechniki, Elektroniki, Informatyki i Automatyki (WEEIA) Politechniki Łódzkiej. Tegoroczna edycja, która była jubileuszową, 10. edycją, odbyła się w dniach 24 - 27 października 2024 roku w Ośrodku Wczasowym 'Zbójnik' w Murzasichle. Wyjazd ma na celu integrację studentów oraz rozwój ich umiejętności poprzez warsztaty, spotkania integracyjne i różne formy zabawy"
                confidence: 90 (Pewna, szczegółowa odpowiedź, ale niepotrzebnie przedłużona w kilku miejsach)
            </examples>
                `,
        ).optional(),
    improvementSuggestions: z
        .array(z.string())
        .describe(
            "Sugestie poprawy odpowiedzi, które mogą pomóc w zrozumieniu kontekstu, poprawności informacji lub jasności odpowiedzi.",
        ),
});

export const critiqueParser = StructuredOutputParser.fromZodSchema(
    CritiqueSchema,
);

export const critiquePrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `Hej! Jako Wejkuś dbam o jakość moich odpowiedzi! 🎓
    
        Sprawdzę czy moja odpowiedź:
        - Jest przyjazna i zrozumiała dla studentów
        - Zachowuje odpowiedni balans między profesjonalizmem a luźniejszym tonem
        - Odpowiada dokładnie na pytanie
        - Nie zawiera zbędnych dygresji
        - Sprawdzam czy uzasadnienie jest prawidłowe, a odpowiedź poparta faktycznym kontekstem
    
        Jeśli coś wymaga poprawy (confidence < 75), zaproponuję konkretne usprawnienia
        i dodatkowe pytania do kontekstu. Pamiętam o historii wyszukiwania, żeby nie powielać zapytań!`,
    ],
    ...factsPrompt,
    ["system", "Musisz odpowiedzieć w następującym formacie:\n{format}"],
    [
        "user",
        "Pytanie które dostałem: {question}\nMoja odpowiedź: {answer}\nMoje uzasadnienie: {reasoning}\nDostarczony mi kontekst: {searchResult}",
    ],
]);
