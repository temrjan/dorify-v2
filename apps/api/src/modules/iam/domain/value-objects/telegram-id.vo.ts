import { ValueObject } from '@shared/domain';
import { DomainError } from '@shared/domain';

interface TelegramIdProps {
  value: bigint;
}

export class TelegramId extends ValueObject<TelegramIdProps> {
  private constructor(value: bigint) {
    super({ value });
  }

  static create(value: bigint | number): TelegramId {
    const bigValue = BigInt(value);
    if (bigValue <= 0n) {
      throw new DomainError('TelegramId must be a positive number');
    }
    return new TelegramId(bigValue);
  }

  get value(): bigint {
    return this.props.value;
  }

  toString(): string {
    return this.props.value.toString();
  }
}
