import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";
import { mergeHistoryWithPrompt } from "../../helpers/helpers.ts";

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
            history: {
                type: string;
                message: string;
            }[];
        };

        if (message.type === "chat") {
            try {
                console.log("Got chat message from client: ", m.data);
                const messageWithHistory = mergeHistoryWithPrompt(
                    message.history,
                    message.prompt,
                );
                const assistant = new AIAssistant(messageWithHistory);
                const { quickResponsePromise, responsePromise } =
                    await assistant
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
            } catch (error) {
                console.log("Error: ", error);
                ws.send(
                    JSON.stringify({
                        quickAnswer:
                            "Wybacz, wystąpił błąd 😥, spróbuj ponownie.",
                        questionType: "casual",
                    }),
                );
            }
        }
    };

    ws.onclose = () => console.log("Disconncted from client");
};
