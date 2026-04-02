import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHealth(): {
        ok: boolean;
        service: string;
        storageMode: "postgres" | "sqlite";
        timestamp: string;
    };
    getIngestStats(): Promise<{
        storageMode: "postgres" | "sqlite";
        dedupCount: number;
        rawLogCount: number;
    }>;
    ingest(body: Record<string, unknown>, apiKeyHeader?: string): Promise<{
        status: string;
        idempotencyKey: string;
        receivedAt?: undefined;
    } | {
        status: string;
        idempotencyKey: string;
        receivedAt: string;
    }>;
}
