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
    for (const url of urls) {
        try {
            const article = await universityScraper.scrapeUrl(url);
            scrapedArticles.push(article);
        } catch (error) {
            console.error(error);
        }
    }
    await universityScraper.addArticlesToVectorDB(scrapedArticles);
    ctx.response.body = scrapedArticles;
    ctx.response.status = STATUS_CODE.OK;
};
