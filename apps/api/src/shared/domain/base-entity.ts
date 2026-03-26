export abstract class BaseEntity<T> {
  protected readonly id: string;
  protected props: T;
  private updatedAt: Date;

  protected constructor(id: string, props: T) {
    this.id = id;
    this.props = props;
    this.updatedAt = new Date();
  }

  getId(): string {
    return this.id;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }

  equals(other: BaseEntity<T>): boolean {
    if (!other) return false;
    return this.id === other.getId();
  }
}
