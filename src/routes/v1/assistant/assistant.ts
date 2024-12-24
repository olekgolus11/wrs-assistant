import { Router } from "jsr:@oak/oak/router";
import {
    askQuestionWebSocket,
} from "../../../controllers/assistant/assistant.ts";

const assistantRouter = new Router();

assistantRouter.get("/assistant-wss", askQuestionWebSocket);

export { assistantRouter };
