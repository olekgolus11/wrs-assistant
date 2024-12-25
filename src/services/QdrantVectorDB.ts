import { OpenAIEmbeddings } from "https://esm.sh/@langchain/openai@0.3.5";
import process from "node:process";
import { QdrantClient } from "https://esm.sh/@qdrant/js-client-rest@1.12.0";
import { QdrantDocument, ScrapedArticle } from "../types/index.ts";
import { createHash } from "node:crypto";

class QDrantVectorDB {
    private store: QdrantClient;
    private embeddings: OpenAIEmbeddings;
    private collectionName: string;

    constructor() {
        this.embeddings = new OpenAIEmbeddings();
        this.store = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_VECTOR_DB_API_KEY,
        });
        this.collectionName = process.env.QDRANT_COLLECTION_NAME ??
            "test-collection";
    }

    async addDocuments(documents: ScrapedArticle[]) {
        const points = await Promise.all(documents.map(async (doc) => ({
            id: this.createStableUUID(doc.url, doc.title),
            vector: await this.embeddings.embedQuery(
                doc.title + "\n" + doc.textContent,
            ),
            payload: doc,
        })));
        await this.store.upsert(this.collectionName, {
            wait: true,
            points,
        });
    }

    async searchStore(query: string): Promise<QdrantDocument[]> {
        const results = await this.store.search(this.collectionName, {
            vector: await this.embeddings.embedQuery(query),
            limit: 3,
        });
        return results;
    }

    private createStableUUID(url: string, title: string): string {
        const input = `${url}:${title}`;

        const hash = createHash("sha256").update(input).digest("hex");

        const uuid = [
            hash.substring(0, 8),
            hash.substring(8, 12),
            hash.substring(12, 16),
            hash.substring(16, 20),
            hash.substring(20, 32),
        ].join("-");

        return uuid;
    }
}

export default QDrantVectorDB;
