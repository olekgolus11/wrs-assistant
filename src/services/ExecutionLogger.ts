import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import type { AssistantResponse } from "../types/index.ts";

interface StepLog {
    stepName: string;
    startTime: number;
    endTime: number;
    duration: number;
    input: any;
    output: any;
    error?: Error;
}

interface ExecutionLog {
    executionId: string;
    originalQuestion: string;
    startTime: number;
    endTime: number;
    totalDuration: number;
    steps: StepLog[];
    finalResponse?: AssistantResponse;
    error?: Error;
}

class ExecutionLogger {
    private logDirectory: string;
    private currentLogs: Map<string, ExecutionLog>;

    constructor() {
        this.logDirectory = "./logs";
        this.currentLogs = new Map();

        // Ensure log directory exists
        if (!existsSync(this.logDirectory)) {
            mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    startExecution(executionId: string, question: string): void {
        this.currentLogs.set(executionId, {
            executionId,
            originalQuestion: question,
            startTime: performance.now(),
            endTime: 0,
            totalDuration: 0,
            steps: [],
        });
    }

    async logStep(executionId: string, stepName: string, inputData: any, operation: () => Promise<any>): Promise<any> {
        const log = this.currentLogs.get(executionId);
        if (!log) throw new Error(`No log found for execution ${executionId}`);

        const stepLog: StepLog = {
            stepName,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            input: inputData,
            output: null,
        };

        try {
            const result = await operation();
            stepLog.output = result;
            stepLog.endTime = performance.now();
            stepLog.duration = stepLog.endTime - stepLog.startTime;
            log.steps.push(stepLog);
            return result;
        } catch (error) {
            stepLog.error = error as Error;
            stepLog.endTime = performance.now();
            stepLog.duration = stepLog.endTime - stepLog.startTime;
            log.steps.push(stepLog);
            throw error;
        }
    }

    endExecution(executionId: string, finalResponse?: AssistantResponse, error?: Error): void {
        const log = this.currentLogs.get(executionId);
        if (!log) throw new Error(`No log found for execution ${executionId}`);

        log.endTime = performance.now();
        log.totalDuration = log.endTime - log.startTime;
        log.finalResponse = finalResponse;
        log.error = error;

        // Save log to file
        this.saveLog(log);
    }

    private saveLog(log: ExecutionLog): void {
        const filename = `${log.executionId}-${new Date().toISOString()}.json`;
        const filepath = join(this.logDirectory, filename);

        const logData = JSON.stringify(log, null, 2);
        writeFileSync(filepath, logData);
    }

    getExecutionLog(executionId: string): ExecutionLog | undefined {
        return this.currentLogs.get(executionId);
    }
}

export default ExecutionLogger;
