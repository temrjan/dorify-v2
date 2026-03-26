import { Controller, Get } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      service: 'dorify-api',
      timestamp: new Date().toISOString(),
    };
  }
}
