import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderingService } from './application/ordering.service';
import { OnOrderCreatedDecrementStock } from './application/event-handlers/on-order-created.handler';
import { OnOrderCancelledRestoreStock } from './application/event-handlers/on-order-cancelled.handler';
import { BuyerOrderController, PharmacyOrderController } from './infrastructure/controllers/order.controller';
import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository';

@Module({
  imports: [CatalogModule],
  controllers: [BuyerOrderController, PharmacyOrderController],
  providers: [
    OrderingService,
    OnOrderCreatedDecrementStock,
    OnOrderCancelledRestoreStock,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
  ],
  exports: [OrderingService, ORDER_REPOSITORY],
})
export class OrderingModule {}
