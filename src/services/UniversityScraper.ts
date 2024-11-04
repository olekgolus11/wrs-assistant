import { Readability } from "jsr:@paoramen/cheer-reader";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";

class UniversityScraper {
    public async getUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
        const response = await fetch(sitemapUrl);
        const text = await response.text();
        const $ = cheerio.load(text, {
            xmlMode: true,
        });

        const urls: string[] = [];

        $("url loc").each((_, element) => {
            const url = $(element).text();
            if (url) {
                urls.push(url);
            }
        });

        return urls;
    }
}

export default UniversityScraper;
