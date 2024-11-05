import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import UniversityScraper from "../../services/UniversityScraper.ts";
import { Context } from "jsr:@oak/oak";

export const scrapeUniversityUrls = async (ctx: Context) => {
    const universityScraper = new UniversityScraper();
    const { url } = await ctx.request.body.json();
    const urls = await universityScraper.getUrlsFromSitemap(url);
    ctx.response.body = urls;
    ctx.response.status = STATUS_CODE.OK;
};
