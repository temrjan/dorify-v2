import { Controller, Get, Post, Put, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Roles, UserRole } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { IamService } from '../../application/iam.service';
import {
  CreatePharmacySchema,
  UpdatePharmacySchema,
  UpdatePaymentSettingsSchema,
} from '../../application/dto/pharmacy.dto';
import type {
  CreatePharmacyDto,
  UpdatePharmacyDto,
  UpdatePaymentSettingsDto,
} from '../../application/dto/pharmacy.dto';

@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly iamService: IamService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreatePharmacySchema)) dto: CreatePharmacyDto,
  ) {
    return this.iamService.createPharmacy(userId, dto);
  }

  @Get('profile')
  @Roles(UserRole.PHARMACY_OWNER)
  getProfile(@CurrentUser('id') userId: string) {
    return this.iamService.getPharmacyProfile(userId);
  }

  @Put('profile')
  @Roles(UserRole.PHARMACY_OWNER)
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(UpdatePharmacySchema)) dto: UpdatePharmacyDto,
  ) {
    return this.iamService.updatePharmacyProfile(userId, dto);
  }

  @Get('payment-settings')
  @Roles(UserRole.PHARMACY_OWNER)
  getPaymentSettings(@CurrentUser('id') userId: string) {
    return this.iamService.getPaymentSettings(userId);
  }

  @Put('payment-settings')
  @Roles(UserRole.PHARMACY_OWNER)
  updatePaymentSettings(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(UpdatePaymentSettingsSchema)) dto: UpdatePaymentSettingsDto,
  ) {
    return this.iamService.updatePaymentSettings(userId, dto);
  }
}
