import {
  Body,
  Controller,
  Put,
  Get,
  Patch,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { RATE_LIMIT } from 'src/common/constants/rate-limit.constants';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { IMAGE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from 'src/media/constants/media.constant';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { ParseJsonBodyPipe } from '../pipes/parse-json-body.pipe';
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Put('password')
  @Throttle({
    default: {
      limit: RATE_LIMIT.PASSWORD_CHANGE.LIMIT,
      ttl: RATE_LIMIT.PASSWORD_CHANGE.WINDOW_MS,
    },
  })
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordBasicDto,
    @User() user: RequestUser,
  ) {
    const userIdBigInt = BigInt(user.id);
    return this.usersService.changePassword(userIdBigInt, changePasswordDto);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        fileFilter: (req, file, callback) => {
          const ext = file.originalname.split('.').pop()?.toLowerCase();
          if (!ext || !IMAGE_EXTENSIONS.includes(ext)) {
            return callback(
              new BadRequestException(
                createValidationError(file.fieldname, {
                  invalidFileType: 'Only image files are allowed (jpg, jpeg, png).',
                }),
              ),
              false,
            );
          }

          callback(null, true);
        },
        limits: { fileSize: MAX_FILE_SIZE_BYTES },
      },
    ),
  )
  async updateProfile(
    @User() user: RequestUser,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
    @Body('data', ParseJsonBodyPipe) updateProfileDto: UpdateProfileDto,
  ) {
    const userId = BigInt(user.id);
    return await this.usersService.updateProfile(userId, updateProfileDto, files);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@User() user: RequestUser) {
    return this.usersService.getUserProfile('', BigInt(user.id), true);
  }
}
