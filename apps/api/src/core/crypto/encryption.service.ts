import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { DomainError } from '@shared/domain';

export const ENCRYPTION_KEY_HEX = Symbol('ENCRYPTION_KEY_HEX');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(@Inject(ENCRYPTION_KEY_HEX) keyHex: string) {
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY is required');
    }
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${key.length} bytes`,
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string') {
      throw new DomainError('Plaintext must be a string');
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(blob: string): string {
    if (typeof blob !== 'string' || blob.length === 0) {
      throw new DomainError('Encrypted blob must be a non-empty string');
    }
    const parts = blob.split(':');
    if (parts.length !== 3) {
      throw new DomainError('Invalid encrypted blob format (expected iv:authTag:ciphertext)');
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    if (iv.length !== IV_LENGTH) {
      throw new DomainError(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new DomainError(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`,
      );
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    try {
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch {
      throw new DomainError('Decryption failed (auth tag mismatch or wrong key)');
    }
  }
}
