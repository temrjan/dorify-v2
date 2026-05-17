import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UploadsService } from '../application/uploads.service';
import type { StoragePort, UploadedImage } from '@shared/domain';
import { TenantContext } from '@shared/infrastructure/tenant/tenant.context';

const fakeImage: UploadedImage = { url: 'https://example.invalid/x.webp', bytes: 42, format: 'webp' };

function makeService(): { service: UploadsService; storage: jest.Mocked<StoragePort> } {
  const storage: jest.Mocked<StoragePort> = {
    uploadImage: jest.fn().mockResolvedValue(fakeImage),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new UploadsService(storage), storage };
}

describe('UploadsService — per-scope auth', () => {
  it('rejects unknown scope before touching storage', async () => {
    const { service, storage } = makeService();
    await expect(service.uploadImage(Buffer.from('x'), 'bogus')).rejects.toThrow(BadRequestException);
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it('scope=logos: passes even without TenantContext (wizard pre-promotion path)', async () => {
    const { service, storage } = makeService();
    // No TenantContext.run wrapper — emulates plain USER role mid-onboarding.
    const result = await service.uploadImage(Buffer.from('x'), 'logos');
    expect(result).toEqual(fakeImage);
    expect(storage.uploadImage).toHaveBeenCalledWith(expect.any(Buffer), 'logos');
  });

  it('scope=products: throws ForbiddenException without pharmacyId', async () => {
    const { service, storage } = makeService();
    await TenantContext.run(
      { userId: 'user-1', userRole: 'USER' }, // no pharmacyId
      async () => {
        await expect(service.uploadImage(Buffer.from('x'), 'products')).rejects.toThrow(ForbiddenException);
      },
    );
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it('scope=products: passes for PHARMACY_OWNER with pharmacyId', async () => {
    const { service, storage } = makeService();
    await TenantContext.run(
      { userId: 'user-1', userRole: 'PHARMACY_OWNER', pharmacyId: 'pharm-1' },
      async () => {
        const result = await service.uploadImage(Buffer.from('x'), 'products');
        expect(result).toEqual(fakeImage);
      },
    );
    expect(storage.uploadImage).toHaveBeenCalledWith(expect.any(Buffer), 'products');
  });
});
