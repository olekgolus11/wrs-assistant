import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";

export const askQuestion = async (ctx: Context) => {
    const assistant = new AIAssistant();
    const { prompt } = await ctx.request.body.json();
    const response = await assistant.askQuestion(prompt);
    ctx.response.body = response;
    ctx.response.status = STATUS_CODE.OK;
};
