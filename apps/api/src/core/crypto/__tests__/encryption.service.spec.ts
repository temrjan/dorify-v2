import { randomBytes } from 'crypto';
import { EncryptionService } from '../encryption.service';

const TEST_KEY_HEX = randomBytes(32).toString('hex');

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(TEST_KEY_HEX);
  });

  it('should encrypt and decrypt roundtrip', () => {
    const plaintext = 'multicard-secret-Pw18axeBFo8V7NamKHXX';
    const blob = service.encrypt(plaintext);
    expect(blob).not.toContain(plaintext);
    expect(blob.split(':')).toHaveLength(3);
    expect(service.decrypt(blob)).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const blob1 = service.encrypt('same-secret');
    const blob2 = service.encrypt('same-secret');
    expect(blob1).not.toBe(blob2);
    expect(service.decrypt(blob1)).toBe(service.decrypt(blob2));
  });

  it('should handle empty string and unicode', () => {
    expect(service.decrypt(service.encrypt(''))).toBe('');
    expect(service.decrypt(service.encrypt('секрет 🔐 ÿü'))).toBe('секрет 🔐 ÿü');
  });

  it('should reject malformed blob — wrong number of parts', () => {
    expect(() => service.decrypt('only-two:parts')).toThrow('Invalid encrypted blob format');
    expect(() => service.decrypt('a:b:c:d')).toThrow('Invalid encrypted blob format');
  });

  it('should reject empty blob', () => {
    expect(() => service.decrypt('')).toThrow('non-empty');
  });

  it('should reject wrong IV length', () => {
    const blob = service.encrypt('test');
    const [, authTag, ciphertext] = blob.split(':');
    const badIv = Buffer.alloc(8).toString('base64');
    expect(() => service.decrypt(`${badIv}:${authTag}:${ciphertext}`)).toThrow('Invalid IV length');
  });

  it('should reject tampered ciphertext (auth tag mismatch)', () => {
    const blob = service.encrypt('original');
    const [iv, authTag, ciphertext] = blob.split(':');
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[0] = tampered[0] ^ 0xff;
    const tamperedB64 = tampered.toString('base64');
    expect(() => service.decrypt(`${iv}:${authTag}:${tamperedB64}`)).toThrow('Decryption failed');
  });

  it('should reject decryption with wrong key', () => {
    const blob = service.encrypt('secret');
    const otherService = new EncryptionService(randomBytes(32).toString('hex'));
    expect(() => otherService.decrypt(blob)).toThrow('Decryption failed');
  });

  it('should reject non-string plaintext', () => {
    expect(() => service.encrypt(null as unknown as string)).toThrow('Plaintext must be a string');
    expect(() => service.encrypt(undefined as unknown as string)).toThrow('Plaintext must be a string');
  });

  it('should reject invalid key length in constructor', () => {
    const shortKey = randomBytes(16).toString('hex');
    expect(() => new EncryptionService(shortKey)).toThrow('must be 32 bytes');
  });

  it('should reject empty key', () => {
    expect(() => new EncryptionService('')).toThrow('required');
  });
});
