import { Application } from "jsr:@oak/oak";
import { executionLogger } from "./src/middleware/executionLogger.ts";
import { v1 } from "./src/routes/v1/v1.ts";
import { healthcheckRouter } from "./src/routes/healthcheck/healthcheck.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const app = new Application();

app.use(oakCors());
app.use(executionLogger);

app.use(v1.routes(), v1.allowedMethods());
app.use(healthcheckRouter.routes(), healthcheckRouter.allowedMethods());

console.info("Server running on port 3002");
await app.listen({ port: 3002 });
