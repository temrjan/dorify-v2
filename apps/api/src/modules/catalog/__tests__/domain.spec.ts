import { Money } from '../domain/value-objects/money.vo';
import { Ikpu } from '../domain/value-objects/ikpu.vo';
import { Product, ProductStatus } from '../domain/entities/product.entity';

// ── Money VO ────────────────────────────────────────────────

describe('Money', () => {
  it('should create UZS amount', () => {
    const money = Money.create(15000);
    expect(money.amount).toBe(15000);
    expect(money.currency).toBe('UZS');
  });

  it('should reject negative', () => {
    expect(() => Money.create(-100)).toThrow('cannot be negative');
  });

  it('should reject non-integer UZS', () => {
    expect(() => Money.create(100.5, 'UZS')).toThrow('UZS amount must be integer');
  });

  it('should add correctly', () => {
    const a = Money.create(15000);
    const b = Money.create(25000);
    expect(a.add(b).amount).toBe(40000);
  });

  it('should subtract correctly', () => {
    const a = Money.create(25000);
    const b = Money.create(15000);
    expect(a.subtract(b).amount).toBe(10000);
  });

  it('should reject subtraction resulting in negative', () => {
    const a = Money.create(10000);
    const b = Money.create(20000);
    expect(() => a.subtract(b)).toThrow('Insufficient amount');
  });

  it('should multiply correctly', () => {
    const price = Money.create(15000);
    expect(price.multiply(3).amount).toBe(45000);
  });

  it('should prevent currency mismatch on add', () => {
    const uzs = Money.create(1000, 'UZS');
    const usd = Money.create(100, 'USD');
    expect(() => uzs.add(usd)).toThrow('Currency mismatch');
  });

  it('should compare correctly', () => {
    const a = Money.create(20000);
    const b = Money.create(15000);
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isGreaterThan(a)).toBe(false);
  });

  it('should create zero', () => {
    const zero = Money.zero();
    expect(zero.amount).toBe(0);
    expect(zero.isZero()).toBe(true);
  });

  it('should check equality', () => {
    const a = Money.create(15000);
    const b = Money.create(15000);
    const c = Money.create(20000);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

// ── Ikpu VO ─────────────────────────────────────────────────

describe('Ikpu', () => {
  it('should create valid 17-digit code', () => {
    const ikpu = Ikpu.create('12345678901234567');
    expect(ikpu.code).toBe('12345678901234567');
  });

  it('should reject non-17-digit', () => {
    expect(() => Ikpu.create('1234')).toThrow('Must be exactly 17 digits');
  });

  it('should reject letters', () => {
    expect(() => Ikpu.create('1234567890123456a')).toThrow('Must be exactly 17 digits');
  });

  it('should reject all-zeros default', () => {
    expect(() => Ikpu.create('00000000000000000')).toThrow('Default IKPU code');
  });
});

// ── Product Entity ──────────────────────────────────────────

describe('Product', () => {
  const createProduct = (overrides?: Partial<Parameters<typeof Product.create>[0]>) =>
    Product.create({
      id: 'prod-1',
      pharmacyId: 'pharmacy-1',
      name: 'Парацетамол 500мг',
      price: Money.create(15000),
      stock: 100,
      ...overrides,
    });

  // ── Creation ──────────────────────────────────────────

  it('should create as DRAFT', () => {
    const product = createProduct();
    expect(product.status).toBe(ProductStatus.DRAFT);
    expect(product.isAvailable).toBe(true);
    expect(product.stock).toBe(100);
    expect(product.name).toBe('Парацетамол 500мг');
  });

  it('should reject short name', () => {
    expect(() => createProduct({ name: 'A' })).toThrow('at least 2 characters');
  });

  it('should reject zero price', () => {
    expect(() => createProduct({ price: Money.zero() })).toThrow('greater than zero');
  });

  // ── Status transitions ────────────────────────────────

  it('should submit for moderation', () => {
    const product = createProduct();
    product.submitForModeration();
    expect(product.status).toBe(ProductStatus.PENDING_MODERATION);
  });

  it('should not submit from non-DRAFT', () => {
    const product = createProduct();
    product.submitForModeration();
    expect(() => product.submitForModeration()).toThrow('Cannot submit');
  });

  it('should publish from PENDING_MODERATION', () => {
    const product = createProduct();
    product.submitForModeration();
    product.publish('admin-1');
    expect(product.status).toBe(ProductStatus.PUBLISHED);
    expect(product.moderatedBy).toBe('admin-1');
    expect(product.isPublished()).toBe(true);
  });

  it('should reject from PENDING_MODERATION', () => {
    const product = createProduct();
    product.submitForModeration();
    product.reject('admin-1', 'Missing description');
    expect(product.status).toBe(ProductStatus.REJECTED);
    expect(product.moderationNote).toBe('Missing description');
  });

  it('should require rejection note', () => {
    const product = createProduct();
    product.submitForModeration();
    expect(() => product.reject('admin-1', '')).toThrow('Rejection note is required');
  });

  it('should not reject from DRAFT', () => {
    const product = createProduct();
    expect(() => product.reject('admin-1', 'reason')).toThrow('Cannot reject');
  });

  it('should hide published product', () => {
    const product = createProduct();
    product.submitForModeration();
    product.publish('admin-1');
    product.hide();
    expect(product.status).toBe(ProductStatus.HIDDEN);
  });

  it('should not hide non-published', () => {
    const product = createProduct();
    expect(() => product.hide()).toThrow('Cannot hide');
  });

  it('should re-publish rejected product', () => {
    const product = createProduct();
    product.submitForModeration();
    product.reject('admin-1', 'Bad');
    product.publish('admin-2');
    expect(product.status).toBe(ProductStatus.PUBLISHED);
    expect(product.moderationNote).toBeUndefined();
  });

  // ── Stock management ──────────────────────────────────

  it('should decrement stock', () => {
    const product = createProduct({ stock: 10 });
    product.decrementStock(3);
    expect(product.stock).toBe(7);
    expect(product.isAvailable).toBe(true);
  });

  it('should mark unavailable when stock reaches zero', () => {
    const product = createProduct({ stock: 5 });
    product.decrementStock(5);
    expect(product.stock).toBe(0);
    expect(product.isAvailable).toBe(false);
  });

  it('should reject decrement exceeding stock', () => {
    const product = createProduct({ stock: 3 });
    expect(() => product.decrementStock(5)).toThrow('Insufficient stock');
  });

  it('should reject zero quantity decrement', () => {
    const product = createProduct({ stock: 10 });
    expect(() => product.decrementStock(0)).toThrow('Quantity must be positive');
  });

  it('should restore stock', () => {
    const product = createProduct({ stock: 0 });
    product.restoreStock(5);
    expect(product.stock).toBe(5);
    expect(product.isAvailable).toBe(true);
  });

  it('should check stock availability', () => {
    const product = createProduct({ stock: 10 });
    expect(product.hasEnoughStock(10)).toBe(true);
    expect(product.hasEnoughStock(11)).toBe(false);
  });

  // ── Updates ───────────────────────────────────────────

  it('should update price', () => {
    const product = createProduct();
    product.updatePrice(Money.create(20000));
    expect(product.price.amount).toBe(20000);
  });

  it('should reject zero price update', () => {
    const product = createProduct();
    expect(() => product.updatePrice(Money.zero())).toThrow('greater than zero');
  });

  it('should update stock directly', () => {
    const product = createProduct({ stock: 10 });
    product.updateStock(50);
    expect(product.stock).toBe(50);
    expect(product.isAvailable).toBe(true);
  });

  it('should mark unavailable on zero stock update', () => {
    const product = createProduct({ stock: 10 });
    product.updateStock(0);
    expect(product.isAvailable).toBe(false);
  });

  it('should update OFD', () => {
    const product = createProduct();
    product.updateOfd({ ikpu: Ikpu.create('12345678901234567'), vat: 12 });
    expect(product.ikpu?.code).toBe('12345678901234567');
    expect(product.vat).toBe(12);
  });

  // ── canBePurchased ────────────────────────────────────

  it('should be purchasable when published and in stock', () => {
    const product = createProduct({ stock: 10 });
    product.submitForModeration();
    product.publish('admin-1');
    expect(product.canBePurchased()).toBe(true);
  });

  it('should not be purchasable when draft', () => {
    const product = createProduct({ stock: 10 });
    expect(product.canBePurchased()).toBe(false);
  });

  it('should not be purchasable when out of stock', () => {
    const product = createProduct({ stock: 0 });
    product.submitForModeration();
    product.publish('admin-1');
    expect(product.canBePurchased()).toBe(false);
  });
});
