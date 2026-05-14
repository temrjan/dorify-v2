import { OnOrderCancelledRestoreStock } from '../application/event-handlers/on-order-cancelled.handler';
import { OrderCancelledEvent } from '../domain/events/order-cancelled.event';
import type { ProductRepository } from '../../catalog/domain/repositories/product.repository';

function createHandler() {
  const productRepo: ProductRepository = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findByPharmacyId: jest.fn(),
    findPublished: jest.fn(),
    findPublishedByPharmacy: jest.fn(),
    save: jest.fn(),
    restoreStockAtomic: jest.fn(),
  };
  const handler = new OnOrderCancelledRestoreStock(productRepo);
  return { handler, productRepo };
}

function buildEvent(items: Array<{ productId: string; quantity: number }>): OrderCancelledEvent {
  return new OrderCancelledEvent({
    orderId: 'order-1',
    pharmacyId: 'pharmacy-1',
    buyerId: 'buyer-1',
    items,
    reason: 'test cancel',
  });
}

describe('OnOrderCancelledRestoreStock — atomic increment (S-HIGH-8)', () => {
  it('calls restoreStockAtomic with mapped items payload', async () => {
    const { handler, productRepo } = createHandler();
    const event = buildEvent([
      { productId: 'p-1', quantity: 2 },
      { productId: 'p-2', quantity: 5 },
    ]);

    await handler.handle(event);

    expect(productRepo.restoreStockAtomic).toHaveBeenCalledTimes(1);
    expect(productRepo.restoreStockAtomic).toHaveBeenCalledWith([
      { productId: 'p-1', quantity: 2 },
      { productId: 'p-2', quantity: 5 },
    ]);
  });

  it('does not use the legacy read-modify-write flow (no findById / save calls)', async () => {
    const { handler, productRepo } = createHandler();
    await handler.handle(buildEvent([{ productId: 'p-1', quantity: 1 }]));

    expect(productRepo.findById).not.toHaveBeenCalled();
    expect(productRepo.save).not.toHaveBeenCalled();
  });

  it('passes through empty items array (no-op safety)', async () => {
    const { handler, productRepo } = createHandler();
    await handler.handle(buildEvent([]));

    expect(productRepo.restoreStockAtomic).toHaveBeenCalledTimes(1);
    expect(productRepo.restoreStockAtomic).toHaveBeenCalledWith([]);
  });
});
