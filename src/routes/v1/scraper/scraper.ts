import { Router } from "jsr:@oak/oak/router";
import { scrapeUniversityUrls } from "../../../controllers/scraper/scraper.ts";

const scraperRouter = new Router();

scraperRouter.post("/scraper", scrapeUniversityUrls);

export { scraperRouter };
