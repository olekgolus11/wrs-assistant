import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";

export const askQuestionWebSocket = (ctx: Context) => {
    if (!ctx.isUpgradable) {
        ctx.response.status = STATUS_CODE.BadRequest;
        ctx.response.body = "WebSocket connection required";
        return;
    }

    const ws = ctx.upgrade();

    ws.onopen = () => {
        console.log("Connected to client");
    };

    ws.onmessage = async (m) => {
        const message = JSON.parse(m.data as string) as {
            type: string;
            prompt: string;
        };

        if (message.type === "chat") {
            console.log("Got chat message from client: ", m.data);
            const assistant = new AIAssistant(message.prompt);
            const { quickResponsePromise, responsePromise } = await assistant
                .askQuestion();

            quickResponsePromise.then((quickResponse) => {
                ws.send(JSON.stringify(quickResponse));
            });
            responsePromise.then((response) => {
                if (response) {
                    ws.send(JSON.stringify(response));
                }
            });

            await Promise.all([
                assistant.parentTrace.update({
                    output: {
                        quickResponse: await quickResponsePromise,
                        response: await responsePromise,
                    },
                    name: assistant.questionType,
                }),
            ]);
        }
    };

    ws.onclose = () => console.log("Disconncted from client");
};
