import { Application, Router } from "jsr:@oak/oak";
import { STATUS_CODE } from "jsr:@std/http";
import AIAssistant from "./src/services/AIAssistant.ts";
import UniversityScraper from "./src/services/UniversityScraper.ts";

const app = new Application();
const assistant = new AIAssistant();
const universityScraper = new UniversityScraper();

const healthcheckRouter = new Router();
const v1 = new Router();
const assistantRouter = new Router();
const scraperRouter = new Router();

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

scraperRouter.post("/scraper", async (ctx) => {
    const { url } = await ctx.request.body.json();
    const urls = await universityScraper.getUrlsFromSitemap(url);
    ctx.response.body = urls;
    ctx.response.status = STATUS_CODE.OK;
});

v1.use("/v1", assistantRouter.routes(), assistantRouter.allowedMethods());
v1.use("/v1", scraperRouter.routes(), scraperRouter.allowedMethods());

app.use(v1.routes(), v1.allowedMethods());
app.use(healthcheckRouter.routes());

console.info("Server running on port 3000");
await app.listen({ port: 3000 });
