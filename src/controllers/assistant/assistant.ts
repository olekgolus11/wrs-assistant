import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import AIAssistant from "../../services/AIAssistant.ts";
import { Context } from "jsr:@oak/oak";

export const askQuestion = async (ctx: Context) => {
    const { prompt } = await ctx.request.body.json();
    const assistant = new AIAssistant(prompt);
    const { quickResponsePromise, responsePromise } = await assistant.askQuestion();

    // Set headers for streaming
    ctx.response.status = STATUS_CODE.OK;
    ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
    ctx.response.headers.set("Transfer-Encoding", "chunked");

    let quickResponse;
    let response;

    // Create a ReadableStream to send data in chunks
    ctx.response.body = new ReadableStream({
        async start(controller) {
            try {
                // Send the quick response (serialized as JSON)
                quickResponse = await quickResponsePromise;
                console.log(quickResponse);
                controller.enqueue(new TextEncoder().encode(JSON.stringify(quickResponse) + "\n"));

                // Then send the full response (serialized as JSON)
                response = await responsePromise;
                console.log(response);
                await new Promise((resolve) => setTimeout(resolve, 3000));
                controller.enqueue(new TextEncoder().encode(JSON.stringify(response) + "\n"));

                // Close the stream when all data is sent
                await Promise.all([
                    assistant.parentTrace.update({
                        output: {
                            quickResponse: quickResponse,
                            response: response,
                        },
                        name: assistant.questionType,
                    }),
                ]);

                controller.close();
            } catch (error) {
                // Handle errors gracefully
                controller.error(error);
            }
        },
    });
};
