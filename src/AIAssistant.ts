import { OpenAI } from "https://esm.sh/@langchain/openai@0.3.5";

class AIAssistant {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            model: "gpt-4o-mini",
        });
    }

    async getTestResponse(prompt: string): Promise<string> {
        const completion = await this.openai.invoke(prompt);
        return completion;
    }
}

export default AIAssistant;
