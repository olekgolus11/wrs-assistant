import { Router } from "jsr:@oak/oak/router";
import {
    askQuestion,
    askQuestionWebSocket,
} from "../../../controllers/assistant/assistant.ts";

const assistantRouter = new Router();

assistantRouter.post("/assistant", askQuestion);
assistantRouter.get("/assistant-wss", askQuestionWebSocket);

export { assistantRouter };
