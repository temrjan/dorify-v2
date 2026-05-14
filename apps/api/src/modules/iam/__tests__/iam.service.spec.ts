import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IamService } from '../application/iam.service';
import { Pharmacy } from '../domain/entities/pharmacy.entity';
import { User } from '../domain/entities/user.entity';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import { TelegramId } from '../domain/value-objects/telegram-id.vo';
import { UserRole } from '@common/decorators/roles.decorator';
import type { UserRepository } from '../domain/repositories/user.repository';
import type { PharmacyRepository } from '../domain/repositories/pharmacy.repository';
import { DomainError } from '@shared/domain';
import { EncryptionService } from '@core/crypto/encryption.service';

function buildPharmacy(): Pharmacy {
  return Pharmacy.reconstitute({
    id: 'pharmacy-1',
    ownerId: 'owner-1',
    name: 'Test Аптека',
    slug: 'test-apteka',
    description: 'Описание',
    address: 'ул. Навои 1',
    phone: PhoneNumber.create('+998901234567'),
    license: 'LIC-12345',
    logo: 'https://api.dorify.uz/uploads/logos/abc.webp',
    isActive: true,
    isVerified: true,
    deliveryEnabled: true,
    deliveryPrice: 15000,
    createdAt: new Date('2026-05-01T00:00:00Z'),
  });
}

function buildUser(overrides: { isBanned?: boolean; role?: UserRole } = {}): User {
  return User.reconstitute({
    id: 'owner-1',
    telegramId: TelegramId.create(8503214095n),
    firstName: 'Тимур',
    role: overrides.role ?? UserRole.USER,
    isBanned: overrides.isBanned ?? false,
    createdAt: new Date('2026-04-01T00:00:00Z'),
  });
}

function createService(
  pharmacyRepoOverride: Partial<PharmacyRepository> = {},
  userRepoOverride: Partial<UserRepository> = {},
) {
  const pharmacyRepo: PharmacyRepository = {
    findById: jest.fn(),
    findByOwnerId: jest.fn(),
    findBySlug: jest.fn(),
    save: jest.fn(),
    createWithOwnerPromotion: jest.fn(),
    ...pharmacyRepoOverride,
  };
  const userRepo: UserRepository = {
    findById: jest.fn(),
    findByTelegramId: jest.fn(),
    save: jest.fn(),
    ...userRepoOverride,
  };
  const encryption = {} as EncryptionService;
  const eventEmitter = new EventEmitter2();
  const service = new IamService(userRepo, pharmacyRepo, encryption, eventEmitter);
  return { service, pharmacyRepo, userRepo };
}

describe('IamService.getPharmacyById — public projection (S-CRIT-9)', () => {
  it('throws NotFoundException when pharmacy does not exist', async () => {
    const { service } = createService({ findById: jest.fn().mockResolvedValue(undefined) });
    await expect(service.getPharmacyById('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns response without seller PII (address, phone, license)', async () => {
    const { service } = createService({ findById: jest.fn().mockResolvedValue(buildPharmacy()) });
    const response = await service.getPharmacyById('pharmacy-1');

    expect(response).not.toHaveProperty('address');
    expect(response).not.toHaveProperty('phone');
    expect(response).not.toHaveProperty('license');
  });

  it('returns public-safe fields (name, slug, logo, hasPaymentSettings, delivery flags)', async () => {
    const { service } = createService({ findById: jest.fn().mockResolvedValue(buildPharmacy()) });
    const response = await service.getPharmacyById('pharmacy-1');

    expect(response).toMatchObject({
      id: 'pharmacy-1',
      name: 'Test Аптека',
      slug: 'test-apteka',
      description: 'Описание',
      logo: 'https://api.dorify.uz/uploads/logos/abc.webp',
      isActive: true,
      isVerified: true,
      deliveryEnabled: true,
      deliveryPrice: 15000,
      hasPaymentSettings: false,
    });
    expect(response.createdAt).toBe('2026-05-01T00:00:00.000Z');
  });
});

describe('IamService.createPharmacy — atomic create + promote (S-CRIT-10)', () => {
  const dto = {
    name: 'Новая Аптека',
    slug: 'novaya-apteka',
    address: 'ул. Амира Темура 5',
    phone: '+998901234567',
  };

  it('atomically persists pharmacy + promotes owner via createWithOwnerPromotion', async () => {
    const owner = buildUser();
    const createWithOwnerPromotion = jest.fn();
    const { service } = createService(
      {
        findByOwnerId: jest.fn().mockResolvedValue(undefined),
        findBySlug: jest.fn().mockResolvedValue(undefined),
        createWithOwnerPromotion,
      },
      { findById: jest.fn().mockResolvedValue(owner) },
    );

    await service.createPharmacy('owner-1', dto);

    expect(createWithOwnerPromotion).toHaveBeenCalledTimes(1);
    // After promotion: domain state mutated before repo call
    const [pharmacyArg, ownerArg] = createWithOwnerPromotion.mock.calls[0];
    expect(ownerArg.role).toBe(UserRole.PHARMACY_OWNER);
    expect(ownerArg.pharmacyId).toBe(pharmacyArg.getId());
  });

  it('throws NotFoundException when owner user disappeared between auth and create', async () => {
    const { service } = createService(
      {
        findByOwnerId: jest.fn().mockResolvedValue(undefined),
        findBySlug: jest.fn().mockResolvedValue(undefined),
      },
      { findById: jest.fn().mockResolvedValue(undefined) },
    );

    await expect(service.createPharmacy('owner-1', dto)).rejects.toThrow(NotFoundException);
  });

  it('throws DomainError when owner is banned (S-MED-6 — closed via rollback)', async () => {
    const banned = buildUser({ isBanned: true });
    const createWithOwnerPromotion = jest.fn();
    const { service } = createService(
      {
        findByOwnerId: jest.fn().mockResolvedValue(undefined),
        findBySlug: jest.fn().mockResolvedValue(undefined),
        createWithOwnerPromotion,
      },
      { findById: jest.fn().mockResolvedValue(banned) },
    );

    await expect(service.createPharmacy('owner-1', dto)).rejects.toThrow(DomainError);
    expect(createWithOwnerPromotion).not.toHaveBeenCalled();
  });

  it('pre-flight check throws ConflictException when slug already taken', async () => {
    const owner = buildUser();
    const { service } = createService(
      {
        findByOwnerId: jest.fn().mockResolvedValue(undefined),
        findBySlug: jest.fn().mockResolvedValue(buildPharmacy()),
      },
      { findById: jest.fn().mockResolvedValue(owner) },
    );

    await expect(service.createPharmacy('owner-1', dto)).rejects.toThrow(ConflictException);
  });

  it('propagates ConflictException from atomic repo on P2002 race', async () => {
    const owner = buildUser();
    const conflict = new ConflictException('Pharmacy slug already taken');
    const { service } = createService(
      {
        findByOwnerId: jest.fn().mockResolvedValue(undefined),
        findBySlug: jest.fn().mockResolvedValue(undefined),
        createWithOwnerPromotion: jest.fn().mockRejectedValue(conflict),
      },
      { findById: jest.fn().mockResolvedValue(owner) },
    );

    await expect(service.createPharmacy('owner-1', dto)).rejects.toThrow(ConflictException);
  });
});
