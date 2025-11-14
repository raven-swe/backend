import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProviderProfile } from './types/oauth.type';
import { OAuthProviderStrategy } from './strategies/oauth.provider.strategy';
import { GithubOAuthStrategy } from './strategies/oauth.github.strategy';
import { GoogleOAuthStrategy } from './strategies/oauth.google.strategy';
import { SupportedOAuthProvider } from './constants/supported-oauth-providers';
import { ConfigService } from '@nestjs/config';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { AuthService } from './auth.service';
import { OAuthRepository } from './oauth.repository';
import { generateUsernames } from 'src/common/utils/generate-validate-usernames.util';

@Injectable()
export class OAuthService {
  private strategies: Record<SupportedOAuthProvider, OAuthProviderStrategy>;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly oauthRepository: OAuthRepository,
  ) {
    this.strategies = {
      github: new GithubOAuthStrategy(this.config),
      google: new GoogleOAuthStrategy(this.config),
    };
  }

  async handleOauthToken(
    provider: SupportedOAuthProvider,
    providerToken: string,
    deviceType: string,
    ipAddress: string,
    clientType: string,
  ) {
    const strategy = this.strategies[provider];
    if (!strategy) {
      throw new BadRequestException(
        createValidationError('provider', {
          invalidParam: `Unsupported OAuth provider: ${provider}`,
        }),
      );
    }

    const providerProfile = await strategy.validateToken(providerToken, clientType);

    return this.handleOauthProfile(providerProfile, deviceType, ipAddress);
  }

  async handleOauthProfile(
    providerProfile: ProviderProfile,
    deviceType: string,
    ipAddress: string,
  ) {
    // Check if this user already registered with this external account
    const externalAccount = await this.oauthRepository.findExternalAccountWithUser(
      providerProfile.provider,
      providerProfile.id,
    );

    if (externalAccount) {
      return await this.authService.login(
        { id: externalAccount.user.id.toString() },
        deviceType,
        ipAddress,
      );
    } else {
      const userAccount = await this.oauthRepository.findUserByEmail(providerProfile.email);

      if (userAccount) {
        await this.oauthRepository.createExternalAccount(
          userAccount.id,
          providerProfile.provider,
          providerProfile.id,
        );

        const user = {
          id: userAccount.id.toString(),
          username: userAccount.username,
        };

        return await this.authService.login(user, deviceType, ipAddress);
      } else {
        const creationToken = this.jwtService.sign({
          provider: providerProfile.provider,
          providerId: providerProfile.id,
          email: providerProfile.email,
          name: providerProfile.name,
          type: 'creation',
          avatar_url: providerProfile.avatar_url,
        });
        return {
          creationToken,
        };
      }
    }
  }

  async completeOauthRegister(
    creationToken: string,
    birthDate: string,
    deviceType: string,
    ipAddress: string,
  ) {
    let payload: {
      provider: string;
      providerId: string;
      email: string;
      name: string;
      type: string;
      avatar_url: string;
    };

    try {
      payload = this.jwtService.verify(creationToken);

      if (payload.type !== 'creation') {
        throw new BadRequestException(
          createValidationError('creationToken', {
            invalidToken: 'The provided token is not a valid account creation token.',
          }),
        );
      }
    } catch (err: unknown) {
      let reason = 'Invalid or malformed token. Please try again.';

      if (err instanceof Error && err.name === 'TokenExpiredError') {
        reason = 'This creation token has expired. Please restart the registration process.';
      }

      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken: reason,
        }),
      );
    }

    // Check if user already exists (safety check to avoid duplicates)
    const existingUser = await this.oauthRepository.findUserByEmailWithExternalAccounts(
      payload.email,
    );

    // If user exists and has the external account, just log them in
    if (existingUser) {
      const hasExternalAccount = existingUser.userExternalAccounts.some(
        (account) =>
          account.provider === payload.provider && account.providerUserId === payload.providerId, // checking providerId case its the only reliable constant -- github account email might actually change later.
      );

      if (hasExternalAccount) {
        // User already completed registration, just log them in
        // TODO change: until middleware added to idempotency update birthdate if a new request comes in
        await this.oauthRepository.updateUserBirthdate(existingUser.id, new Date(birthDate));

        return await this.authService.login(
          { id: existingUser.id.toString() },
          deviceType,
          ipAddress,
        );
      }

      // User exists but doesn't have this external account (Should not reach here normally)
      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken:
            'An account with this email already exists. Please log in using your existing credentials.',
        }),
      );
    }

    const generated = await generateUsernames(payload.name, payload.email, undefined, 1);
    // Fallback to email if username generation fails
    // VERY VERY UNLIKELY TO HAPPEN
    // TODO HANDLE FIND WITH INDENTIFER IF USERNAME = EMAIL IN CASE TONY MENTIONED

    const username = generated && generated.length > 0 ? generated[0] : payload.email;

    const user = await this.oauthRepository.createUserWithProfileAndExternalAccount(
      payload.email,
      username,
      new Date(birthDate),
      payload.name,
      payload.avatar_url,
      payload.provider,
      payload.providerId,
    );

    return await this.authService.login({ id: user.id.toString() }, deviceType, ipAddress);
  }
}
