import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { STORAGE_PORT } from '@shared/domain';
import type { StoragePort, UploadedImage } from '@shared/domain';
import { TenantContext } from '@shared/infrastructure/tenant/tenant.context';

const ALLOWED_SCOPES = ['logos', 'products'] as const;
type AllowedScope = (typeof ALLOWED_SCOPES)[number];

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  async uploadImage(buffer: Buffer, scope: string): Promise<UploadedImage> {
    if (!this.isAllowedScope(scope)) {
      throw new BadRequestException(
        `Unknown scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(', ')}.`,
      );
    }

    // `scope=logos` is reachable during the pharmacy registration wizard,
    // before the user is promoted to PHARMACY_OWNER — so we don't gate it.
    // `scope=products` requires the caller to already own a pharmacy;
    // TenantContext throws ForbiddenException for plain USER buyers.
    if (scope === 'products') {
      TenantContext.requirePharmacyId();
    }

    return this.storage.uploadImage(buffer, scope);
  }

  private isAllowedScope(scope: string): scope is AllowedScope {
    return (ALLOWED_SCOPES as readonly string[]).includes(scope);
  }
}
