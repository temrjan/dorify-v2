import { Injectable } from '@nestjs/common';
import type { DeliveryType } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import type { OrderRepository } from '../../domain/repositories/order.repository';
import type { Order } from '../../domain/entities/order.entity';
import type { PaginatedResult, PaginationDto } from '@common/dto/pagination.dto';
import { OrderMapper } from './mappers/order.mapper';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Order | undefined> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return record ? OrderMapper.toDomain(record) : undefined;
  }

  async findByBuyerId(buyerId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>> {
    const where = { buyerId };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: records.map(OrderMapper.toDomain),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findByPharmacyId(pharmacyId: string, pagination: PaginationDto): Promise<PaginatedResult<Order>> {
    const where = { pharmacyId };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: records.map(OrderMapper.toDomain),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPersistence(order);
    const itemsData = order.items.map((item) =>
      OrderMapper.itemToPersistence(item, order.getId()),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.order.upsert({
        where: { id: data.id },
        create: {
          ...data,
          deliveryType: data.deliveryType as DeliveryType,
          items: { create: itemsData.map(({ orderId: _, ...item }) => item) },
        },
        update: {
          status: data.status,
          paymentStatus: data.paymentStatus,
          totalAmount: data.totalAmount,
          deliveryAddress: data.deliveryAddress,
          contactPhone: data.contactPhone,
          comment: data.comment,
        },
      });
    });
  }
}
