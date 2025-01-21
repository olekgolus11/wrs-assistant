import { QdrantDocument, ResponseStepInput } from "../types/index.ts";

export const getUniqueDocuments = (
    documents: QdrantDocument[][],
): QdrantDocument[] => {
    const flatDocuments = documents.flat();
    const uniqueResults = new Map<string, QdrantDocument>();

    flatDocuments.forEach((document) => {
        uniqueResults.set(document.id, document);
    });

    return Array.from(uniqueResults.values());
};

export const getImprovementSuggestions = (
    improvementSuggestions?: string[],
) => {
    if (!improvementSuggestions) {
        return "Brak sugestii";
    }
    return improvementSuggestions.join(", ");
};

export const getSearchHistory = (input: ResponseStepInput) => {
    const searchHistory = input.searchResult?.searchHistory?.join(", ") ||
        "Jeszcze niczego nie wyszukiwałem";
    const previousAnswer = input.followUp?.previousAnswer
        ? `Warto zaznaczyć, że ostatnio odpowiedziałem tak: ${input?.followUp?.previousAnswer}, ale poproszono mnie o więcej informacji.`
        : "";

    return `Próbowałem wyszukać już: ${searchHistory} ${previousAnswer}`;
};
