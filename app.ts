import { Application, Router } from "jsr:@oak/oak";
import { STATUS_CODE } from "jsr:@std/http";
import AIAssistant from "./src/AIAssistant.ts";

const app = new Application();
const assistant = new AIAssistant();

const healthcheckRouter = new Router();
const v1 = new Router();
const assistantRouter = new Router();

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

healthcheckRouter.get("/", (ctx) => {
    ctx.response.body = "OK";
    ctx.response.status = STATUS_CODE.OK;
});

assistantRouter.post("/assistant", async (ctx) => {
    const { prompt } = await ctx.request.body.json();
    const response = await assistant.askQuestion(prompt);
    ctx.response.body = response;
    ctx.response.status = STATUS_CODE.OK;
});

v1.use("/v1", assistantRouter.routes(), assistantRouter.allowedMethods());

app.use(v1.routes(), v1.allowedMethods());
app.use(healthcheckRouter.routes());

await app.listen({ port: 3000 });
console.log("Server running on port 3000");

// Run the server with the command:
// deno run --watch --env --allow-all app.ts
