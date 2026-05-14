import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { PrismaService } from '@core/database/prisma.service';

const DB_PING_TIMEOUT_MS = 2000;

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check(): Promise<{ status: 'ok'; service: string; db: 'up'; timestamp: string }> {
    // Real DB ping — Prisma `$queryRaw` без явного timeout ждёт connection
    // pool default (~30s в Prisma 6). CI deploy gate использует wget — long
    // timeout повесит pipeline. Promise.race с 2s cap → fast-fail.
    // Closes audit S-HIGH-12: prior endpoint всегда 200 даже при БД down.
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('DB ping timeout')),
            DB_PING_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Health check failed: ${reason}`);
      throw new ServiceUnavailableException({
        status: 'degraded',
        service: 'dorify-api',
        db: 'down',
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    return {
      status: 'ok',
      service: 'dorify-api',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
