import { Module } from '@nestjs/common';
import { STORAGE_PORT } from '@shared/domain';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

@Module({
  providers: [
    LocalDiskStorageAdapter,
    { provide: STORAGE_PORT, useExisting: LocalDiskStorageAdapter },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
