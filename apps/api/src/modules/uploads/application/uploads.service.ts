import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { STORAGE_PORT } from '@shared/domain';
import type { StoragePort, UploadedImage } from '@shared/domain';

const ALLOWED_SCOPES = ['logos', 'products'] as const;
type AllowedScope = (typeof ALLOWED_SCOPES)[number];

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  uploadImage(buffer: Buffer, scope: string): Promise<UploadedImage> {
    if (!this.isAllowedScope(scope)) {
      throw new BadRequestException(
        `Unknown scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(', ')}.`,
      );
    }
    return this.storage.uploadImage(buffer, scope);
  }

  private isAllowedScope(scope: string): scope is AllowedScope {
    return (ALLOWED_SCOPES as readonly string[]).includes(scope);
  }
}
