import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.3.5";
import QDrantVectorDB from "./QdrantVectorDB.ts";
import { HumanMessage, SystemMessage } from "https://esm.sh/v135/@langchain/core@0.3.6/messages.js";

class AIAssistant {
    private openai: ChatOpenAI;
    private qdrantVectorDB: QDrantVectorDB;

    constructor() {
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
        });
        this.qdrantVectorDB = new QDrantVectorDB();
    }

    async getTestResponse(prompt: string) {
        const vectorInformation = await this.qdrantVectorDB.searchTestVectors(prompt);
        const completion = await this.openai.invoke([
            new SystemMessage(
                `I will answer the user questions. I have found ${
                    vectorInformation.length
                } relevant documents. Their content is: ${vectorInformation.map((doc) => doc.pageContent).join(", ")}`
            ),
            new HumanMessage(prompt),
        ]);
        const text = completion.content;
        console.log(text);
        return text;
    }
}

export default AIAssistant;
