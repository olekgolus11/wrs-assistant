import { Router } from "jsr:@oak/oak/router";
import { getHealthcheck } from "../../controllers/healthcheck/healthcheck.ts";

const healthcheckRouter = new Router();

healthcheckRouter.get("/healthcheck", getHealthcheck);

export { healthcheckRouter };
