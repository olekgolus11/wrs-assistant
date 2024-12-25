import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import UniversityScraper from "../../services/UniversityScraper.ts";
import { Context } from "jsr:@oak/oak";
import type { ScrapedArticle } from "../../types/index.ts";

export const scrapeUniversityUrls = async (ctx: Context) => {
    const universityScraper = new UniversityScraper();
    const { url } = await ctx.request.body.json();
    const urls = await universityScraper.getUrlsFromSitemap(url);
    urls.forEach((url) => {
        console.log(url.url);
    });
    urls.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const scrapedArticles: ScrapedArticle[] = [];
    const concurrencyLimit = 10;
    const queue = urls.slice();
    const promises: Promise<void>[] = [];

    const worker = async () => {
        while (queue.length > 0) {
            const url = queue.shift();
            if (url) {
                let retries = 2;
                while (retries >= 0) {
                    try {
                        const article = await universityScraper.scrapeUrl(url);
                        scrapedArticles.push(article);
                        break; // Exit the retry loop if successful
                    } catch (error) {
                        console.error(error);
                        retries -= 1;
                        if (retries < 0) {
                            console.error(
                                `Failed to scrape ${url} after multiple attempts`,
                            );
                        }
                    }
                }
            }
        }
    };

    for (let i = 0; i < concurrencyLimit; i++) {
        promises.push(worker());
    }

    await Promise.all(promises);
    await universityScraper.addArticlesToVectorDB(scrapedArticles);
    ctx.response.body = scrapedArticles;
    ctx.response.status = STATUS_CODE.OK;
};
