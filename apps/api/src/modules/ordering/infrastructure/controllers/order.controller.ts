import { Controller, Get, Post, Put, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Roles, UserRole } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { PaginationSchema } from '@common/dto/pagination.dto';
import type { PaginationDto } from '@common/dto/pagination.dto';
import { OrderingService } from '../../application/ordering.service';
import { PlaceOrderSchema, UpdateOrderStatusSchema } from '../../application/dto/order.dto';
import type { PlaceOrderDto, UpdateOrderStatusDto } from '../../application/dto/order.dto';

// ── Buyer endpoints ─────────────────────────────────────────

@Controller('orders')
export class BuyerOrderController {
  constructor(private readonly orderingService: OrderingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  placeOrder(
    @CurrentUser('id') buyerId: string,
    @Body(new ZodValidationPipe(PlaceOrderSchema)) dto: PlaceOrderDto,
  ) {
    return this.orderingService.placeOrder(buyerId, dto);
  }

  @Get()
  listMyOrders(
    @CurrentUser('id') buyerId: string,
    @Query(new ZodValidationPipe(PaginationSchema)) pagination: PaginationDto,
  ) {
    return this.orderingService.listBuyerOrders(buyerId, pagination);
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.orderingService.getOrder(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @Param('id') id: string,
    @CurrentUser('id') buyerId: string,
  ) {
    return this.orderingService.cancelOrder(id, buyerId);
  }
}

// ── Pharmacy owner endpoints ────────────────────────────────

@Controller('pharmacy/orders')
@Roles(UserRole.PHARMACY_OWNER)
export class PharmacyOrderController {
  constructor(private readonly orderingService: OrderingService) {}

  @Get()
  listPharmacyOrders(
    @CurrentUser('pharmacyId') pharmacyId: string,
    @Query(new ZodValidationPipe(PaginationSchema)) pagination: PaginationDto,
  ) {
    return this.orderingService.listPharmacyOrders(pharmacyId, pagination);
  }

  @Put(':id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @CurrentUser('pharmacyId') pharmacyId: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) dto: UpdateOrderStatusDto,
  ) {
    return this.orderingService.updateOrderStatus(id, pharmacyId, dto);
  }
}
