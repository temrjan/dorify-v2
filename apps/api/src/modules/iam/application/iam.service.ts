import { Injectable, ConflictException, NotFoundException, Inject, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { config } from '@core/config/env.config';
import { USER_REPOSITORY } from '../domain/repositories/user.repository';
import type { UserRepository } from '../domain/repositories/user.repository';
import { PHARMACY_REPOSITORY } from '../domain/repositories/pharmacy.repository';
import type { PharmacyRepository } from '../domain/repositories/pharmacy.repository';
import { Pharmacy } from '../domain/entities/pharmacy.entity';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import type { CreatePharmacyDto, UpdatePharmacyDto, UpdatePaymentSettingsDto, PharmacyResponse, PaymentSettingsResponse } from './dto/pharmacy.dto';
import type { AdminLoginDto, AuthResponse } from './dto/auth.dto';

// Temporary admin credentials (should be in DB in production)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('dorify2026!secure', 10);

@Injectable()
export class IamService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PHARMACY_REPOSITORY) private readonly pharmacyRepo: PharmacyRepository,
  ) {}

  async adminLogin(dto: AdminLoginDto): Promise<AuthResponse> {
    if (dto.username !== ADMIN_USERNAME) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, ADMIN_PASSWORD_HASH);
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
    // Check if user already has a pharmacy
    const existing = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (existing) {
      throw new ConflictException('User already has a pharmacy');
    }

    // Check slug uniqueness
    const slugExists = await this.pharmacyRepo.findBySlug(dto.slug);
    if (slugExists) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const pharmacy = Pharmacy.create({
      id: this.generateCuid(),
      ownerId,
      name: dto.name,
      slug: dto.slug,
      address: dto.address,
      phone: PhoneNumber.create(dto.phone),
      license: dto.license,
    });

    await this.pharmacyRepo.save(pharmacy);

    // Promote user to pharmacy owner
    const user = await this.userRepo.findById(ownerId);
    if (user) {
      user.promoteToPharmacyOwner(pharmacy.getId());
      await this.userRepo.save(user);
    }

    return this.toPharmacyResponse(pharmacy);
  }

  async getPharmacyProfile(ownerId: string): Promise<PharmacyResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }
    return this.toPharmacyResponse(pharmacy);
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
        ? `****${pharmacy.multicardSecret.slice(-4)}`
        : undefined,
    };
  }

  async updatePaymentSettings(ownerId: string, dto: UpdatePaymentSettingsDto): Promise<PaymentSettingsResponse> {
    const pharmacy = await this.pharmacyRepo.findByOwnerId(ownerId);
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    pharmacy.updateMulticardCredentials({
      appId: dto.multicardAppId,
      storeId: dto.multicardStoreId,
      secret: dto.multicardSecret,
    });

    await this.pharmacyRepo.save(pharmacy);

    return {
      multicardAppId: pharmacy.multicardAppId,
      multicardStoreId: pharmacy.multicardStoreId,
      multicardSecret: `****${dto.multicardSecret.slice(-4)}`,
    };
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

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
