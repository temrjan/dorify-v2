import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { IamService } from './application/iam.service';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PharmacyController } from './infrastructure/controllers/pharmacy.controller';
import { TelegramAuthGuard } from './infrastructure/guards/telegram-auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { TenantInterceptor } from '@shared/infrastructure/tenant/tenant.interceptor';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaPharmacyRepository } from './infrastructure/persistence/prisma-pharmacy.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from './domain/repositories/pharmacy.repository';

@Module({
  controllers: [AuthController, PharmacyController],
  providers: [
    IamService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PHARMACY_REPOSITORY, useClass: PrismaPharmacyRepository },
    { provide: APP_GUARD, useClass: TelegramAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [IamService, USER_REPOSITORY, PHARMACY_REPOSITORY],
})
export class IamModule {}
