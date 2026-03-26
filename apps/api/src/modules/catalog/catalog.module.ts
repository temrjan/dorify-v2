import { Module } from '@nestjs/common';
import { CatalogService } from './application/catalog.service';
import { PublicProductController, PharmacyProductController, AdminProductController } from './infrastructure/controllers/product.controller';
import { PrismaProductRepository } from './infrastructure/persistence/prisma-product.repository';
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository';

@Module({
  controllers: [PublicProductController, PharmacyProductController, AdminProductController],
  providers: [
    CatalogService,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
  ],
  exports: [CatalogService, PRODUCT_REPOSITORY],
})
export class CatalogModule {}
