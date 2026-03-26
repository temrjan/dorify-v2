import { BaseEntity } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { TelegramId } from '../value-objects/telegram-id.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { UserRole } from '@common/decorators/roles.decorator';

interface UserProps {
  telegramId: TelegramId;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  phone?: PhoneNumber;
  role: UserRole;
  isBanned: boolean;
  pharmacyId?: string;
  createdAt: Date;
}

export class User extends BaseEntity<UserProps> {
  private constructor(id: string, props: UserProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    telegramId: TelegramId;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  }): User {
    return new User(params.id, {
      telegramId: params.telegramId,
      firstName: params.firstName,
      lastName: params.lastName,
      username: params.username,
      languageCode: params.languageCode,
      role: UserRole.USER,
      isBanned: false,
      createdAt: new Date(),
    });
  }

  static reconstitute(params: {
    id: string;
    telegramId: TelegramId;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    phone?: PhoneNumber;
    role: UserRole;
    isBanned: boolean;
    pharmacyId?: string;
    createdAt: Date;
  }): User {
    return new User(params.id, {
      telegramId: params.telegramId,
      firstName: params.firstName,
      lastName: params.lastName,
      username: params.username,
      languageCode: params.languageCode,
      phone: params.phone,
      role: params.role,
      isBanned: params.isBanned,
      pharmacyId: params.pharmacyId,
      createdAt: params.createdAt,
    });
  }

  promoteToPharmacyOwner(pharmacyId: string): void {
    if (this.props.isBanned) {
      throw new DomainError('Banned users cannot become pharmacy owners');
    }
    if (this.props.role === UserRole.PHARMACY_OWNER) {
      throw new DomainError('User is already a pharmacy owner');
    }
    this.props.role = UserRole.PHARMACY_OWNER;
    this.props.pharmacyId = pharmacyId;
    this.touch();
  }

  ban(): void {
    if (this.props.isBanned) {
      throw new DomainError('User is already banned');
    }
    this.props.isBanned = true;
    this.touch();
  }

  unban(): void {
    if (!this.props.isBanned) {
      throw new DomainError('User is not banned');
    }
    this.props.isBanned = false;
    this.touch();
  }

  updateProfile(params: {
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: PhoneNumber;
  }): void {
    if (params.firstName !== undefined) this.props.firstName = params.firstName;
    if (params.lastName !== undefined) this.props.lastName = params.lastName;
    if (params.username !== undefined) this.props.username = params.username;
    if (params.phone !== undefined) this.props.phone = params.phone;
    this.touch();
  }

  get telegramId(): TelegramId { return this.props.telegramId; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string | undefined { return this.props.lastName; }
  get username(): string | undefined { return this.props.username; }
  get languageCode(): string | undefined { return this.props.languageCode; }
  get phone(): PhoneNumber | undefined { return this.props.phone; }
  get role(): UserRole { return this.props.role; }
  get isBanned(): boolean { return this.props.isBanned; }
  get pharmacyId(): string | undefined { return this.props.pharmacyId; }
  get createdAt(): Date { return this.props.createdAt; }

  get displayName(): string {
    return this.props.lastName
      ? `${this.props.firstName} ${this.props.lastName}`
      : this.props.firstName;
  }
}
