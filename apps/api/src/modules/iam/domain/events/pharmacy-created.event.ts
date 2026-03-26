import { DomainEvent } from '@shared/domain';

export class PharmacyCreatedEvent extends DomainEvent {
  readonly eventName = 'pharmacy.created';

  constructor(
    public readonly payload: {
      pharmacyId: string;
      ownerId: string;
      name: string;
      slug: string;
    },
  ) {
    super();
  }
}
