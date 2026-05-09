import { Module } from '@nestjs/common';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { UploadsController } from './infrastructure/uploads.controller';
import { UploadsService } from './application/uploads.service';

@Module({
  imports: [StorageModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
