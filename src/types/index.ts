import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import type { AnswerSchema, CritiqueSchema } from "../schemas/index.ts";

export type SequenceInput = {
    originalQuestion: string;
    searchHistory: string[];
    followUpQuery?: string;
};

export type SearchResult = {
    searchHistory: string[];
    context: string;
};

export type ResponseStepInput = {
    searchResult: SearchResult;
    originalQuestion: string;
};

export type CritiqueStepInput = {
    response: AnswerResponse;
    originalQuestion: string;
};

export type SequenceResult = {
    response: AnswerResponse;
    critique: CritiqueResponse;
};

export type AnswerResponse = z.infer<typeof AnswerSchema>;
export type CritiqueResponse = z.infer<typeof CritiqueSchema>;
export type AssistantResponse = AnswerResponse & CritiqueResponse;
