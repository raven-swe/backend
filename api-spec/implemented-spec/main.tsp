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

alias UnfollowUserResponse = MessageResponse<"user unfollowed successfully">;
alias FollowUserResponse = MessageResponse<"user followed successfully">;
alias BlockUserResponse = MessageResponse<"user blocked successfully">;
alias UnblockUserResponse = MessageResponse<"user unblocked successfully">;
alias MuteUserResponse = MessageResponse<"user muted successfully">;
alias UnmuteUserResponse = MessageResponse<"user unmuted successfully">;

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

  @route("/blocks")
  @useAuth(BearerAuth)
  namespace Blocks {
    @summary("Block a user")
    @post
    @route("/{username}")
    op blockUser(
      @path
      username: string,
    ):
      | BlockUserResponse
      | NotFoundResponse
      | ConflictResponse
      | UnauthorizedResponse
      | ForbiddenResponse
      | InternalServerErrorResponse;

    @summary("Unblock a user")
    @delete
    @route("/{username}")
    op unblockUser(
      @path
      username: string,
    ):
      | UnblockUserResponse
      | NotFoundResponse
      | BadRequestResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;
  }

  @route("/mutes")
  @useAuth(BearerAuth)
  namespace Mutes {
    @summary("Mute a user")
    @post
    @route("/{username}")
    op muteUser(
      @path
      username: string,
    ):
      | MuteUserResponse
      | NotFoundResponse
      | ConflictResponse
      | UnauthorizedResponse
      | ForbiddenResponse
      | InternalServerErrorResponse;

    @summary("Unmute a user")
    @delete
    @route("/{username}")
    op unmuteUser(
      @path
      username: string,
    ):
      | UnmuteUserResponse
      | NotFoundResponse
      | BadRequestResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;
  }
}

@tag("Users")
@route("/users")
@useAuth(BearerAuth)
namespace Users {
  @route("/{username}/following")
  namespace Following {
    @summary("Follow a user")
    @post
    op followUser(
      @path
      username: string,
    ):
      | FollowUserResponse
      | NotFoundResponse
      | ConflictResponse
      | UnauthorizedResponse
      | ForbiddenResponse
      | InternalServerErrorResponse;

    @summary("Unfollow a user")
    @delete
    op unfollowUser(
      @path
      username: string,
    ):
      | UnfollowUserResponse
      | NotFoundResponse
      | BadRequestResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;
  }
}
