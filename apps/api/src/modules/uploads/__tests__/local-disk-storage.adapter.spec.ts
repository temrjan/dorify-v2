import { promises as fs } from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import sharp = require('sharp');
import { BadRequestException } from '@nestjs/common';
import { config } from '@core/config/env.config';
import { LocalDiskStorageAdapter } from '@shared/infrastructure/storage/local-disk-storage.adapter';

beforeAll(async () => {
  // jest-setup pins STORAGE_PATH to os.tmpdir()/dorify-test-storage.
  await fs.rm(config.STORAGE_PATH, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(config.STORAGE_PATH, { recursive: true, force: true });
});

async function makePngBuffer(): Promise<Buffer> {
  // 4x4 red square — minimal valid PNG.
  return await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe('LocalDiskStorageAdapter', () => {
  const adapter = new LocalDiskStorageAdapter();

  it('uploads valid PNG → writes WebP to disk + returns URL', async () => {
    const png = await makePngBuffer();
    const result = await adapter.uploadImage(png, 'logos');

    const baseEscaped = config.STORAGE_BASE_URL.replace(/[/.-]/g, (c) => `\\${c}`);
    expect(result.url).toMatch(new RegExp(`^${baseEscaped}/logos/.+\\.webp$`));
    expect(result.format).toBe('webp');
    expect(result.bytes).toBeGreaterThan(0);

    const fileName = result.url.split('/').pop()!;
    const filePath = path.join(config.STORAGE_PATH, 'logos', fileName);
    const stat = await fs.stat(filePath);
    expect(stat.size).toBe(result.bytes);
  });

  it('rejects HTML disguised as image (magic bytes mismatch)', async () => {
    const html = Buffer.from('<!DOCTYPE html><script>alert(1)</script>', 'utf8');
    await expect(adapter.uploadImage(html, 'logos')).rejects.toThrow(BadRequestException);
  });

  it('rejects oversized buffer', async () => {
    const big = Buffer.alloc(config.STORAGE_MAX_BYTES + 1, 0xff);
    await expect(adapter.uploadImage(big, 'logos')).rejects.toThrow(/too large/i);
  });

  it('rejects unsafe scope', async () => {
    const png = await makePngBuffer();
    await expect(adapter.uploadImage(png, '../etc')).rejects.toThrow(/Invalid scope/);
    await expect(adapter.uploadImage(png, 'a/b')).rejects.toThrow(/Invalid scope/);
  });

  it('delete removes file by URL; ENOENT not fatal', async () => {
    const png = await makePngBuffer();
    const { url } = await adapter.uploadImage(png, 'logos');

    await adapter.delete(url); // ok
    await expect(adapter.delete(url)).resolves.toBeUndefined(); // gone — still ok

    const fileName = url.split('/').pop()!;
    const filePath = path.join(config.STORAGE_PATH, 'logos', fileName);
    await expect(fs.stat(filePath)).rejects.toThrow();
  });

  it('refuses to delete URLs outside the storage base', async () => {
    await expect(adapter.delete('https://evil.example/x.webp')).resolves.toBeUndefined();
    await expect(
      adapter.delete(`${config.STORAGE_BASE_URL}/../etc/passwd`),
    ).resolves.toBeUndefined();
  });
});
