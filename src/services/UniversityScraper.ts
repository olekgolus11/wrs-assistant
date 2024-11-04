import { Readability } from "jsr:@paoramen/cheer-reader";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";

class UniversityScraper {
    public async getUrlsFromSitemap(sitemapUrl: string) {
        const response = await fetch(sitemapUrl);
        const text = await response.text();
        const $ = cheerio.load(text, {
            xmlMode: true,
        });

        const urls: {
            url: string;
            date: string;
        }[] = [];

        $("url").each((_, element) => {
            const loc = $(element).find("loc");
            const lastmod = $(element).find("lastmod");
            const url = loc.text();
            const date = lastmod.text();
            if (url) {
                urls.push({
                    url,
                    date,
                });
            }
        });

        return urls;
    }
}

export default UniversityScraper;
