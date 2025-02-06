import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";
import { WebSocketMessage } from "../../types/index.ts";

const kv = await Deno.openKv();
const MAX_RATE_LIMIT = 55;
const RATE_LIMIT_RESET_TIME = 3600000; // 1 hour

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
        const message = JSON.parse(m.data as string) as WebSocketMessage;

        if (!message.userId) {
            ws.send(
                JSON.stringify({
                    answer:
                        "Ups, wygląda na to, że nie mogę zidentyfikować twojego zapytania 😥. Być może to wina twojej przeglądarki, albo błąd jest po mojej stronie.",
                    questionType: "casual",
                }),
            );
            return;
        }

        const currentTime = Date.now();
        const userKey = ["rate_limit", message.userId];
        const userRateData = await kv.get(userKey);

        if (userRateData.value) {
            const { count, resetTime } = userRateData.value as {
                count: number;
                resetTime: number;
            };

            if (currentTime > resetTime) {
                await kv.set(userKey, {
                    count: 1,
                    resetTime: currentTime + RATE_LIMIT_RESET_TIME,
                });
            } else if (count >= MAX_RATE_LIMIT) {
                console.log("Rate limit exceeded for user: ", message.userId);
                const timeLeft = Math.ceil((resetTime - currentTime) / 60000); // Convert to minutes
                ws.send(
                    JSON.stringify({
                        answer:
                            `Ups! Wygląda na to, że przekroczyłeś limit zapytań 😥. Spróbuj ponownie za ${timeLeft} min.`,
                        questionType: "casual",
                    }),
                );
                return;
            } else {
                // Increment the count
                await kv.set(userKey, {
                    count: count + 1,
                    resetTime,
                });
            }
        } else {
            // Initialize rate limit data for a new user
            await kv.set(userKey, {
                count: 1,
                resetTime: currentTime + RATE_LIMIT_RESET_TIME, // 1 hour
            });
        }

        // Process the chat message
        let assistant;
        if (message.type === "chat") {
            try {
                console.log("Got chat message from client: ", m.data);
                assistant = new AIAssistant(message.prompt, message.history);
                const { quickResponsePromise, responsePromise } =
                    await assistant.askQuestion();

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
                const errorMessage =
                    "Ups, wystąpił błąd podczas przetwarzania twojego zapytania 😥. Spróbuj ponownie później.";
                ws.send(
                    JSON.stringify({
                        quickAnswer: errorMessage,
                        questionType: "casual",
                    }),
                );
                assistant?.parentTrace.update({
                    output: {
                        quickResponse: {
                            quickAnswer: errorMessage,
                            questionType: "casual",
                        },
                    },
                });
            }
        }
    };

    ws.onclose = () => console.log("Disconnected from client");
};
