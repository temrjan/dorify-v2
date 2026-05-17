import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { ServiceTokenGuard } from '../../../iam/infrastructure/guards/service-token.guard';
import { CatalogService } from '../../application/catalog.service';
import { HideProductSchema } from '../../application/dto/product.dto';
import type { HideProductDto } from '../../application/dto/product.dto';

/**
 * Admin endpoints called by bot via service token. Mirrors
 * {@link AdminPharmacyController}: `@Public()` skips the global
 * TelegramAuthGuard (bot has no initData), {@link ServiceTokenGuard}
 * validates `X-Service-Token` header.
 *
 * Post-moderation MVP: products auto-publish at creation, so the only admin
 * action wired here is `hide` (takedown for rule violations). The synchronous
 * pre-moderation endpoint stays under JWT in {@link AdminProductController}
 * for future use.
 */
@Controller('admin/products')
@Public()
@UseGuards(ServiceTokenGuard)
export class AdminBotProductController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  hide(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HideProductSchema)) dto: HideProductDto,
  ) {
    // moderatorId = 'bot-admin' marker — distinguishes bot-triggered hide
    // from future SPA-authenticated admin actions in audit logs.
    return this.catalogService.hideProductByAdmin(id, 'bot-admin', dto);
  }
}
