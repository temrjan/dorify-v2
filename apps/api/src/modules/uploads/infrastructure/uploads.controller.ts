import {
  Controller,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer'; // augments Express namespace with Multer.File
import { config } from '@core/config/env.config';
import { UploadsService } from '../application/uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
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
