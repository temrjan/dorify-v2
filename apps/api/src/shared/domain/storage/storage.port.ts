/**
 * Port for object storage. Domain-level abstraction so application code
 * doesn't depend on a concrete adapter (local disk, S3, R2, Yandex Object
 * Storage). Implementation registered in infrastructure layer.
 */
export interface UploadedImage {
  /** Public URL the buyer/pharmacy panel will reference. */
  url: string;
  /** Bytes written to storage (post-processing). */
  bytes: number;
  /** Detected image format (jpeg/png/webp) at upload time. */
  format: 'jpeg' | 'png' | 'webp';
}

export interface StoragePort {
  /**
   * Validate, optimize, and persist an image buffer.
   * Implementations enforce magic-bytes type check and size limits.
   * Returns a public URL for storage.
   */
  uploadImage(buffer: Buffer, scope: string): Promise<UploadedImage>;

  /** Delete a previously-uploaded image by its public URL. */
  delete(url: string): Promise<void>;
}

export const STORAGE_PORT = Symbol('STORAGE_PORT');
