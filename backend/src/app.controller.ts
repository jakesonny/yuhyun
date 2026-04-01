import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/api/health')
  getHealth() {
    return this.appService.health();
  }

  @Get('/api/ingest/stats')
  getIngestStats() {
    return this.appService.ingestStats();
  }

  @Post('/api/ingest')
  ingest(
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') apiKeyHeader?: string,
  ) {
    return this.appService.ingest(
      body as {
        siteId: string;
        agentId: string;
        sourceFile: string;
        offset: number;
        occurredAt: string;
        rawLine: string;
        parsedPayload?: Record<string, unknown>;
        idempotencyKey: string;
        signature: string;
      },
      apiKeyHeader,
    );
  }
}
