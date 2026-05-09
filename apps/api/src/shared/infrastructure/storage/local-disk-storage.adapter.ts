import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
// CJS module without typed default export — use TS import-equals.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import sharp = require('sharp');
import { config } from '@core/config/env.config';
import { generateId } from '@shared/domain';
import type { StoragePort, UploadedImage } from '@shared/domain';

const ALLOWED_FORMATS = ['jpg', 'png', 'webp'] as const;
type AllowedFormat = (typeof ALLOWED_FORMATS)[number];
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 82;
const SAFE_SCOPE_RE = /^[a-z0-9-]+$/;

/**
 * Stores uploaded images on the local filesystem (Docker volume in prod).
 * Pipeline:
 *   1. magic-bytes check (file-type) → reject mismatch with claimed MIME
 *   2. sharp resize (max 1200px, preserve aspect) + EXIF strip + WebP convert
 *   3. write to {STORAGE_PATH}/{scope}/{uuid}.webp
 *   4. return URL {STORAGE_BASE_URL}/{scope}/{uuid}.webp
 *
 * Caddy serves /uploads/* statically from the same volume on the host.
 */
@Injectable()
export class LocalDiskStorageAdapter implements StoragePort {
  private readonly logger = new Logger(LocalDiskStorageAdapter.name);

  async uploadImage(buffer: Buffer, scope: string): Promise<UploadedImage> {
    if (!SAFE_SCOPE_RE.test(scope)) {
      throw new BadRequestException(
        `Invalid scope "${scope}" — must match ${SAFE_SCOPE_RE.source}`,
      );
    }
    if (buffer.length > config.STORAGE_MAX_BYTES) {
      throw new BadRequestException(
        `File too large: ${buffer.length} bytes (max ${config.STORAGE_MAX_BYTES})`,
      );
    }

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !this.isAllowed(detected.ext)) {
      throw new BadRequestException(
        `Unsupported image type: ${detected?.mime ?? 'unknown'}. Allowed: jpeg, png, webp.`,
      );
    }

    const optimized = await sharp(buffer)
      .rotate() // honour EXIF orientation, then strip metadata below
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const id = generateId();
    const fileName = `${id}.webp`;
    const dir = path.join(config.STORAGE_PATH, scope);
    const filePath = path.join(dir, fileName);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, optimized);

    const url = `${config.STORAGE_BASE_URL.replace(/\/+$/, '')}/${scope}/${fileName}`;
    this.logger.log(`Uploaded ${detected.ext} → ${url} (${optimized.length} bytes)`);

    return { url, bytes: optimized.length, format: 'webp' };
  }

  async delete(url: string): Promise<void> {
    const base = config.STORAGE_BASE_URL.replace(/\/+$/, '');
    if (!url.startsWith(base + '/')) {
      this.logger.warn(`Refusing delete: URL "${url}" does not match storage base`);
      return;
    }
    const relative = url.slice(base.length + 1);
    if (relative.includes('\0')) {
      this.logger.warn(`Refusing delete: null byte in URL "${url}"`);
      return;
    }

    // Canonical resolve check defeats encoded traversal (../, %2e%2e, etc).
    const baseDir = path.resolve(config.STORAGE_PATH);
    const target = path.resolve(baseDir, relative);
    if (target !== baseDir && !target.startsWith(baseDir + path.sep)) {
      this.logger.warn(`Refusing delete: traversal outside storage "${url}"`);
      return;
    }

    try {
      await fs.unlink(target);
      this.logger.log(`Deleted ${url}`);
    } catch (error) {
      // ENOENT — already gone, treat as success
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private isAllowed(ext: string): ext is AllowedFormat {
    return (ALLOWED_FORMATS as readonly string[]).includes(ext);
  }
}
