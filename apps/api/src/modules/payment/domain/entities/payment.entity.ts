import { BaseEntity } from '@shared/domain';
import { DomainError } from '@shared/domain';
import { Money } from '../../../catalog/domain/value-objects/money.vo';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

interface PaymentProps {
  orderId: string;
  pharmacyId: string;
  provider: string;
  status: PaymentStatus;
  amount: Money;
  invoiceId?: string;
  checkoutUrl?: string;
  transactionId?: string;
  cardPan?: string;
  receiptUrl?: string;
  paidAt?: Date;
  createdAt: Date;
}

export class Payment extends BaseEntity<PaymentProps> {
  private constructor(id: string, props: PaymentProps) {
    super(id, props);
  }

  static createPending(params: {
    id: string;
    orderId: string;
    pharmacyId: string;
    amount: Money;
  }): Payment {
    if (params.amount.isZero()) {
      throw new DomainError('Payment amount must be greater than zero');
    }

    return new Payment(params.id, {
      orderId: params.orderId,
      pharmacyId: params.pharmacyId,
      provider: 'MULTICARD',
      status: PaymentStatus.PENDING,
      amount: params.amount,
      createdAt: new Date(),
    });
  }

  static reconstitute(params: {
    id: string;
    orderId: string;
    pharmacyId: string;
    provider: string;
    status: PaymentStatus;
    amount: Money;
    invoiceId?: string;
    checkoutUrl?: string;
    transactionId?: string;
    cardPan?: string;
    receiptUrl?: string;
    paidAt?: Date;
    createdAt: Date;
  }): Payment {
    return new Payment(params.id, { ...params });
  }

  setInvoiceData(invoiceId: string, checkoutUrl: string): void {
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new DomainError(`Cannot set invoice data for payment in status ${this.props.status}`);
    }
    this.props.invoiceId = invoiceId;
    this.props.checkoutUrl = checkoutUrl;
    this.touch();
  }

  /**
   * Mark as paid. Returns false if already paid (idempotent).
   * This is the race-condition-safe method — caller should check return value.
   */
  markPaid(params: {
    transactionId: string;
    cardPan?: string;
    receiptUrl?: string;
  }): boolean {
    if (this.props.status === PaymentStatus.PAID) {
      return false; // Already paid — idempotent
    }
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new DomainError(`Cannot mark payment as paid in status ${this.props.status}`);
    }

    this.props.status = PaymentStatus.PAID;
    this.props.transactionId = params.transactionId;
    this.props.cardPan = params.cardPan;
    this.props.receiptUrl = params.receiptUrl;
    this.props.paidAt = new Date();
    this.touch();
    return true;
  }

  markFailed(): void {
    if (this.props.status === PaymentStatus.PAID) {
      throw new DomainError('Cannot mark paid payment as failed');
    }
    this.props.status = PaymentStatus.FAILED;
    this.touch();
  }

  markExpired(): void {
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new DomainError(`Cannot expire payment in status ${this.props.status}`);
    }
    this.props.status = PaymentStatus.EXPIRED;
    this.touch();
  }

  isPaid(): boolean { return this.props.status === PaymentStatus.PAID; }
  isPending(): boolean { return this.props.status === PaymentStatus.PENDING; }

  get orderId(): string { return this.props.orderId; }
  get pharmacyId(): string { return this.props.pharmacyId; }
  get provider(): string { return this.props.provider; }
  get status(): PaymentStatus { return this.props.status; }
  get amount(): Money { return this.props.amount; }
  get invoiceId(): string | undefined { return this.props.invoiceId; }
  get checkoutUrl(): string | undefined { return this.props.checkoutUrl; }
  get transactionId(): string | undefined { return this.props.transactionId; }
  get cardPan(): string | undefined { return this.props.cardPan; }
  get receiptUrl(): string | undefined { return this.props.receiptUrl; }
  get paidAt(): Date | undefined { return this.props.paidAt; }
  get createdAt(): Date { return this.props.createdAt; }
}
