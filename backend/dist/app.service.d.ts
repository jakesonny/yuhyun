import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
type IngestBody = {
    siteId: string;
    agentId: string;
    sourceFile: string;
    offset: number;
    occurredAt: string;
    rawLine: string;
    parsedPayload?: Record<string, unknown>;
    idempotencyKey: string;
    signature: string;
};
export declare class AppService implements OnModuleInit, OnModuleDestroy {
    private readonly sqliteDb?;
    private readonly pgPool?;
    private readonly storageMode;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private initSchema;
    ingest(payload: IngestBody, apiKeyHeader: string | undefined): Promise<{
        status: string;
        idempotencyKey: string;
        receivedAt?: undefined;
    } | {
        status: string;
        idempotencyKey: string;
        receivedAt: string;
    }>;
    health(): {
        ok: boolean;
        service: string;
        storageMode: "postgres" | "sqlite";
        timestamp: string;
    };
    ingestStats(): Promise<{
        storageMode: "postgres" | "sqlite";
        dedupCount: number;
        rawLogCount: number;
    }>;
    private insertIngestRecord;
    private getStats;
    private validateRequiredFields;
    private validateAuth;
}
export {};
