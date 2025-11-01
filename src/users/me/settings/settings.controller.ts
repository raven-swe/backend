import {
  Body,
  Controller,
  Post,
  Put,
  UseGuards,
  Patch,
  Get,
  Param,
  BadRequestException,
  Req,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Throttle } from '@nestjs/throttler';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser, RequestWithCookies } from 'src/auth/types';
import { UpdateUsernameDto } from 'src/users/dtos/update-username.dto';
import { UpdateBirthDateDto } from 'src/users/dtos/update-birth-date.dto';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from 'src/auth/constants/supported-oauth-providers';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { RemoveUserSSODto } from 'src/users/dtos/remove-user-sso.dto';
import { ChangeCountryDto } from 'src/users/dtos/change-country.dto';
import { ChangeGenderDto } from 'src/users/dtos/change-gender.dto';
import { ChangeLanguageDto } from 'src/users/dtos/change-language.dto';
import { ValidatePasswordDto } from 'src/users/dtos/validate-password.dto';
import { validate } from 'class-validator';
import { RefreshTokenDto } from 'src/auth/dtos';
import { plainToClass } from 'class-transformer';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from 'src/auth/constants/auth.constants';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';

@Controller('me/settings')
export class SettingsController {
  private static readonly EMAIL_UPDATE_LIMIT = 5;
  private static readonly EMAIL_UPDATE_WINDOW = 60000;
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserDetails(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.getUserDetails(userId);
  }

  @Put('email')
  @Throttle({
    default: {
      limit: SettingsController.EMAIL_UPDATE_LIMIT,
      ttl: SettingsController.EMAIL_UPDATE_WINDOW,
    },
  })
  @UseGuards(JwtAuthGuard)
  async inititateEmailUpdate(
    @Body() inititateEmailUpdateDto: InititateEmailUpdateDto,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.checkNewEmail(userId, inititateEmailUpdateDto);
  }

  @Post('email/verify')
  @UseGuards(JwtAuthGuard)
  async verifyUpdateEmailOtp(
    @Body() verifyEmailUpdateDto: VerifyEmailUpdateDto,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.verifyEmailUpdate(userId, verifyEmailUpdateDto);
  }

  @Post('email/resend-otp')
  @UseGuards(JwtAuthGuard)
  async resendUpdateEmailOtp(
    @Body() resendEmailUpdateOtp: ResendEmailUpdateOtp,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.resendEmailUpdateOtp(userId, resendEmailUpdateOtp);
  }

  @Patch('username')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updateUsername(@Body() updateUsernameDto: UpdateUsernameDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.updateUsername(userId, updateUsernameDto);
  }

  @Put('birthdate')
  @UseGuards(JwtAuthGuard)
  async updateBirthDate(@Body() updateBirthDateDto: UpdateBirthDateDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.updateBirthDate(userId, updateBirthDateDto.date);
  }

  @Get('connected-accounts')
  @UseGuards(JwtAuthGuard)
  async getUserSSOs(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.getUserSSOs(userId);
  }

  @Post('connected-accounts/:provider')
  @UseGuards(JwtAuthGuard)
  async removeUserSSO(
    @Body() removeUserSSODto: RemoveUserSSODto,
    @Param('provider') provider: string,
    @User() user: RequestUser,
  ) {
    if (!SUPPORTED_OAUTH_PROVIDERS.includes(provider as SupportedOAuthProvider)) {
      throw new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.INVALID_PROVIDER,
          code: AUTH_ERROR_CODES.INVALID_PROVIDER,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = BigInt(user.id);
    return this.settingsService.removeUserSSO(userId, provider, removeUserSSODto.currentPassword);
  }

  @Get('country')
  @UseGuards(JwtAuthGuard)
  async getCountries() {
    return this.settingsService.getCountries();
  }

  @Put('country')
  @UseGuards(JwtAuthGuard)
  async changeCountry(@Body() changeCountryDto: ChangeCountryDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.changeCountry(userId, changeCountryDto.countryName);
  }

  @Put('gender')
  @UseGuards(JwtAuthGuard)
  async changeGender(@Body() changeGenderDto: ChangeGenderDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);

    if (changeGenderDto.gender !== 'Male' && changeGenderDto.gender !== 'Female') {
      throw new BadRequestException(
        createValidationError('gender', {
          invalidGender: `Invalid gender: ${changeGenderDto.gender}`,
        }),
      );
    }

    return this.settingsService.updateGender(userId, changeGenderDto.gender);
  }

  @Put('language')
  @UseGuards(JwtAuthGuard)
  async updateLanguage(@Body() changeLanguageDto: ChangeLanguageDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);

    if (changeLanguageDto.language !== 'AR' && changeLanguageDto.language !== 'EN') {
      throw new BadRequestException(
        createValidationError('language', {
          invalidLanguage: `Invalid language: ${changeLanguageDto.language}`,
        }),
      );
    }

    return this.settingsService.updateLanguage(userId, changeLanguageDto.language);
  }

  @Post('password/validate')
  @UseGuards(JwtAuthGuard)
  async validatePassword(
    @Body() validatePasswordDto: ValidatePasswordDto,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);

    return this.settingsService.validatePassword(userId, validatePasswordDto.password);
  }

  @Get('/sessions')
  @UseGuards(JwtAuthGuard)
  // notify cross with this change (they will have to send their refresh token when accessing this route)
  async getSessions(
    @User() user: RequestUser,
    @Body() refreshTokenDto: RefreshTokenDto | undefined,
    @Req() req: RequestWithCookies,
  ) {
    const userId = BigInt(user.id);

    let refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      const body = refreshTokenDto && typeof refreshTokenDto === 'object' ? refreshTokenDto : {};
      const dto = plainToClass(RefreshTokenDto, body);
      const errors = await validate(dto);

      if (errors.length > 0) {
        throw new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      refreshToken = dto.refreshToken;
    }

    if (!refreshToken)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.UNAUTHORIZED,
      );

    return this.settingsService.getSessions(userId, refreshToken);
  }

  @Delete('/sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async deleteSession(
    @User() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Body() refreshTokenDto: RefreshTokenDto | undefined,
    @Req() req: RequestWithCookies,
  ) {
    let refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      const body = refreshTokenDto && typeof refreshTokenDto === 'object' ? refreshTokenDto : {};
      const dto = plainToClass(RefreshTokenDto, body);
      const errors = await validate(dto);

      if (errors.length > 0) {
        throw new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      refreshToken = dto.refreshToken;
    }

    if (!refreshToken)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.UNAUTHORIZED,
      );

    const userId = BigInt(user.id);
    const sessId = BigInt(sessionId);
    return this.settingsService.deleteSession(userId, sessId, refreshToken);
  }
}
