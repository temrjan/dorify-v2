import { ValueObject } from '@shared/domain';
import { DomainError } from '@shared/domain';

interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  static create(amount: number, currency: string = 'UZS'): Money {
    if (amount < 0) {
      throw new DomainError('Money amount cannot be negative');
    }
    if (currency === 'UZS' && !Number.isInteger(amount)) {
      throw new DomainError('UZS amount must be integer');
    }
    return new Money(amount, currency);
  }

  static zero(currency: string = 'UZS'): Money {
    return new Money(0, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (this.amount < other.amount) {
      throw new DomainError('Insufficient amount for subtraction');
    }
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(Math.round(this.amount * factor), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
