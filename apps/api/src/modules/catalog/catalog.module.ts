import { Module } from '@nestjs/common';
import { CatalogService } from './application/catalog.service';
import { PublicProductController, PharmacyProductController, AdminProductController } from './infrastructure/controllers/product.controller';
import { AdminBotProductController } from './infrastructure/controllers/admin-product.controller';
import { PrismaProductRepository } from './infrastructure/persistence/prisma-product.repository';
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository';
import { ServiceTokenGuard } from '../iam/infrastructure/guards/service-token.guard';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [
    PublicProductController,
    PharmacyProductController,
    AdminProductController,
    AdminBotProductController,
  ],
  providers: [
    CatalogService,
    ServiceTokenGuard,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
  ],
  exports: [CatalogService, PRODUCT_REPOSITORY],
})
export class CatalogModule {}
