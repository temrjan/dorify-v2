import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { ServiceTokenGuard } from '../guards/service-token.guard';
import { IamService } from '../../application/iam.service';
import { RejectPharmacySchema } from '../../application/dto/pharmacy.dto';
import type { RejectPharmacyDto } from '../../application/dto/pharmacy.dto';

/**
 * Admin endpoints called by bot via service token.
 *
 * `@Public()` skips the global TelegramAuthGuard (bot has no initData);
 * `ServiceTokenGuard` validates `X-Service-Token` header.
 */
@Controller('admin/pharmacies')
@Public()
@UseGuards(ServiceTokenGuard)
export class AdminPharmacyController {
  constructor(private readonly iamService: IamService) {}

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@Param('id') id: string) {
    return this.iamService.verifyPharmacy(id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectPharmacySchema)) dto: RejectPharmacyDto,
  ) {
    return this.iamService.rejectPharmacy(id, dto.reason);
  }
}
