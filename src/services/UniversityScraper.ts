import { Readability } from "jsr:@paoramen/cheer-reader";
import * as cheerio from "https://esm.sh/v135/cheerio@1.0.0";
import {
    type ScrapedArticle,
    type ScrapedUrl,
    UrlCategory,
    urlPatterns,
} from "../types/index.ts";
import type { CheerioAPI } from "npm:cheerio@^1.0.0-rc.12";
import QDrantVectorDB from "./QdrantVectorDB.ts";
import { ChatOpenAI } from "https://esm.sh/v135/@langchain/openai@0.3.5/index.js";
import {
    documentDescriptionParser,
    documentDescriptionPrompt,
} from "../prompts/index.ts";

class UniversityScraper {
    private qdrantVectorDB: QDrantVectorDB;
    private openai: ChatOpenAI;

    constructor() {
        this.qdrantVectorDB = new QDrantVectorDB();
        this.openai = new ChatOpenAI({
            model: "gpt-4o-mini",
            temperature: 0.5,
        });
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
        console.info(`Scraping ${url.url}`);
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

        const formattedPrompt = await documentDescriptionPrompt.formatMessages({
            format: documentDescriptionParser.getFormatInstructions(),
            document: {
                title: articleText.title,
                textContent: cleanedText,
            },
        });
        const documentDescriptionResponse = await this.openai.invoke(
            formattedPrompt,
        );
        const parsedResponse = await documentDescriptionParser.parse(
            documentDescriptionResponse.content as string,
        );

        if (!parsedResponse.isPageUseful) {
            throw new Error(`Page ${url.url} is not useful`);
        }

        console.info(`Scraped ${url.url} with result: 
            Title: ${articleText.title}
            Description: ${parsedResponse.description}
            Keywords: ${parsedResponse.keywords}`);

        return {
            title: articleText.title,
            description: parsedResponse.description,
            textContent: cleanedText,
            keywords: [category, ...parsedResponse.keywords],
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
