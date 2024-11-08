import z from "https://esm.sh/v135/zod@3.23.8/lib/index.js";
import type { AnswerSchema, CritiqueSchema } from "../schemas/index.ts";
import CallbackHandler from "https://esm.sh/v135/langfuse-langchain@3.29.1/lib/index.d.mts";

export type SequenceInput = {
    originalQuestion: string;
    searchHistory: string[];
    followUp?: FollowUp;
};

export type SearchResult = {
    searchHistory: string[];
    context: string;
};

export type ResponseStepInput = {
    searchResult: SearchResult;
    originalQuestion: string;
    followUp?: FollowUp;
};

export type CritiqueStepInput = {
    response: AnswerResponse;
    originalQuestion: string;
};

export type FollowUp = {
    followUpQuestion: string;
    previousAnswer: string;
    improvementSuggestions: string[];
};

export type AnswerResponse = z.infer<typeof AnswerSchema>;
export type CritiqueResponse = z.infer<typeof CritiqueSchema>;
export type AssistantResponse = AnswerResponse & CritiqueResponse;

export type LangfuseSessionConfig = {
    callbacks: CallbackHandler[];
};
