import { BaseEntity } from './base-entity';
import type { DomainEvent } from './domain-event';

export abstract class AggregateRoot<T> extends BaseEntity<T> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}
