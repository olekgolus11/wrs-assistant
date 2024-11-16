import { Readability } from "jsr:@paoramen/cheer-reader";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";
import {
    type ScrapedArticle,
    type ScrapedUrl,
    UrlCategory,
    urlPatterns,
} from "../types/index.ts";
import type { CheerioAPI } from "npm:cheerio@^1.0.0-rc.12";
import QDrantVectorDB from "./QdrantVectorDB.ts";

class UniversityScraper {
    private qdrantVectorDB: QDrantVectorDB;

    constructor() {
        this.qdrantVectorDB = new QDrantVectorDB();
    }

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

        return urls as ScrapedUrl[];
    }

    public async scrapeUrl(url: ScrapedUrl): Promise<ScrapedArticle> {
        let response;
        try {
            response = await fetch(url.url);
        } catch (error) {
            console.error(error);
        }
        if (!response) {
            throw new Error("No response from url");
        }
        const text = await response.text();
        const $ = cheerio.load(text);
        const article = new Readability($ as unknown as CheerioAPI);
        const articleText = article.parse();

        if (!articleText.title) {
            throw new Error("No title found");
        } else if (!articleText.textContent) {
            throw new Error("No text content found");
        }

        const category = this.categorizeUrl(url.url);

        const cleanedText = articleText.textContent
            .replace(/\s+/g, " ")
            .replace(/[\n\t]+/g, " ")
            .trim();

        return {
            title: articleText.title,
            textContent: cleanedText,
            category,
            url: url.url,
            date: url.date,
        };
    }

    public async addArticlesToVectorDB(articles: ScrapedArticle[]) {
        await this.qdrantVectorDB.addDocuments(articles);
    }

    private categorizeUrl(url: string): UrlCategory {
        const match = urlPatterns.find((pattern) => pattern.pattern.test(url));
        return match ? match.category : UrlCategory.OTHER;
    }
}

export default UniversityScraper;
