import { EventEmitter2 } from '@nestjs/event-emitter';
import { CatalogService } from '../application/catalog.service';
import { Product, ProductStatus } from '../domain/entities/product.entity';
import { Money } from '../domain/value-objects/money.vo';
import type { ProductRepository } from '../domain/repositories/product.repository';
import type { StoragePort } from '@shared/domain';
import { TenantContext } from '@shared/infrastructure/tenant/tenant.context';

function makeProduct(overrides: Partial<{ imageUrl: string; status: ProductStatus }> = {}): Product {
  const product = Product.create({
    id: 'prod-1',
    pharmacyId: 'pharm-1',
    name: 'Парацетамол 500мг',
    price: Money.create(15000),
    stock: 10,
    imageUrl: overrides.imageUrl ?? 'https://api.dorify.uz/uploads/products/abc-123.webp',
  });
  // Default state: PUBLISHED (current auto-publish flow). Tests override via status arg.
  product.autoPublish();
  if (overrides.status === ProductStatus.HIDDEN) product.hide();
  return product;
}

function makeService(): {
  service: CatalogService;
  storage: jest.Mocked<StoragePort>;
  repo: jest.Mocked<ProductRepository>;
} {
  const storage: jest.Mocked<StoragePort> = {
    uploadImage: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const repo: jest.Mocked<ProductRepository> = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findByPharmacyId: jest.fn(),
    findPublished: jest.fn(),
    findPublishedByPharmacy: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    restoreStockAtomic: jest.fn(),
  };
  const emitter = new EventEmitter2();
  return { service: new CatalogService(repo, storage, emitter), storage, repo };
}

describe('CatalogService — image cleanup', () => {
  it('deleteProduct: removes file when product has imageUrl', async () => {
    const { service, storage, repo } = makeService();
    const product = makeProduct({ imageUrl: 'https://api.dorify.uz/uploads/products/abc.webp' });
    repo.findById.mockResolvedValue(product);

    await TenantContext.run(
      { userId: 'user-1', userRole: 'PHARMACY_OWNER', pharmacyId: 'pharm-1' },
      async () => {
        await service.deleteProduct('prod-1');
      },
    );

    expect(storage.delete).toHaveBeenCalledWith('https://api.dorify.uz/uploads/products/abc.webp');
    expect(repo.save).toHaveBeenCalled();
  });

  it('deleteProduct: skips storage.delete when product has no imageUrl', async () => {
    const { service, storage, repo } = makeService();
    const product = Product.create({
      id: 'prod-2',
      pharmacyId: 'pharm-1',
      name: 'Без фото',
      price: Money.create(5000),
    });
    product.autoPublish();
    repo.findById.mockResolvedValue(product);

    await TenantContext.run(
      { userId: 'user-1', userRole: 'PHARMACY_OWNER', pharmacyId: 'pharm-1' },
      async () => {
        await service.deleteProduct('prod-2');
      },
    );

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('deleteProduct: swallows storage.delete failure (catalog op still succeeds)', async () => {
    const { service, storage, repo } = makeService();
    const product = makeProduct();
    repo.findById.mockResolvedValue(product);
    storage.delete.mockRejectedValueOnce(new Error('disk on fire'));

    await expect(
      TenantContext.run(
        { userId: 'user-1', userRole: 'PHARMACY_OWNER', pharmacyId: 'pharm-1' },
        async () => {
          await service.deleteProduct('prod-1');
        },
      ),
    ).resolves.toBeUndefined();

    expect(repo.save).toHaveBeenCalled();
  });

  it('hideProductByAdmin: removes file (violation content)', async () => {
    const { service, storage, repo } = makeService();
    const product = makeProduct({ imageUrl: 'https://api.dorify.uz/uploads/products/violating.webp' });
    repo.findById.mockResolvedValue(product);

    await service.hideProductByAdmin('prod-1', 'bot-admin', { reason: 'Контрафакт' });

    expect(storage.delete).toHaveBeenCalledWith('https://api.dorify.uz/uploads/products/violating.webp');
    expect(product.status).toBe(ProductStatus.HIDDEN);
    expect(product.moderationNote).toBe('Контрафакт');
  });
});
