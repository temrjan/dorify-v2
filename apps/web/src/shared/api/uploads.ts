import { apiClient } from './client';

export type UploadScope = 'logos' | 'products';

export interface ImageUploadResponse {
  url: string;
  bytes: number;
  format: string;
}

/**
 * Multipart upload of a single image file.
 *
 * Backend pipeline (LocalDiskStorageAdapter):
 * - magic-bytes check → only JPEG / PNG / WebP accepted
 * - sharp resize to 1200x1200 max, EXIF strip, WebP convert q=82
 * - stored at {STORAGE_PATH}/{scope}/{uuid}.webp
 * - returns CDN-style URL under {STORAGE_BASE_URL}
 *
 * `scope=products` requires the caller to be a PHARMACY_OWNER
 * (enforced server-side via TenantContext); `scope=logos` is open to any
 * authenticated Telegram user so the registration wizard works before
 * role promotion.
 */
export async function uploadImage(file: File, scope: UploadScope): Promise<ImageUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post<ImageUploadResponse>(
    `/uploads/image?scope=${scope}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}
