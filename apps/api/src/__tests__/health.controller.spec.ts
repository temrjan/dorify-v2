import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../health.controller';
import { PrismaService } from '@core/database/prisma.service';

function createController(prismaOverride: { $queryRaw: jest.Mock }) {
  const prisma = prismaOverride as unknown as PrismaService;
  return new HealthController(prisma);
}

describe('HealthController.check — DB ping (S-HIGH-12)', () => {
  it('returns ok + db:up when SELECT 1 resolves', async () => {
    const controller = createController({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    });

    const result = await controller.check();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'dorify-api',
      db: 'up',
    });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws ServiceUnavailableException when $queryRaw rejects (DB down)', async () => {
    const controller = createController({
      $queryRaw: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects after 2s timeout when $queryRaw hangs (CI gate fast-fail)', async () => {
    jest.useFakeTimers();
    const controller = createController({
      $queryRaw: jest.fn().mockImplementation(
        () => new Promise(() => { /* never resolves */ }),
      ),
    });

    const checkPromise = controller.check();
    const assertion = expect(checkPromise).rejects.toThrow(ServiceUnavailableException);

    await jest.advanceTimersByTimeAsync(2000);
    await assertion;

    jest.useRealTimers();
  });
});
