import {
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import 'multer'; // augments Express namespace with Multer.File
import { config } from '@core/config/env.config';
import { UploadsService } from '../application/uploads.service';
import { UserOrIpThrottlerGuard } from '@shared/infrastructure/throttle/user-or-ip-throttler.guard';

/**
 * Image upload endpoint. Hard limits applied at multiple layers:
 * - Multer `fileSize: 5 MB` (request body cap)
 * - Service-level scope check + tenant gate (для `scope=products`)
 * - Storage adapter magic-bytes / dimension / format validation
 * - {@link UserOrIpThrottlerGuard} — 10 uploads / min / authenticated user
 *   (fallback to IP for unauthenticated). Stops a single abuser from
 *   filling disk via repeated 5 MB requests.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseGuards(UserOrIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('scope') scope?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file field is required (multipart/form-data)');
    }
    if (!scope) {
      throw new BadRequestException('scope query param is required');
    }
    if (file.size > config.STORAGE_MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${config.STORAGE_MAX_BYTES} bytes)`);
    }
    return this.uploads.uploadImage(file.buffer, scope);
  }
}
