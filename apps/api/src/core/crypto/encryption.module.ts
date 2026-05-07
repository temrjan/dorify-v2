import { Global, Module } from '@nestjs/common';
import { config } from '@core/config/env.config';
import { ENCRYPTION_KEY_HEX, EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [
    { provide: ENCRYPTION_KEY_HEX, useValue: config.ENCRYPTION_KEY },
    EncryptionService,
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
