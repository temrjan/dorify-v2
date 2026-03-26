import type { Order as PrismaOrder, OrderItem as PrismaOrderItem } from '@prisma/client';
import { Order, OrderStatus, PaymentStatus } from '../../domain/entities/order.entity';
import { OrderItem } from '../../domain/entities/order-item.entity';
import { Money } from '../../../catalog/domain/value-objects/money.vo';

type PrismaOrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };

export class OrderMapper {
  static toDomain(record: PrismaOrderWithItems): Order {
    const items = record.items.map((item) =>
      OrderItem.reconstitute({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        priceAtTime: Money.create(Number(item.priceAtTime)),
      }),
    );

    return Order.reconstitute({
      id: record.id,
      pharmacyId: record.pharmacyId,
      buyerId: record.buyerId,
      items,
      status: record.status as OrderStatus,
      paymentStatus: record.paymentStatus as PaymentStatus,
      totalAmount: Money.create(Number(record.totalAmount)),
      deliveryType: record.deliveryType,
      deliveryAddress: record.deliveryAddress ?? undefined,
      contactPhone: record.contactPhone,
      comment: record.comment ?? undefined,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(order: Order) {
    return {
      id: order.getId(),
      pharmacyId: order.pharmacyId,
      buyerId: order.buyerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.amount,
      deliveryType: order.deliveryType,
      deliveryAddress: order.deliveryAddress ?? null,
      contactPhone: order.contactPhone,
      comment: order.comment ?? null,
    };
  }

  static itemToPersistence(item: OrderItem, orderId: string) {
    return {
      id: item.getId(),
      orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      priceAtTime: item.priceAtTime.amount,
    };
  }
}
