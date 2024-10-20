import { QdrantVectorStore } from "https://esm.sh/@langchain/qdrant@0.1.0";
import { OpenAIEmbeddings } from "https://esm.sh/@langchain/openai@0.3.5";
import { Document } from "https://esm.sh/@langchain/core@0.3.8/documents";
import process from "node:process";

class QDrantVectorDB {
    private store: QdrantVectorStore;
    private embeddings: OpenAIEmbeddings;

    constructor() {
        this.embeddings = new OpenAIEmbeddings();
        this.store = new QdrantVectorStore(this.embeddings, {
            url: process.env.QDRANT_URL,
            collectionName: process.env.QDRANT_COLLECTION_NAME,
            apiKey: process.env.QDRANT_VECTOR_DB_API_KEY,
        });
    }

    async createTestVectors() {
        const documents = [
            new Document({
                pageContent:
                    "Uczelnia, na której pytania będę odpowiadał, to Politechnika Łódzka. Użytkownicy mogą mi zadawać pytania jedynie na temat tej uczelni.",
                metadata: {
                    title: "Politechnika Łódzka",
                    description: "Uczelnia techniczna w Łodzi",
                },
            }),
            new Document({
                pageContent:
                    "Wydział Politechniki Łódzkiej, na którego pytania będę odpowiadał, to Wydział Elektrotechniki, Elektroniki, Informatyki i Automatyki, w skrócie WEEIA. Użytkownicy mogą mi zadawać pytania jedynie na temat tego wydziału.",
                metadata: {
                    title: "Wydział Elektrotechniki, Elektroniki, Informatyki i Automatyki",
                    description: "Wydział Politechniki Łódzkiej, w skrócie WEEIA",
                },
            }),
        ];
        await this.store.addDocuments(documents);
    }

    async searchTestVectors(query: string) {
        const results = await this.store.similaritySearch(query, 2);
        return results;
    }

    async searchStore(query: string) {
        const results = await this.store.similaritySearch(query, 3);
        return results;
    }
}

export default QDrantVectorDB;
