import { Injectable, ConflictException, NotFoundException, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { config } from '@core/config/env.config';
import { generateId } from '@shared/domain';
import { EncryptionService } from '@core/crypto/encryption.service';
import { USER_REPOSITORY } from '../domain/repositories/user.repository';
import type { UserRepository } from '../domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from '../domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../domain/repositories/pharmacy.repository';
import { Pharmacy } from '../domain/entities/pharmacy.entity';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import { PharmacyCreatedEvent, PharmacyVerifiedEvent, PharmacyRejectedEvent } from '../domain/events';
import type { CreatePharmacyDto, UpdatePharmacyDto, UpdatePaymentSettingsDto, PharmacyResponse, PublicPharmacyResponse, PaymentSettingsResponse, SlugAvailabilityResponse } from './dto/pharmacy.dto';
import type { AdminLoginDto, AuthResponse } from './dto/auth.dto';

@Injectable()
export class IamService {
  private readonly logger = new Logger(IamService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacyRepo: PharmacyRepository,
    private readonly encryption: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async adminLogin(dto: AdminLoginDto): Promise<AuthResponse> {
    if (dto.username !== config.ADMIN_USERNAME) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, config.ADMIN_PASSWORD_HASH);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = jwt.sign(
      { sub: 'admin', role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    return {
      accessToken,
      user: { id: 'admin', role: 'ADMIN', firstName: 'Admin' },
    };
  }

  async createPharmacy(ownerId: string, dto: CreatePharmacyDto): Promise<PharmacyResponse> {
    // Pre-flight friendly errors — parallel queries (~33% latency vs sequential).
    // DB unique constraints на ownerId + slug защищают от race; эти checks — UX,
    // не race protection.
    const [existing, slugExists, owner] = await Promise.all([
      this.pharmacyRepo.findByOwnerId(ownerId),
      this.pharmacyRepo.findBySlug(dto.slug),
      this.userRepo.findById(ownerId),
    ]);
    if (existing) {
      throw new ConflictException('User already has a pharmacy');
    }
    if (slugExists) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }
    if (!owner) {
      throw new NotFoundException(`User ${ownerId} not found`);
    }

    const pharmacy = Pharmacy.create({
      id: generateId(),
      ownerId,
      name: dto.name,
      slug: dto.slug,
      address: dto.address,
      phone: PhoneNumber.create(dto.phone),
      license: dto.license,
    });

    // Domain mutation — throws DomainError if owner.isBanned (closes S-MED-6
    // via rollback: createWithOwnerPromotion не commit'ит partial state).
    owner.promoteToPharmacyOwner(pharmacy.getId());

    // Atomic persist — pharmacy create + user role update в одной транзакции
    // (closes S-CRIT-10 orphan pharmacy от partial failure).
    await this.pharmacyRepo.createWithOwnerPromotion(pharmacy, owner);

    // Emit ПОСЛЕ successful commit — иначе rollback оставляет emitted DM
    // без backing row (admin DM на orphan-state).
    this.emit(new PharmacyCreatedEvent({
      pharmacyId: pharmacy.getId(),
      ownerId,
      name: pharmacy.name,
      slug: pharmacy.slug,
    }));

    return this.toPharmacyResponse(pharmacy);
  }

  async verifyPharmacy(pharmacyId: string): Promise<PharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
    if (!pharmacy) {
      throw new NotFoundException(`Pharmacy ${pharmacyId} not found`);
    }

    pharmacy.verify();
    await this.pharmacyRepo.save(pharmacy);

    this.emit(new PharmacyVerifiedEvent({
      pharmacyId: pharmacy.getId(),
      ownerId: pharmacy.ownerId,
      slug: pharmacy.slug,
      name: pharmacy.name,
    }));

    return this.toPharmacyResponse(pharmacy);
  }

  async rejectPharmacy(pharmacyId: string, reason: string): Promise<PharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
    if (!pharmacy) {
      throw new NotFoundException(`Pharmacy ${pharmacyId} not found`);
    }

    pharmacy.reject(reason);
    await this.pharmacyRepo.save(pharmacy);

    this.emit(new PharmacyRejectedEvent({
      pharmacyId: pharmacy.getId(),
      ownerId: pharmacy.ownerId,
      reason,
    }));

    return this.toPharmacyResponse(pharmacy);
  }

  async checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
    const normalized = slug.trim().toLowerCase();
    const existing = await this.pharmacyRepo.findBySlug(normalized);
    if (!existing) {
      return { available: true };
    }

    // Suggest first free numeric suffix (foo → foo-2, foo-3, …)
    for (let i = 2; i <= 99; i++) {
      const candidate = `${normalized}-${i}`;
      const taken = await this.pharmacyRepo.findBySlug(candidate);
      if (!taken) {
        return { available: false, suggestion: candidate };
      }
    }
    return { available: false };
  }

  async getPharmacyProfile(ownerId: string): Promise<PharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }
    return this.toPharmacyResponse(pharmacy);
  }

  async getPharmacyById(pharmacyId: string): Promise<PublicPharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
    if (!pharmacy) {
      throw new NotFoundException(`Pharmacy ${pharmacyId} not found`);
    }
    return this.toPublicPharmacyResponse(pharmacy);
  }

  async updatePharmacyProfile(ownerId: string, dto: UpdatePharmacyDto): Promise<PharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    pharmacy.updateProfile({
      name: dto.name,
      description: dto.description,
      address: dto.address,
      phone: dto.phone ? PhoneNumber.create(dto.phone) : undefined,
      logo: dto.logo,
      deliveryEnabled: dto.deliveryEnabled,
      deliveryPrice: dto.deliveryPrice,
    });

    await this.pharmacyRepo.save(pharmacy);
    return this.toPharmacyResponse(pharmacy);
  }

  async getPaymentSettings(ownerId: string): Promise<PaymentSettingsResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    return {
      multicardAppId: pharmacy.multicardAppId,
      multicardStoreId: pharmacy.multicardStoreId,
      multicardSecret: pharmacy.multicardSecret
        ? this.maskSecret(this.encryption.decrypt(pharmacy.multicardSecret))
        : undefined,
    };
  }

  async updatePaymentSettings(ownerId: string, dto: UpdatePaymentSettingsDto): Promise<PaymentSettingsResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const encryptedSecret = this.encryption.encrypt(dto.multicardSecret);

    pharmacy.updateMulticardCredentials({
      appId: dto.multicardAppId,
      storeId: dto.multicardStoreId,
      secret: encryptedSecret,
    });

    await this.pharmacyRepo.save(pharmacy);

    return {
      multicardAppId: pharmacy.multicardAppId,
      multicardStoreId: pharmacy.multicardStoreId,
      multicardSecret: this.maskSecret(dto.multicardSecret),
    };
  }

  private emit(event: { eventName: string }): void {
    this.eventEmitter.emit(event.eventName, event);
    this.logger.log(`Published event: ${event.eventName}`);
  }

  private maskSecret(plaintext: string): string {
    if (plaintext.length <= 4) return '****';
    return `****${plaintext.slice(-4)}`;
  }

  private toPharmacyResponse(pharmacy: Pharmacy): PharmacyResponse {
    return {
      id: pharmacy.getId(),
      name: pharmacy.name,
      slug: pharmacy.slug,
      description: pharmacy.description,
      address: pharmacy.address,
      phone: pharmacy.phone.value,
      license: pharmacy.license,
      logo: pharmacy.logo,
      isActive: pharmacy.isActive,
      isVerified: pharmacy.isVerified,
      deliveryEnabled: pharmacy.deliveryEnabled,
      deliveryPrice: pharmacy.deliveryPrice,
      hasPaymentSettings: pharmacy.hasMulticardCredentials(),
      createdAt: pharmacy.createdAt.toISOString(),
    };
  }

  private toPublicPharmacyResponse(pharmacy: Pharmacy): PublicPharmacyResponse {
    return {
      id: pharmacy.getId(),
      name: pharmacy.name,
      slug: pharmacy.slug,
      description: pharmacy.description,
      logo: pharmacy.logo,
      isActive: pharmacy.isActive,
      isVerified: pharmacy.isVerified,
      deliveryEnabled: pharmacy.deliveryEnabled,
      deliveryPrice: pharmacy.deliveryPrice,
      hasPaymentSettings: pharmacy.hasMulticardCredentials(),
      createdAt: pharmacy.createdAt.toISOString(),
    };
  }

}
