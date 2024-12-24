import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import type {
    AnswerSchema,
    CritiqueSchema,
    QuickAnswerSchema,
} from "../schemas/index.ts";
import CallbackHandler from "https://esm.sh/v135/langfuse-langchain@3.29.1/lib/index.d.mts";
import { LangfuseTraceClient } from "https://esm.sh/v135/langfuse-core@3.29.1/lib/index.d.mts";

export type QdrantDocument = {
    id: string;
    version: number;
    score: number;
    payload: QdrantDocumentPayload;
};

export type QdrantDocumentPayload = {
    title: string;
    textContent: string;
    category: string;
    url: string;
    date: string;
};

export type SequenceInput = {
    originalQuestion: string;
    searchHistory: string[];
    followUp?: FollowUp;
};

export type SearchResult = {
    searchHistory: string[];
    context: QdrantDocument[];
};

export type ResponseStepInput = {
    searchResult: SearchResult;
    originalQuestion: string;
    followUp?: FollowUp;
};

export type CritiqueStepInput = {
    response: AnswerResponse;
    originalQuestion: string;
    searchResult: SearchResult;
};

export type FollowUp = {
    followUpQuestion: string;
    previousAnswer: string;
    improvementSuggestions: string[];
};

export type AnswerResponse = z.infer<typeof AnswerSchema>;
export type CritiqueResponse = z.infer<typeof CritiqueSchema>;
export type AssistantResponse = AnswerResponse & CritiqueResponse;
export type NoAssistantResponse = Partial<AssistantResponse>;
export type QuickAssistantResponse = z.infer<typeof QuickAnswerSchema> & {
    questionType: QuestionEvaluationType;
};

export type LangfuseSessionConfig = {
    callbacks: CallbackHandler[];
};

export type QuestionEvaluationType =
    | "question"
    | "casual"
    | "attack"
    | "nonsense";

export type CallbackHandlerConfig = {
    sessionId: string;
    root: LangfuseTraceClient;
};

export type ScrapedUrl = {
    url: string;
    date: string;
};

export type ScrapedArticle = {
    title: string;
    textContent: string;
    category: UrlCategory;
    url: string;
    date: string;
};

export enum UrlCategory {
    HOMEPAGE = "homepage",
    NEWS = "aktualnosci",
    DEAN_ANNOUNCEMENTS = "ogloszenia-dziekanatu",
    STUDENT_AFFAIRS = "sprawy-studenckie",
    EDUCATION = "ksztalcenie",
    FACULTY = "wydzial",
    SCIENCE = "nauka",
    COMPETITIONS = "konkursy",
    CALENDAR = "kalendarz",
    STUDENT_SUCCESS = "sukcesy-studentow",
    SCIENTIFIC_NEWS = "aktualnosci-naukowe",
    COOPERATION = "wspolpraca",
    OTHER = "inne",
}

export type UrlPattern = {
    pattern: RegExp;
    category: UrlCategory;
};

export const urlPatterns: UrlPattern[] = [
    {
        pattern: /^http:\/\/weeia\.p\.lodz\.pl\/?$/,
        category: UrlCategory.HOMEPAGE,
    },
    {
        pattern: /\/wydzial\/aktualnosci\/?/,
        category: UrlCategory.NEWS,
    },
    {
        pattern: /\/wydzial\/ogloszenia-dziekanatu\/?/,
        category: UrlCategory.DEAN_ANNOUNCEMENTS,
    },
    {
        pattern: /\/(studenci|plany-zajec|plan-zajec)\/?/,
        category: UrlCategory.STUDENT_AFFAIRS,
    },
    {
        pattern: /\/(ksztalcenie|studia-stacjonarne|rada-kierunku)\/?/,
        category: UrlCategory.EDUCATION,
    },
    {
        pattern:
            /\/wydzial\/(struktura-organizacyjna|wladze-wydzialu|dziekanat|biuro)\/?/,
        category: UrlCategory.FACULTY,
    },
    {
        pattern: /\/(nauka|projekty-naukowe|rada-ds-stopni|rada-dyscypliny)\/?/,
        category: UrlCategory.SCIENCE,
    },
    {
        pattern: /\/(konkursy|matury-probne|konkurs)\/?/,
        category: UrlCategory.COMPETITIONS,
    },
    {
        pattern: /\/wydzial\/kalendarz\/?/,
        category: UrlCategory.CALENDAR,
    },
    {
        pattern: /\/sukcesy-studentow\/?/,
        category: UrlCategory.STUDENT_SUCCESS,
    },
    {
        pattern: /\/aktualnosci-naukowe\/?/,
        category: UrlCategory.SCIENTIFIC_NEWS,
    },
    {
        pattern: /\/(wspolpraca|partnerzy)\/?/,
        category: UrlCategory.COOPERATION,
    },
];
