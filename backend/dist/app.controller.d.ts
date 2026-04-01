import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHealth(): {
        ok: boolean;
        service: string;
        timestamp: string;
    };
    getIngestStats(): {
        dedupCount: number;
        rawLogCount: number;
    };
    ingest(body: Record<string, unknown>, apiKeyHeader?: string): {
        status: string;
        idempotencyKey: string;
        receivedAt?: undefined;
    } | {
        status: string;
        idempotencyKey: string;
        receivedAt: string;
    };
}
