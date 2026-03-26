export abstract class ValueObject<T> {
  protected readonly props: Readonly<T>;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(other: ValueObject<T>): boolean {
    if (!other || !other.props) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
