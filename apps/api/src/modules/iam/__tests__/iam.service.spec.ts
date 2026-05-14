import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IamService } from '../application/iam.service';
import { Pharmacy } from '../domain/entities/pharmacy.entity';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import type { UserRepository } from '../domain/repositories/user.repository';
import type { PharmacyRepository } from '../domain/repositories/pharmacy.repository';
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

function createService(pharmacyRepoOverride: Partial<PharmacyRepository> = {}) {
  const pharmacyRepo: PharmacyRepository = {
    findById: jest.fn(),
    findByOwnerId: jest.fn(),
    findBySlug: jest.fn(),
    save: jest.fn(),
    ...pharmacyRepoOverride,
  };
  const userRepo = {} as UserRepository;
  const encryption = {} as EncryptionService;
  const eventEmitter = new EventEmitter2();
  const service = new IamService(userRepo, pharmacyRepo, encryption, eventEmitter);
  return { service, pharmacyRepo };
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
