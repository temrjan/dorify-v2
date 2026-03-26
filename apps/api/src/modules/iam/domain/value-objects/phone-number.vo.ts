import { ValueObject } from '@shared/domain';
import { DomainError } from '@shared/domain';

interface PhoneNumberProps {
  value: string;
}

export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private static readonly PATTERN = /^\+?\d{9,15}$/;

  private constructor(value: string) {
    super({ value });
  }

  static create(phone: string): PhoneNumber {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!PhoneNumber.PATTERN.test(cleaned)) {
      throw new DomainError(`Invalid phone number: ${phone}`);
    }
    return new PhoneNumber(cleaned);
  }

  get value(): string {
    return this.props.value;
  }

  get formatted(): string {
    const v = this.props.value;
    if (v.startsWith('+998') && v.length === 13) {
      return `+998 ${v.slice(4, 6)} ${v.slice(6, 9)} ${v.slice(9, 11)} ${v.slice(11)}`;
    }
    return v;
  }
}
