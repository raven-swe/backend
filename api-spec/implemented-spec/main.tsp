import "@typespec/http";
import "@typespec/openapi3";

using Http;

@service(#{ title: "Raven" })
@server("https://example.com", "Single server endpoint")
namespace Raven;

@doc("JWT bearer token authentication")
model BearerAuth {
  type: "http";
  scheme: "bearer";
  bearerFormat: "JWT";
}

model SetAuthCookieResponse {
  @header("Set-Cookie")
  @doc("Contains the HTTP-only refresh token cookie for web clients.")
  setCookie: string;
}

@doc("Base structure for all API responses")
model ApiResponseBase {
  @doc("Indicates whether the request was successful")
  success: boolean;

  @doc("Optional human-readable message")
  message?: string;
}

@doc("Cursor-based pagination for infinite scrolling")
model CursorPagination {
  @doc("The current cursor position")
  cursor?: string | null;

  @doc("The next cursor position for fetching the next set of data")
  nextCursor?: string | null;

  @doc("Indicates if there are more pages to fetch")
  hasNextPage: boolean;
}

@doc("Success response wrapper with data")
model ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

@doc("Success response wrapper with data and pagination")
model ApiSuccessResponseWithPagination<T> {
  success: true;
  message?: string;
  data: T;
  pagination: CursorPagination;
}

@doc("Success response for operations that only return a message (like POST/DELETE)")
model ApiMessageResponse {
  success: true;
  message: string;
}

@doc("Error response wrapper")
model ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message?: string;
  };
}

@doc("Validation error response wrapper")
model ApiValidationErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR";
    message?: string;
    errors: {
      field: string;
      code: string;
      message?: string;
    }[];
  };
}

@doc("Standard error codes used across the API")
enum ErrorCode {
  // Authentication & Authorization (401, 403)
  INVALID_TOKEN: "INVALID_TOKEN",

  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",

  INVALID_INPUT: "INVALID_INPUT",

  // Resource errors (404, 409)
  NOT_FOUND: "NOT_FOUND",

  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
}

@doc("Validation-specific error codes")
enum ValidationErrorCode {
  REQUIRED_FIELD: "REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  INVALID_LENGTH: "INVALID_LENGTH",
  INVALID_VALUE: "INVALID_VALUE",
}

@doc("Standard 400 Bad Request response")
model BadRequestResponse {
  ...Response<400>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 401 Unauthorized response")
model UnauthorizedResponse {
  ...Response<401>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 403 Forbidden response")
model ForbiddenResponse {
  ...Response<403>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 404 Not Found response")
model NotFoundResponse {
  ...Response<404>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 409 Conflict response")
model ConflictResponse {
  ...Response<409>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 422 Validation Error response")
model ValidationErrorResponse {
  ...Response<422>;
  ...Body<ApiValidationErrorResponse>;
}

@doc("Standard 429 Rate Limit Exceeded response")
model RateLimitResponse {
  ...Response<429>;
  ...Body<ApiErrorResponse>;
}

@doc("Standard 500 Internal Server Error response")
model InternalServerErrorResponse {
  ...Response<500>;
  ...Body<ApiErrorResponse>;
}

model RegisterStartBody {
  name: string;
  email: string;
  birthDate: plainDate;
  recaptchaToken: string; // token from client side recaptcha v2
}

model DataResponse<T> {
  ...OkResponse;
  ...Body<ApiSuccessResponse<T>>;
}

model DataResponseWithPagination<T> {
  ...OkResponse;
  ...Body<ApiSuccessResponseWithPagination<T>>;
}

model MessageResponse<TMessage extends string> {
  ...OkResponse;
  ...Body<{
    success: true;
    message: TMessage;
  }>;
}

@doc("Entity mention in bio")
model MentionEntity {
  @doc("The username of the mentioned user")
  username: string; //we expose text but store as user id and hydrate

  @doc("Start position of the mention in the bio text")
  startPosition: int32;
}

@doc("Entity hashtag in bio")
model HashtagEntity {
  @doc("The hashtag text (without #)")
  hashtag: string;

  @doc("Start position of the hashtag in the bio text")
  startPosition: int32;
}

@doc("Bio entities containing mentions and hashtags")
model BioEntities {
  @doc("Array of mention entities in the bio")
  mentions?: MentionEntity[];

  @doc("Array of hashtag entities in the bio")
  hashtags?: HashtagEntity[];
}

@doc("Complete user profile with full account details and relationship context.")
model UserProfile {
  ...PublicUser;

  @doc("Relationship state between the authenticated user and this profile user, including blocks and mutes.")
  relationship: UserRelationship | null; // null if get my profile

  @doc("The number of users this user is following")
  followingCount: int64;

  @doc("The number of followers this user has")
  followersCount: int64;

  @doc("The number of mutual followers shared with the authenticated user")
  mutualsCount: int64 | null;

  @doc("Display names of up to 3 mutual followers shown before clicking 'View all mutuals'")
  @maxItems(3)
  mutualNames: string[] | null;
}

@doc("Compact user(followers/following) lists")
model CompactUser {
  @doc("The user's unique, public-facing username.")
  @minLength(1)
  username: string;

  @doc("The user's display name.")
  @minLength(1)
  @maxLength(100)
  displayName: string;

  @doc("The user's bio (max 160 characters).")
  @maxLength(160)
  bio: string | null;

  @doc("Entities in the bio (mentions and hashtags)")
  bioEntities: BioEntities | null;

  @doc("URL to the user's avatar image")
  avatarUrl: string | null;
}

@doc("Public-facing user profile (visible to others)")
model PublicUser {
  ...CompactUser;

  @doc("URL to the user's banner image")
  bannerUrl: string | null;

  @doc("User's location")
  @maxLength(100)
  location: string | null;

  @doc("User's website URL")
  @maxLength(255)
  websiteUrl: string | null;

  @doc("User's date of birth (YYYY-MM-DD)")
  birthDate: plainDate | null;

  @doc("Date when the user joined")
  joinedAt: utcDateTime;
}

@doc("Relationship state between the current user and the subject user. Defines blocking and muting status")
model UserRelationship {
  @doc("True if the current user has blocked this user, preventing them from viewing their profile or interacting.")
  blocking: boolean;

  @doc("True if this user has blocked the current user.")
  blockedBy: boolean;

  @doc("True if the current user has muted this user, hiding their posts from the feed without unfollowing.")
  muted: boolean;

  @doc("Is the user followed by the current logged-in user")
  following: boolean;

  @doc("Is the user following the current logged-in user")
  follower: boolean;
}

@doc("Extended user metadata displayed in hover cards and user previews")
model UserPreview {
  ...UserMetadataWithBio;

  @doc("The number of users this user is following")
  followingCount: int64;

  @doc("The number of followers this user has")
  followersCount: int64;

  @doc("The number of mutual followers shared with the authenticated user")
  mutualsCount: int64 | null;

  @doc("Display names of up to 3 mutual followers shown before clicking 'View all mutuals'")
  @maxItems(3)
  mutualNames: string[] | null;
}

@doc("Metadata for user sent in suggestions/tweets/search results/etc.")
model UserMetadata {
  @doc("The user's unique, public-facing username.")
  @minLength(1)
  username: string;

  @doc("The user's display name.")
  @minLength(1)
  @maxLength(100)
  displayName: string;

  @doc("URL to the user's avatar image")
  avatarUrl: string;
}

model UserMetadataWithFollowInfo {
  ...UserMetadata;

  @doc("Is the user followed by the current logged-in user")
  isFollowing: boolean | null;

  @doc("Is the user following the current logged-in user")
  isFollower: boolean | null;
}

@doc("User metadata with biography information")
model UserMetadataWithBio {
  ...UserMetadataWithFollowInfo;

  @doc("The user's biography with structured entities")
  bio: UserBio | null;
}

@doc("User's biography with structured entities")
model UserBio {
  @doc("The user's bio text (max 160 characters)")
  @maxLength(160)
  text: string | null;

  @doc("Structured entities found in the bio (mentions and hashtags)")
  bioEntities: BioEntities | null;
}

@doc("Request body for updating profile")
model UpdateProfileRequest {
  @doc("The user's display name.")
  @minLength(1)
  @maxLength(100)
  displayName?: string;

  @doc("The user's bio (max 160 characters).")
  @maxLength(160)
  bio?: string | null;

  @doc("User's location")
  @maxLength(100)
  location?: string | null;

  @doc("User's website URL")
  @maxLength(255)
  websiteUrl?: string | null;

  @doc("Birth date in YYYY-MM-DD format")
  birthDate?: plainDate | null;

  @doc("URL to the user's avatar image. Must be a valid URL (https://www.example.com).")
  @maxLength(255)
  avatarUrl?: string | null;

  @doc("URL to the user's banner image. Must be a valid URL (https://www.example.com).")
  @maxLength(255)
  bannerUrl?: string | null;
}

model UpdatedProfile {
  @doc("The user's display name.")
  displayName: string | null;
  
  @doc("The user's bio (max 160 characters).")
  bio: string | null;

  @doc("The user's bio entities (hashtags, mentions).")
  bioEntities: BioEntities | null;

  @doc("The user's location.")
  location: string | null;

  @doc("The user's website URL.")
  websiteUrl: string | null;

  @doc("URL to the user's avatar image")
  avatarUrl: string | null;

  @doc("URL to the user's banner image")
  bannerUrl: string | null;

  @doc("The timestamp when the profile was last updated.")
  updatedAt: utcDateTime;
}


@tag("Auth")
@route("/auth")
namespace Auth {
  @route("/register")
  namespace Register {
    @post
    @route("/start")
    op startRegister(@body body: RegisterStartBody):
      | DataResponse<{
          creationToken: string;
        }>
      | ValidationErrorResponse
      | ConflictResponse
      | RateLimitResponse
      | InternalServerErrorResponse;

    @post
    @route("/verify")
    op verifyRegister(
      @body body: {
        creationToken: string;
        otp: string;
      },
    ):
      | MessageResponse<"Registration verified successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @post
    @route("/resend-otp")
    op resendOtp(
      @body body: {
        creationToken: string;
      },
    ):
      | MessageResponse<"otp resent successfully.">
      | BadRequestResponse
      | RateLimitResponse
      | InternalServerErrorResponse;

    @post
    @summary("Complete the registration process by setting a password")
    @route("/complete")
    op completeRegister(
      @body body: {
        creationToken: string;
        password: string;
      },
    ):
      | DataResponse<{
          accessToken: string;
          refreshToken: string;
        }>
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;
  }
    @route("/password")
    namespace Password {
      @post
      @route("/forgot")
      @summary("Initiate the password reset process")
      op forgotPassword(
        @body body: {
          identifier: string;
          recaptchaToken: string; // token from client side recaptcha v2
        },
      ):
        | DataResponse<{
            confirmationToken: string;
          }>
        | ValidationErrorResponse
        | NotFoundResponse
        | RateLimitResponse
        | InternalServerErrorResponse
        | BadRequestResponse;

    @post
    @route("/forgot/verify")
    @summary("Verify the OTP for password reset")
    op verifyForgotPassword(
      @body body: {
        confirmationToken: string;
        otp: string;
      },
    ):
      | MessageResponse<"Password reset verified successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @post
    @route("/reset")
    @summary("Reset the password using the confirmation token")
    op resetPassword(
      @body body: {
        confirmationToken: string;
        newPassword: string;
      },
    ):
      | MessageResponse<"Password has been reset successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @post
    @route("/resend-otp")
    @summary("Resend the OTP for password reset")
    op resendOtpPassword(
      @body body: {
        confirmationToken: string;
      },
    ):
      | MessageResponse<"OTP resent successfully.">
      | BadRequestResponse
      | RateLimitResponse
      | InternalServerErrorResponse;
  }
  
  @get
  @route("/check-email")
  op checkEmail(@query email: string): DataResponse<{
    exists: boolean;
  }> | ValidationErrorResponse | InternalServerErrorResponse;

  @post
  @route("/login")
  op login(
    @header("X-Client-Type") clientType: "web" | "mobile",
    @body body: {
      identifier: string;
      password: string;
    },
  ):
    | (DataResponse<{
        accessToken: string;
        refreshToken: string;
      }> &
        SetAuthCookieResponse)
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @summary("Check if a username or email is already taken")
  @route("/check-identifier")
  op checkIdentifier(@query identifier: string): DataResponse<{
    exists: boolean;
    type: "username" | "email";
  }> | ValidationErrorResponse | InternalServerErrorResponse;

  @post
  @route("/logout")
  @doc("refresh token is required in cookie from web clints and in body from mobile clients")
  @summary("refresh token is required in cookie from web clints and in body from mobile clients")
  @useAuth(BearerAuth)
  op logout(
    @header("X-Client-Type") clientType: "web" | "mobile",
    @cookie("refreshToken") refreshToken?: string,
    @body body?: {
      refreshToken: string;
    },
  ): MessageResponse<"Logged out successfully."> | UnauthorizedResponse | InternalServerErrorResponse;

  @post
  @route("/refresh-token")
  @doc("refresh token is required in cookie from web clints and in body from mobile clients")
  @summary("refresh token is required in cookie from web clints and in body from mobile clients")
  op refreshToken(
    @header("X-Client-Type") clientType: "web" | "mobile",
    @cookie("refreshToken") refreshToken?: string,
    @body body?: {
      refreshToken: string;
    },
  ):
    | DataResponse<{
        accessToken: string;
        refreshToken: string;
      }>
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

}

@tag("Me")
@route("/me")
@useAuth(BearerAuth)
namespace Me {
  @put
  @route("/password")
  @summary("Change the authenticated user's password")
  op changeMyPassword(
    @body body: {
      currentPassword: string;
      newPassword: string;
    },
  ):
    | MessageResponse<"Password changed successfully.">
    | UnauthorizedResponse
    | ValidationErrorResponse
    | InternalServerErrorResponse;

  @get
  @summary("Get the authenticated user's profile")
  op getMyProfile(): DataResponse<UserProfile> | UnauthorizedResponse | InternalServerErrorResponse;

  @patch(#{ implicitOptionality: true })
  @summary("Update the authenticated user's profile")
  op updateMyProfile(@body body: UpdateProfileRequest):
    | DataResponse<UpdatedProfile>
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @useAuth(BearerAuth)
  @route("/settings")
  namespace Settings {
    @put
    @route("/email")
    @summary("Initiates update of the authenticated user's email address")
    op updateEmail(
      @body body: {
        newEmail: string;
      },
    ):
      | DataResponse<{
          confirmationToken: string;
        }>
      | ValidationErrorResponse
      | ConflictResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @post
    @route("/email/resend-otp")
    @summary("Resend the verification code to the new email address")
    op resendEmailVerificationOtp(
      @body body: {
        confirmationToken: string;
      },
    ):
      | MessageResponse<"Verification code resent successfully.">
      | BadRequestResponse
      | RateLimitResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @post
    @route("/email/verify")
    @summary("Verify the new email address using the code sent to the new email, invalidates SSOs using the same email")
    op verifyNewEmail(
      @body body: {
        confirmationToken: string;
        otp: string;
      },
    ):
      | MessageResponse<"Email address updated successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;
  }
}

@tag("Users")
@route("/users")
@useAuth(BearerAuth)
namespace Users {
  @summary("User's profile details")
  @get
  @route("/{username}/profile")
  op getUserProfile(@path username: string):
    | DataResponse<UserProfile>
    | NotFoundResponse
    | InternalServerErrorResponse;
   
}