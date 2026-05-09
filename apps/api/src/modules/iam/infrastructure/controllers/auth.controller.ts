import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { IamService } from '../../application/iam.service';
import { AdminLoginSchema } from '../../application/dto/auth.dto';
import type { AdminLoginDto, TelegramAuthResponse } from '../../application/dto/auth.dto';

interface RequestUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  role: string;
  pharmacyId?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly iamService: IamService) {}

  @Get('me')
  getCurrentUser(@CurrentUser() user: RequestUser): TelegramAuthResponse {
    return {
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        pharmacyId: user.pharmacyId,
      },
    };
  }

  @Post('admin/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body(new ZodValidationPipe(AdminLoginSchema)) dto: AdminLoginDto) {
    return this.iamService.adminLogin(dto);
  }
}
