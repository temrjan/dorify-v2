import { BaseEntity } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { Money } from '../value-objects/money.vo';
import { Ikpu } from '../value-objects/ikpu.vo';

export enum ProductStatus {
  DRAFT = 'DRAFT',
  PENDING_MODERATION = 'PENDING_MODERATION',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
  EXPIRED = 'EXPIRED',
}

interface ProductProps {
  pharmacyId: string;
  name: string;
  description?: string;
  activeSubstance?: string;
  manufacturer?: string;
  barcode?: string;
  category?: string;
  price: Money;
  imageUrl?: string;
  ikpu?: Ikpu;
  packageCode?: string;
  vat?: number;
  stock: number;
  isAvailable: boolean;
  requiresPrescription: boolean;
  status: ProductStatus;
  moderatedBy?: string;
  moderatedAt?: Date;
  moderationNote?: string;
  deletedAt?: Date;
  createdAt: Date;
}

export class Product extends BaseEntity<ProductProps> {
  private constructor(id: string, props: ProductProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    pharmacyId: string;
    name: string;
    description?: string;
    activeSubstance?: string;
    manufacturer?: string;
    barcode?: string;
    category?: string;
    price: Money;
    imageUrl?: string;
    ikpu?: Ikpu;
    packageCode?: string;
    vat?: number;
    stock?: number;
    requiresPrescription?: boolean;
  }): Product {
    if (params.name.trim().length < 2) {
      throw new DomainError('Product name must be at least 2 characters');
    }
    if (params.price.isZero()) {
      throw new DomainError('Product price must be greater than zero');
    }

    return new Product(params.id, {
      pharmacyId: params.pharmacyId,
      name: params.name.trim(),
      description: params.description,
      activeSubstance: params.activeSubstance,
      manufacturer: params.manufacturer,
      barcode: params.barcode,
      category: params.category,
      price: params.price,
      imageUrl: params.imageUrl,
      ikpu: params.ikpu,
      packageCode: params.packageCode,
      vat: params.vat,
      stock: params.stock ?? 0,
      isAvailable: true,
      requiresPrescription: params.requiresPrescription ?? false,
      status: ProductStatus.DRAFT,
      createdAt: new Date(),
    });
  }

  static reconstitute(params: {
    id: string;
    pharmacyId: string;
    name: string;
    description?: string;
    activeSubstance?: string;
    manufacturer?: string;
    barcode?: string;
    category?: string;
    price: Money;
    imageUrl?: string;
    ikpu?: Ikpu;
    packageCode?: string;
    vat?: number;
    stock: number;
    isAvailable: boolean;
    requiresPrescription: boolean;
    status: ProductStatus;
    moderatedBy?: string;
    moderatedAt?: Date;
    moderationNote?: string;
    deletedAt?: Date;
    createdAt: Date;
  }): Product {
    return new Product(params.id, { ...params });
  }

  // ── Status transitions ────────────────────────────────────

  submitForModeration(): void {
    if (this.props.status !== ProductStatus.DRAFT) {
      throw new DomainError(`Cannot submit for moderation from status ${this.props.status}`);
    }
    this.props.status = ProductStatus.PENDING_MODERATION;
    this.touch();
  }

  publish(moderatorId: string): void {
    const allowed = [ProductStatus.PENDING_MODERATION, ProductStatus.REJECTED, ProductStatus.HIDDEN];
    if (!allowed.includes(this.props.status)) {
      throw new DomainError(`Cannot publish product in status ${this.props.status}`);
    }
    this.props.status = ProductStatus.PUBLISHED;
    this.props.moderatedBy = moderatorId;
    this.props.moderatedAt = new Date();
    this.props.moderationNote = undefined;
    this.touch();
  }

  reject(moderatorId: string, note: string): void {
    if (this.props.status !== ProductStatus.PENDING_MODERATION) {
      throw new DomainError(`Cannot reject product in status ${this.props.status}`);
    }
    if (!note.trim()) {
      throw new DomainError('Rejection note is required');
    }
    this.props.status = ProductStatus.REJECTED;
    this.props.moderatedBy = moderatorId;
    this.props.moderatedAt = new Date();
    this.props.moderationNote = note.trim();
    this.touch();
  }

  hide(): void {
    if (this.props.status !== ProductStatus.PUBLISHED) {
      throw new DomainError(`Cannot hide product in status ${this.props.status}`);
    }
    this.props.status = ProductStatus.HIDDEN;
    this.touch();
  }

  // ── Stock management ──────────────────────────────────────

  decrementStock(quantity: number): void {
    if (quantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }
    if (this.props.stock < quantity) {
      throw new DomainError(
        `Insufficient stock for ${this.props.name}: have ${this.props.stock}, need ${quantity}`,
      );
    }
    this.props.stock -= quantity;
    if (this.props.stock === 0) {
      this.props.isAvailable = false;
    }
    this.touch();
  }

  restoreStock(quantity: number): void {
    if (quantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }
    this.props.stock += quantity;
    this.props.isAvailable = true;
    this.touch();
  }

  hasEnoughStock(quantity: number): boolean {
    return this.props.stock >= quantity;
  }

  // ── Updates ───────────────────────────────────────────────

  updateDetails(params: {
    name?: string;
    description?: string;
    activeSubstance?: string;
    manufacturer?: string;
    barcode?: string;
    category?: string;
    imageUrl?: string;
    requiresPrescription?: boolean;
  }): void {
    if (params.name !== undefined) {
      if (params.name.trim().length < 2) {
        throw new DomainError('Product name must be at least 2 characters');
      }
      this.props.name = params.name.trim();
    }
    if (params.description !== undefined) this.props.description = params.description;
    if (params.activeSubstance !== undefined) this.props.activeSubstance = params.activeSubstance;
    if (params.manufacturer !== undefined) this.props.manufacturer = params.manufacturer;
    if (params.barcode !== undefined) this.props.barcode = params.barcode;
    if (params.category !== undefined) this.props.category = params.category;
    if (params.imageUrl !== undefined) this.props.imageUrl = params.imageUrl;
    if (params.requiresPrescription !== undefined) this.props.requiresPrescription = params.requiresPrescription;
    this.touch();
  }

  updatePrice(price: Money): void {
    if (price.isZero()) {
      throw new DomainError('Product price must be greater than zero');
    }
    this.props.price = price;
    this.touch();
  }

  updateStock(stock: number): void {
    if (stock < 0) {
      throw new DomainError('Stock cannot be negative');
    }
    this.props.stock = stock;
    this.props.isAvailable = stock > 0;
    this.touch();
  }

  updateOfd(params: { ikpu?: Ikpu; packageCode?: string; vat?: number }): void {
    if (params.ikpu !== undefined) this.props.ikpu = params.ikpu;
    if (params.packageCode !== undefined) this.props.packageCode = params.packageCode;
    if (params.vat !== undefined) this.props.vat = params.vat;
    this.touch();
  }

  // ── Getters ───────────────────────────────────────────────

  get pharmacyId(): string { return this.props.pharmacyId; }
  get name(): string { return this.props.name; }
  get description(): string | undefined { return this.props.description; }
  get activeSubstance(): string | undefined { return this.props.activeSubstance; }
  get manufacturer(): string | undefined { return this.props.manufacturer; }
  get barcode(): string | undefined { return this.props.barcode; }
  get category(): string | undefined { return this.props.category; }
  get price(): Money { return this.props.price; }
  get imageUrl(): string | undefined { return this.props.imageUrl; }
  get ikpu(): Ikpu | undefined { return this.props.ikpu; }
  get packageCode(): string | undefined { return this.props.packageCode; }
  get vat(): number | undefined { return this.props.vat; }
  get stock(): number { return this.props.stock; }
  get isAvailable(): boolean { return this.props.isAvailable; }
  get requiresPrescription(): boolean { return this.props.requiresPrescription; }
  get status(): ProductStatus { return this.props.status; }
  get moderatedBy(): string | undefined { return this.props.moderatedBy; }
  get moderatedAt(): Date | undefined { return this.props.moderatedAt; }
  get moderationNote(): string | undefined { return this.props.moderationNote; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }

  isPublished(): boolean {
    return this.props.status === ProductStatus.PUBLISHED;
  }

  canBePurchased(): boolean {
    return this.isPublished() && this.props.isAvailable && this.props.stock > 0;
  }
}
