import { DomainEvent } from '@shared/domain';

export class PharmacyVerifiedEvent extends DomainEvent {
  readonly eventName = 'pharmacy.verified';

  constructor(
    public readonly payload: {
      pharmacyId: string;
      ownerId: string;
      slug: string;
      name: string;
    },
  ) {
    super();
  }
}
