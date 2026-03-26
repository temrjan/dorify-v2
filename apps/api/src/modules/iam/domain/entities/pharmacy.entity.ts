import { BaseEntity } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { PhoneNumber } from '../value-objects/phone-number.vo';

interface PharmacyProps {
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  phone: PhoneNumber;
  license?: string;
  logo?: string;
  isActive: boolean;
  isVerified: boolean;
  deliveryEnabled: boolean;
  deliveryPrice?: number;
  multicardAppId?: string;
  multicardStoreId?: string;
  multicardSecret?: string;
  deletedAt?: Date;
  createdAt: Date;
}

export class Pharmacy extends BaseEntity<PharmacyProps> {
  private constructor(id: string, props: PharmacyProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    address: string;
    phone: PhoneNumber;
    license?: string;
  }): Pharmacy {
    if (params.name.trim().length < 2) {
      throw new DomainError('Pharmacy name must be at least 2 characters');
    }
    if (params.slug.trim().length < 2) {
      throw new DomainError('Pharmacy slug must be at least 2 characters');
    }

    return new Pharmacy(params.id, {
      ownerId: params.ownerId,
      name: params.name.trim(),
      slug: params.slug.trim().toLowerCase(),
      address: params.address,
      phone: params.phone,
      license: params.license,
      isActive: false,
      isVerified: false,
      deliveryEnabled: false,
      createdAt: new Date(),
    });
  }

  static reconstitute(params: {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    description?: string;
    address: string;
    phone: PhoneNumber;
    license?: string;
    logo?: string;
    isActive: boolean;
    isVerified: boolean;
    deliveryEnabled: boolean;
    deliveryPrice?: number;
    multicardAppId?: string;
    multicardStoreId?: string;
    multicardSecret?: string;
    deletedAt?: Date;
    createdAt: Date;
  }): Pharmacy {
    return new Pharmacy(params.id, { ...params });
  }

  verify(): void {
    if (this.props.isVerified) {
      throw new DomainError('Pharmacy is already verified');
    }
    this.props.isVerified = true;
    this.props.isActive = true;
    this.touch();
  }

  activate(): void {
    if (!this.props.isVerified) {
      throw new DomainError('Cannot activate unverified pharmacy');
    }
    this.props.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  updateProfile(params: {
    name?: string;
    description?: string;
    address?: string;
    phone?: PhoneNumber;
    logo?: string;
    deliveryEnabled?: boolean;
    deliveryPrice?: number;
  }): void {
    if (params.name !== undefined) {
      if (params.name.trim().length < 2) {
        throw new DomainError('Pharmacy name must be at least 2 characters');
      }
      this.props.name = params.name.trim();
    }
    if (params.description !== undefined) this.props.description = params.description;
    if (params.address !== undefined) this.props.address = params.address;
    if (params.phone !== undefined) this.props.phone = params.phone;
    if (params.logo !== undefined) this.props.logo = params.logo;
    if (params.deliveryEnabled !== undefined) this.props.deliveryEnabled = params.deliveryEnabled;
    if (params.deliveryPrice !== undefined) this.props.deliveryPrice = params.deliveryPrice;
    this.touch();
  }

  updateMulticardCredentials(params: {
    appId: string;
    storeId: string;
    secret: string;
  }): void {
    this.props.multicardAppId = params.appId;
    this.props.multicardStoreId = params.storeId;
    this.props.multicardSecret = params.secret;
    this.touch();
  }

  hasMulticardCredentials(): boolean {
    return !!(this.props.multicardAppId && this.props.multicardStoreId && this.props.multicardSecret);
  }

  get ownerId(): string { return this.props.ownerId; }
  get name(): string { return this.props.name; }
  get slug(): string { return this.props.slug; }
  get description(): string | undefined { return this.props.description; }
  get address(): string { return this.props.address; }
  get phone(): PhoneNumber { return this.props.phone; }
  get license(): string | undefined { return this.props.license; }
  get logo(): string | undefined { return this.props.logo; }
  get isActive(): boolean { return this.props.isActive; }
  get isVerified(): boolean { return this.props.isVerified; }
  get deliveryEnabled(): boolean { return this.props.deliveryEnabled; }
  get deliveryPrice(): number | undefined { return this.props.deliveryPrice; }
  get multicardAppId(): string | undefined { return this.props.multicardAppId; }
  get multicardStoreId(): string | undefined { return this.props.multicardStoreId; }
  get multicardSecret(): string | undefined { return this.props.multicardSecret; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
}
