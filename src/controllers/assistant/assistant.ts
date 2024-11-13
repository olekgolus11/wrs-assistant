import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";

export const askQuestion = async (ctx: Context) => {
    const { prompt } = await ctx.request.body.json();
    const assistant = new AIAssistant(prompt);
    const response = await assistant.askQuestion();
    ctx.response.body = response;
    ctx.response.status = STATUS_CODE.OK;
};
