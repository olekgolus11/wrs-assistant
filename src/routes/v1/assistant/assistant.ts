import { Router } from "jsr:@oak/oak/router";
import { askQuestion } from "../../../controllers/assistant/assistant.ts";

const assistantRouter = new Router();

assistantRouter.post("/assistant", askQuestion);

export { assistantRouter };
