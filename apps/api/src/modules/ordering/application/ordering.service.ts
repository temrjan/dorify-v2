import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_REPOSITORY } from '../domain/repositories/order.repository';
import type { OrderRepository } from '../domain/repositories/order.repository';
import { PRODUCT_REPOSITORY } from '../../catalog/domain/repositories/product.repository';
import type { ProductRepository } from '../../catalog/domain/repositories/product.repository';
import { Order, OrderStatus } from '../domain/entities/order.entity';
import { OrderItem } from '../domain/entities/order-item.entity';
import { Money } from '../../catalog/domain/value-objects/money.vo';
import type { PaginatedResult } from '@common/dto/pagination.dto';
import type { PaginationDto } from '@common/dto/pagination.dto';
import type { PlaceOrderDto, UpdateOrderStatusDto, OrderResponse, OrderItemResponse } from './dto/order.dto';

@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: OrderRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async placeOrder(buyerId: string, dto: PlaceOrderDto): Promise<OrderResponse> {
    // 1. Load and validate products
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productRepo.findByIds(productIds);

    const orderItems: OrderItem[] = [];

    for (const item of dto.items) {
      const product = products.find((p) => p.getId() === item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      if (product.pharmacyId !== dto.pharmacyId) {
        throw new ForbiddenException(`Product ${product.name} does not belong to this pharmacy`);
      }
      if (!product.canBePurchased()) {
        throw new ForbiddenException(`Product ${product.name} is not available for purchase`);
      }
      if (!product.hasEnoughStock(item.quantity)) {
        throw new ForbiddenException(
          `Insufficient stock for ${product.name}: available ${product.stock}, requested ${item.quantity}`,
        );
      }

      orderItems.push(OrderItem.create({
        id: this.generateCuid(),
        productId: product.getId(),
        productName: product.name,
        quantity: item.quantity,
        priceAtTime: product.price,
      }));
    }

    // 2. Create Order (Aggregate Root)
    const order = Order.create({
      id: this.generateCuid(),
      pharmacyId: dto.pharmacyId,
      buyerId,
      items: orderItems,
      deliveryType: dto.deliveryType,
      deliveryAddress: dto.deliveryAddress,
      contactPhone: dto.contactPhone,
      comment: dto.comment,
    });

    // 3. Save
    await this.orderRepo.save(order);

    // 4. Publish Domain Events (OrderCreated → DecrementStock, CreateInvoice)
    const events = order.pullDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit(event.eventName, event);
      this.logger.log(`Published event: ${event.eventName}`);
    }

    return this.toResponse(order);
  }

  async cancelOrder(orderId: string, userId: string): Promise<OrderResponse> {
    const order = await this.findOrderForBuyer(orderId, userId);

    order.cancel();

    await this.orderRepo.save(order);

    const events = order.pullDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit(event.eventName, event);
    }

    return this.toResponse(order);
  }

  async updateOrderStatus(orderId: string, pharmacyId: string, dto: UpdateOrderStatusDto): Promise<OrderResponse> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.pharmacyId !== pharmacyId) {
      throw new ForbiddenException('Order does not belong to your pharmacy');
    }

    const newStatus = dto.status as OrderStatus;

    if (newStatus === OrderStatus.CANCELLED) {
      order.cancel(dto.reason);
    } else {
      order.updateStatus(newStatus);
    }

    await this.orderRepo.save(order);

    const events = order.pullDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit(event.eventName, event);
    }

    return this.toResponse(order);
  }

  async getOrder(orderId: string): Promise<OrderResponse> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return this.toResponse(order);
  }

  async listBuyerOrders(buyerId: string, pagination: PaginationDto): Promise<PaginatedResult<OrderResponse>> {
    const result = await this.orderRepo.findByBuyerId(buyerId, pagination);
    return {
      ...result,
      items: result.items.map((o) => this.toResponse(o)),
    };
  }

  async listPharmacyOrders(pharmacyId: string, pagination: PaginationDto): Promise<PaginatedResult<OrderResponse>> {
    const result = await this.orderRepo.findByPharmacyId(pharmacyId, pagination);
    return {
      ...result,
      items: result.items.map((o) => this.toResponse(o)),
    };
  }

  private async findOrderForBuyer(orderId: string, buyerId: string): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    return order;
  }

  private toResponse(order: Order): OrderResponse {
    return {
      id: order.getId(),
      pharmacyId: order.pharmacyId,
      buyerId: order.buyerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.amount,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress,
      contactPhone: order.contactPhone,
      comment: order.comment,
      items: order.items.map((item): OrderItemResponse => ({
        id: item.getId(),
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        priceAtTime: item.priceAtTime.amount,
        subtotal: item.getSubtotal().amount,
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
