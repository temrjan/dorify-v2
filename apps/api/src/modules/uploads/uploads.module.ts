import { Module } from '@nestjs/common';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { UploadsController } from './infrastructure/uploads.controller';
import { UploadsService } from './application/uploads.service';
import { UserOrIpThrottlerGuard } from '@shared/infrastructure/throttle/user-or-ip-throttler.guard';

@Module({
  imports: [StorageModule],
  controllers: [UploadsController],
  providers: [UploadsService, UserOrIpThrottlerGuard],
})
export class UploadsModule {}
