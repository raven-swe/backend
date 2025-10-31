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
import {
  ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from 'src/media/constants/media.constant';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
    @Body('data') updateProfileDto: string | UpdateProfileDto,
  ) {
    const userId = BigInt(user.id);

    let parsedDto: UpdateProfileDto;

    if (typeof updateProfileDto === 'string') {
      try {
        const rawDto = JSON.parse(updateProfileDto) as object;
        // Transform plain object to an instance of UpdateProfileDto
        parsedDto = plainToInstance(UpdateProfileDto, rawDto);
        console.log('Parsed DTO:', parsedDto);
      } catch (error) {
        throw new BadRequestException(
          createValidationError('data', {
            invalidJson: 'The "data" field must be a valid JSON string.',
          }),
        );
      }
    } else {
      parsedDto = updateProfileDto;
    }

    // Manual validation after parsing
    // const errors = await validate(parsedDto);
    // if (errors.length > 0) {
    //   // You can format these errors as needed.
    //   // For simplicity, throwing a BadRequestException with the first error.
    //   const firstError = errors[0].constraints
    //     ? Object.values(errors[0].constraints)[0]
    //     : 'Validation error';
    //   throw new BadRequestException(
    //     createValidationError(errors[0].property, {
    //       validationFailed: firstError,
    //     }),
    //   );
    // }
    return await this.usersService.updateProfile(userId, parsedDto, files);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@User() user: RequestUser) {
    return this.usersService.getUserProfile('', BigInt(user.id), true);
  }
}
