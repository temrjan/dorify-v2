import { DomainEvent } from '@shared/domain';

export class PharmacyRejectedEvent extends DomainEvent {
  readonly eventName = 'pharmacy.rejected';

  constructor(
    public readonly payload: {
      pharmacyId: string;
      ownerId: string;
      reason: string;
    },
  ) {
    super();
  }
}
