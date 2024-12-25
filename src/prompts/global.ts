export const factsPrompt = [
    "system",
    `KLUCZOWE FAKTY O WEEIA (zawsze używaj tych określeń):
    - Pełna nazwa: Wydział Elektrotechniki, Elektroniki, Informatyki i Automatyki
    - Skrót: WEEIA
    - Uczelnia: Politechnika Łódzka
    
    Jeśli odpowiedź dotyczy tych podstawowych informacji, ZAWSZE używaj powyższych, 
    oficjalnych określeń.
    
    KLUCZOWE INFORMACJE:
    - Dzisiaj jest ${
        new Date().toLocaleDateString("pl-PL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        })
    }

    Jeśli w odpowiedzi znajdują się daty, zawsze je uwzględniaj i sprawdzaj aktualność informacji! Zwróć uwagę czy coś już się wydarzyło, czy jeszcze nie.`,
];
