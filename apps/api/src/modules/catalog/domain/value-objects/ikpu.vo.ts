import { ValueObject } from '@shared/domain';
import { DomainError } from '@shared/domain';

interface IkpuProps {
  code: string;
}

export class Ikpu extends ValueObject<IkpuProps> {
  private static readonly PATTERN = /^\d{17}$/;
  private static readonly ZERO_CODE = '00000000000000000';

  private constructor(code: string) {
    super({ code });
  }

  static create(code: string): Ikpu {
    if (!Ikpu.PATTERN.test(code)) {
      throw new DomainError(`Invalid IKPU code: ${code}. Must be exactly 17 digits.`);
    }
    if (code === Ikpu.ZERO_CODE) {
      throw new DomainError('Default IKPU code (all zeros) is not allowed. Provide a real IKPU.');
    }
    return new Ikpu(code);
  }

  get code(): string {
    return this.props.code;
  }
}
