import { Router } from "jsr:@oak/oak/router";
import {
    scrapeSavoirVivre,
    scrapeUniversityUrls,
} from "../../../controllers/scraper/scraper.ts";

const scraperRouter = new Router();

scraperRouter.post("/scraper", scrapeUniversityUrls);
scraperRouter.post("/scraper-savoir-vivre", scrapeSavoirVivre);

export { scraperRouter };
