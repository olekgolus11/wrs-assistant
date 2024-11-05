import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
    private executionLog: Record<string, any> = {};

    constructor() {
        this.logDirectory = "./logs";

        // Ensure log directory exists
        if (!existsSync(this.logDirectory)) {
            mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    startExecution(executionId: string, input: string) {
        this.executionLog[executionId] = {
            executionId,
            startTime: performance.now(),
            userQuestion: input,
            steps: [],
        };
    }

    logStep(executionId: string, stepName: string, input: any, output: any) {
        this.executionLog[executionId].steps.push({
            stepName,
            input,
            output,
            duration: performance.now() - this.executionLog[executionId].startTime,
        });
    }

    endExecution(executionId: string, output?: any, error?: Error) {
        this.executionLog[executionId].endTime = performance.now();
        this.executionLog[executionId].output = output;
        this.executionLog[executionId].error = error;
        this.executionLog[executionId].totalDuration =
            String((this.executionLog[executionId].endTime - this.executionLog[executionId].startTime) / 1000) + "s";

        this.saveLog(this.executionLog[executionId]);
    }

    getLog(executionId: string) {
        return this.executionLog[executionId];
    }

    private saveLog(log: ExecutionLog): void {
        const filename = `${log.executionId}-${new Date().toISOString()}.json`;
        const filepath = join(this.logDirectory, filename);

        const logData = JSON.stringify(log, null, 2);
        writeFileSync(filepath, logData);
    }
}

export default ExecutionLogger;
