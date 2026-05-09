import { randomUUID } from 'crypto';

/**
 * Cryptographically secure ID generator. Uses Node's `crypto.randomUUID()`
 * (UUID v4, 122 bits of entropy, ~5.3×10^36 combinations — non-predictable).
 *
 * Replaces previous `Math.random()`-based `generateCuid()` (audit S-CRIT-3 —
 * predictable IDs enabled enumeration / order-ID guessing).
 */
export function generateId(): string {
  return randomUUID();
}
