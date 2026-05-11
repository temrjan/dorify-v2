import { isAuthDateValid } from '../infrastructure/guards/telegram-auth.guard';

describe('isAuthDateValid', () => {
  const NOW = 1_700_000_000;
  const TTL = 300;

  it('accepts authDate within TTL window (past)', () => {
    expect(isAuthDateValid(NOW - 100, NOW, TTL)).toBe(true);
  });

  it('accepts authDate exactly at TTL boundary', () => {
    expect(isAuthDateValid(NOW - TTL, NOW, TTL)).toBe(true);
  });

  it('rejects authDate older than TTL', () => {
    expect(isAuthDateValid(NOW - TTL - 1, NOW, TTL)).toBe(false);
  });

  it('accepts authDate within clock skew tolerance (slightly future)', () => {
    expect(isAuthDateValid(NOW + 3, NOW, TTL)).toBe(true);
  });

  it('rejects authDate beyond clock skew (replay attack vector — S-CRIT-6)', () => {
    // Без этой проверки `now - authDate` становится сильно отрицательным,
    // прежняя условие `> ttl` всегда false → check passing indefinitely.
    expect(isAuthDateValid(NOW + 86400, NOW, TTL)).toBe(false);
  });

  it('rejects authDate just beyond clock skew window', () => {
    expect(isAuthDateValid(NOW + 6, NOW, TTL)).toBe(false);
  });
});
