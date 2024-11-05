import { Router } from "jsr:@oak/oak";
import { assistantRouter } from "./assistant/assistant.ts";
import { scraperRouter } from "./scraper/scraper.ts";

const v1 = new Router();

v1.use("/v1", assistantRouter.routes(), assistantRouter.allowedMethods());
v1.use("/v1", scraperRouter.routes(), scraperRouter.allowedMethods());

export { v1 };
