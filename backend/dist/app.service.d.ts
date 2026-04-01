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
export declare class AppService {
    private readonly db;
    constructor();
    ingest(payload: IngestBody, apiKeyHeader: string | undefined): {
        status: string;
        idempotencyKey: string;
        receivedAt?: undefined;
    } | {
        status: string;
        idempotencyKey: string;
        receivedAt: string;
    };
    health(): {
        ok: boolean;
        service: string;
        timestamp: string;
    };
    ingestStats(): {
        dedupCount: number;
        rawLogCount: number;
    };
    private validateRequiredFields;
    private validateAuth;
}
export {};
