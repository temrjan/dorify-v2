import { TelegramId } from '../domain/value-objects/telegram-id.vo';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import { User } from '../domain/entities/user.entity';
import { Pharmacy } from '../domain/entities/pharmacy.entity';
import { DomainError } from '../../../shared/domain/domain-error';
import { UserRole } from '../../../common/decorators/roles.decorator';

describe('TelegramId', () => {
  it('should create valid TelegramId', () => {
    const id = TelegramId.create(123456789);
    expect(id.value).toBe(123456789n);
    expect(id.toString()).toBe('123456789');
  });

  it('should reject zero', () => {
    expect(() => TelegramId.create(0)).toThrow(DomainError);
  });

  it('should reject negative', () => {
    expect(() => TelegramId.create(-1)).toThrow(DomainError);
  });

  it('should support bigint input', () => {
    const id = TelegramId.create(9007199254740993n);
    expect(id.value).toBe(9007199254740993n);
  });
});

describe('PhoneNumber', () => {
  it('should create valid UZ phone', () => {
    const phone = PhoneNumber.create('+998901234567');
    expect(phone.value).toBe('+998901234567');
  });

  it('should strip spaces and dashes', () => {
    const phone = PhoneNumber.create('+998 90 123-45-67');
    expect(phone.value).toBe('+998901234567');
  });

  it('should format UZ phone', () => {
    const phone = PhoneNumber.create('+998901234567');
    expect(phone.formatted).toBe('+998 90 123 45 67');
  });

  it('should reject too short', () => {
    expect(() => PhoneNumber.create('12345')).toThrow(DomainError);
  });

  it('should reject letters', () => {
    expect(() => PhoneNumber.create('+998abc')).toThrow(DomainError);
  });
});

describe('User', () => {
  const createUser = () =>
    User.create({
      id: 'user-1',
      telegramId: TelegramId.create(123456789),
      firstName: 'Temur',
      lastName: 'Jan',
      username: 'temrjan',
    });

  it('should create with USER role', () => {
    const user = createUser();
    expect(user.getId()).toBe('user-1');
    expect(user.role).toBe(UserRole.USER);
    expect(user.isBanned).toBe(false);
    expect(user.displayName).toBe('Temur Jan');
  });

  it('should promote to pharmacy owner', () => {
    const user = createUser();
    user.promoteToPharmacyOwner('pharmacy-1');
    expect(user.role).toBe(UserRole.PHARMACY_OWNER);
    expect(user.pharmacyId).toBe('pharmacy-1');
  });

  it('should not promote banned user', () => {
    const user = createUser();
    user.ban();
    expect(() => user.promoteToPharmacyOwner('pharmacy-1')).toThrow('Banned users');
  });

  it('should not promote twice', () => {
    const user = createUser();
    user.promoteToPharmacyOwner('pharmacy-1');
    expect(() => user.promoteToPharmacyOwner('pharmacy-2')).toThrow('already a pharmacy owner');
  });

  it('should ban and unban', () => {
    const user = createUser();
    user.ban();
    expect(user.isBanned).toBe(true);
    user.unban();
    expect(user.isBanned).toBe(false);
  });

  it('should not ban already banned', () => {
    const user = createUser();
    user.ban();
    expect(() => user.ban()).toThrow('already banned');
  });

  it('should update profile', () => {
    const user = createUser();
    user.updateProfile({ firstName: 'Updated', phone: PhoneNumber.create('+998901111111') });
    expect(user.firstName).toBe('Updated');
    expect(user.phone?.value).toBe('+998901111111');
  });
});

describe('Pharmacy', () => {
  const createPharmacy = () =>
    Pharmacy.create({
      id: 'pharmacy-1',
      ownerId: 'user-1',
      name: 'Test Apteka',
      slug: 'test-apteka',
      address: 'ул. Навои 1, Ташкент',
      phone: PhoneNumber.create('+998901234567'),
      license: 'LIC-001',
    });

  it('should create inactive and unverified', () => {
    const pharmacy = createPharmacy();
    expect(pharmacy.isActive).toBe(false);
    expect(pharmacy.isVerified).toBe(false);
    expect(pharmacy.slug).toBe('test-apteka');
  });

  it('should verify and activate', () => {
    const pharmacy = createPharmacy();
    pharmacy.verify();
    expect(pharmacy.isVerified).toBe(true);
    expect(pharmacy.isActive).toBe(true);
  });

  it('should not verify twice', () => {
    const pharmacy = createPharmacy();
    pharmacy.verify();
    expect(() => pharmacy.verify()).toThrow('already verified');
  });

  it('should not activate unverified', () => {
    const pharmacy = createPharmacy();
    expect(() => pharmacy.activate()).toThrow('Cannot activate unverified');
  });

  it('should reject short name', () => {
    expect(() =>
      Pharmacy.create({
        id: 'p-1',
        ownerId: 'u-1',
        name: 'A',
        slug: 'a',
        address: 'addr',
        phone: PhoneNumber.create('+998901234567'),
      }),
    ).toThrow('at least 2 characters');
  });

  it('should update multicard credentials', () => {
    const pharmacy = createPharmacy();
    expect(pharmacy.hasMulticardCredentials()).toBe(false);

    pharmacy.updateMulticardCredentials({
      appId: 'app-123',
      storeId: 'store-456',
      secret: 'secret-789',
    });

    expect(pharmacy.hasMulticardCredentials()).toBe(true);
    expect(pharmacy.multicardAppId).toBe('app-123');
  });

  it('should update profile', () => {
    const pharmacy = createPharmacy();
    pharmacy.updateProfile({ name: 'New Name', deliveryEnabled: true, deliveryPrice: 15000 });
    expect(pharmacy.name).toBe('New Name');
    expect(pharmacy.deliveryEnabled).toBe(true);
    expect(pharmacy.deliveryPrice).toBe(15000);
  });
});
