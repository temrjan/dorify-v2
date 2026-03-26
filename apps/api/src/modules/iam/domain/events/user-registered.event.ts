import { DomainEvent } from '@shared/domain';

export class UserRegisteredEvent extends DomainEvent {
  readonly eventName = 'user.registered';

  constructor(
    public readonly payload: {
      userId: string;
      telegramId: string;
      firstName: string;
    },
  ) {
    super();
  }
}
