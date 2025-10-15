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

@doc("Entities containing mentions and hashtags for tweet content")
model TweetEntities {
  @doc("Array of mention entities in the tweet")
  mentions: MentionEntity[] | null;

  @doc("Array of hashtag entities in the tweet")
  hashtags: HashtagEntity[] | null;
}

@doc("Entity media in tweet.")
model MediaEntity {
  @doc("Unique identifier for the media item.")
  id: string;

  ...MediaItem;
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

@doc("Authenticated user profile (includes private data)")
model AuthenticatedUser {
  ...PublicUser;

  @doc("User's email address (private)")
  email: string;

  @doc("User's phone number (private)")
  phone: string | null;

  @doc("User's language preference")
  languageCode: string = "en";
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
  avatarUrl: string | null;
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

  @doc("Entities in the bio (mentions and hashtags)")
  bioEntities?: BioEntities | null;

  @doc("User's location")
  @maxLength(100)
  location?: string | null;

  @doc("User's website URL")
  @maxLength(255)
  websiteUrl?: string | null;
}

@doc("The type of media file.")
enum MediaType {
  IMAGE,
  VIDEO,
  GIF,
}

@doc("Detailed information about an attached media item.")
model MediaItem {
  @doc("The type of media.")
  type: MediaType;

  @doc("URL to access the media file.")
  url: string;

  @doc("Alt text for accessibility.")
  altText: string;

  @doc("The width of the media item (in pixels for image/video).")
  width: int32;

  @doc("The height of the media item (in pixels for image/video).")
  height: int32;
}

@doc("The content and optional media for creating a new tweet")
model TweetBody {
  @doc("Text content of the tweet (max 280 characters).")
  @maxLength(280)
  content: string | null;

  @doc("Optional array of media items attached to the tweet (max 4 items)")
  @maxItems(4)
  media: MediaItem[] | null;

  @doc("The ID of the tweet this one is a reply to.")
  replyToTweetId: string | null;

  @doc("The ID of the tweet being quoted.")
  quotedTweetId?: string | null;
}

@doc("A compact representation of a tweet, used when nesting or in lists.")
model CompactTweet {
  @doc("The unique identifier for the tweet.")
  id: string;

  @doc("The user who created the tweet.")
  author: UserMetadata;

  @doc("The text content of the tweet.")
  content: string | null;

  @doc("The time the tweet was created.")
  createdAt: utcDateTime;

  @doc("Number of replies to this tweet.")
  replyCount: int32;

  @doc("Number of retweets of this tweet.")
  retweetCount: int32;

  @doc("Number of likes on this tweet.")
  likeCount: int32;

  @doc("Indicates if the authenticated user has liked this tweet.")
  isLiked: boolean;

  @doc("Indicates if the authenticated user has retweeted this tweet.")
  isRetweeted: boolean;

  @doc("Structured data entities (mentions, hashtags) found in the tweet content.")
  entities: TweetEntities;

  @doc("Optional array of media ids attached to the tweet (max 4 items)")
  media: MediaItem[] | null;
}

model Tweet {
  ...CompactTweet;

  @doc("The ID of the tweet this one is a reply to.")
  isReplyToTweetId: int64 | null;

  @doc("The full object of the tweet being replied to, for easy display.")
  replyToTweet?: CompactTweet; // Hydrated object for a parent tweet.

  @doc("The ID of the tweet being quoted.")
  quotedTweetId?: string;

  @doc("The full object of the tweet being quoted, for easy display.")
  quotedTweet?: CompactTweet; // Hydrated object for a quoted tweet.
}

@doc("Query parameters for cursor-based pagination")
model CursorPaginationParameters {
  @query
  @doc("The cursor position to start fetching from")
  cursor?: string;

  @query
  @doc("The number of items to return per page (default: 20)")
  limit?: int32 = 20;
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

model FollowingUser {
  ...CompactUser;
  isFollowing: boolean;
}

alias FollowingListResponse = DataResponseWithPagination<FollowingUser[]>;
alias FollowersListResponse = DataResponseWithPagination<FollowingUser[]>;
alias BlockedListResponse = DataResponseWithPagination<CompactUser[]>;
alias MutedListResponse = DataResponseWithPagination<CompactUser[]>;

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

  @post
  @route("/login")
  op login(
    @body body: {
      identifier: string;
      password: string;
    },
  ):
    | DataResponse<{
        accessToken: string;
        refreshToken: string;
      }>
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @summary("Logout the user by invalidating the refresh token for this client only")
  @route("/logout")
  @useAuth(BearerAuth)
  op logout(
  ): MessageResponse<"Logged out successfully."> | UnauthorizedResponse | InternalServerErrorResponse;

  @post
  @route("/refresh-token")
  op refreshToken(
    @body body: {
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

  @route("/password")
  namespace Password {
    @post
    @route("/forgot")
    op forgotPassword(
      @body body: {
        email: string;
        recaptchaToken: string; // token from client side recaptcha v2
      },
    ):
      | {
          ...OkResponse;
          ...Body<{
            success: true;
            token: string;
            message: "Password reset code sent to email.";
          }>;
        }
      | ValidationErrorResponse
      | NotFoundResponse
      | RateLimitResponse
      | InternalServerErrorResponse;

    @post
    @route("/forgot/verify")
    op verifyForgotPassword(
      @body body: {
        token: string;
        otp: string;
      },
    ):
      | MessageResponse<"Password reset verified successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @post
    @route("/reset")
    op resetPassword(
      @body body: {
        token: string;
        newPassword: string;
      },
    ):
      | MessageResponse<"Password reset successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @put
    @useAuth(BearerAuth)
    op changePassword(
      @body body: {
        currentPassword: string;
        newPassword: string;
      },
    ):
      | MessageResponse<"Password changed successfully.">
      | UnauthorizedResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @post
    @route("/resend-otp")
    op resendOtpPassword(
      @body body: {
        token: string;
      },
    ):
      | MessageResponse<"otp resent successfully.">
      | BadRequestResponse
      | RateLimitResponse
      | InternalServerErrorResponse;
  }

  // check for email exists or not
  @get
  @route("/check-email")
  op checkEmail(@query email: string): DataResponse<{
    exists: boolean;
  }> | ValidationErrorResponse | InternalServerErrorResponse;
}

@tag("OAuth")
@route("/oauth")
namespace Oauth {
  @post
  @route("/{provider}/callback")
  @summary("Handle OAuth callback for a given provider")
  @doc("""
    This endpoint handles OAuth callbacks from providers. It can return two types of responses:
    
    1. **New User (Registration Required)**: Returns a `creationToken` that must be used with the `/complete` endpoint to finish registration by providing birth date.
       Example response: `{ "success": true, "data": { "creationToken": "bGxxkpXVCJ9..." } }`
    
    2. **Existing User (Login)**: Returns `accessToken` and `refreshToken` for immediate authentication.
       Example response: `{ "success": true, "data": { "accessToken": "bGxxkpXVCJ9...", "refreshToken": "dxxG9rZW4..." } }`
    """)
  op handleOauthCallback(
    @path provider: string,
    @body body: {
      provider_token_id: string;
    },
  ):
    | DataResponse<{
        creationToken: string;
        accessToken?: never;
        refreshToken?: never;
      } | {
        creationToken?: never;
        accessToken: string;
        refreshToken: string;
      }>
    | BadRequestResponse
    | ValidationErrorResponse
    | InternalServerErrorResponse;

  @post
  @route("/complete")
  @summary("Complete OAuth registration by sending the birth data")
  op completeOauthRegister(
    @body body: {
      creationToken: string;
      birthDate: plainDate;
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

@tag("Users")
@route("/users")
@useAuth(BearerAuth)
namespace Users {
  namespace Follows {
    @summary("List a user's followers")
    @get
    @route("/{username}/followers")
    op listUserFollowers(@path username: string, ...CursorPaginationParameters):
      | FollowersListResponse
      | NotFoundResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @get
    @route("/{username}/mutual")
    @summary("List mutual followers with a user given their username")
    op listMutualFollowers(@path username: string, ...CursorPaginationParameters):
      | FollowersListResponse
      | NotFoundResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @route("/{username}/following")
    namespace Following {
      @summary("List users a user is following")
      @get
      op listUserFollowing(@path username: string, ...CursorPaginationParameters):
        | FollowingListResponse
        | NotFoundResponse
        | UnauthorizedResponse
        | InternalServerErrorResponse;

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
}

@tag("Me")
@route("/me")
@useAuth(BearerAuth)
namespace Me {
  @patch(#{ implicitOptionality: true })
  @route("/username")
  @summary("Change the authenticated user's username")
  op changeMyUsername(
    @body body: {
      newUsername: string;
    },
  ):
    | MessageResponse<"Username changed successfully.">
    | ValidationErrorResponse
    | ConflictResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @summary("Get the authenticated user's profile")
  op getMyProfile(
  ): DataResponse<AuthenticatedUser> | UnauthorizedResponse | InternalServerErrorResponse;

  @patch(#{ implicitOptionality: true })
  @summary("Update the authenticated user's profile")
  op updateMyProfile(@body body: UpdateProfileRequest):
    | DataResponse<AuthenticatedUser>
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

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

  @post
  @route("/profile-picture")
  op updateProfilePicture(
    @header contentType: "multipart/form-data",
    @multipartBody body: {
      profilePicture: HttpPart<File>;
    },
  ):
    | MessageResponse<"Profile picture updated successfully.">
    | ValidationErrorResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("phone")
  op addPhoneNumber(
    @body body: {
      phoneNumber: string;
      recaptchaToken: string; // token from client side recaptcha v2
    },
  ):
    | MessageResponse<"Phone number added successfully. Verification code sent via SMS.">
    | ValidationErrorResponse
    | ConflictResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @put
  @route("/email")
  @summary("Initiates update of the authenticated user's email address")
  op updateEmail(
    @body body: {
      newEmail: string;
    },
  ):
    | MessageResponse<"Email update initiated. Please verify the new email address.">
    | ValidationErrorResponse
    | ConflictResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("/email/resend-otp")
  @summary("Resend the verification code to the new email address")
  op resendEmailVerificationOtp(
    @body body: {
      newEmail: string;
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
      verificationCode: string;
    },
  ):
    | MessageResponse<"Email address updated successfully.">
    | BadRequestResponse
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("/banner")
  op updateBanner(
    @header contentType: "multipart/form-data",
    @multipartBody body: {
      banner: HttpPart<File>;
    },
  ):
    | MessageResponse<"Banner updated successfully.">
    | ValidationErrorResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @delete
  @route("/banner")
  op deleteBanner(
  ): MessageResponse<"Banner deleted successfully."> | UnauthorizedResponse | InternalServerErrorResponse;

  @route("/blocks")
  @useAuth(BearerAuth)
  namespace Blocks {
    @summary("List a user's blocks")
    @get
    op listUserBlocks(
      ...CursorPaginationParameters,
    ): BlockedListResponse | UnauthorizedResponse | InternalServerErrorResponse;

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
    @summary("List a user's mutes")
    @get
    op listUserMutes(
      ...CursorPaginationParameters,
    ): MutedListResponse | UnauthorizedResponse | InternalServerErrorResponse;

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

@tag("Onboarding")
@route("/onboarding")
@useAuth(BearerAuth)
namespace Onboarding {
  @get
  @route("/username-suggestions")
  op getUsernameSuggestions(): DataResponse<{
    suggestions: string[];
  }> | UnauthorizedResponse | InternalServerErrorResponse;

  @get
  @route("/follow-suggestions")
  op getFollowSuggestions(): DataResponse<{
    suggestions: UserMetadata[];
  }> | UnauthorizedResponse | InternalServerErrorResponse;
}

@tag("Tweets")
@route("/tweets")
@useAuth(BearerAuth)
namespace Tweets {
  @post
  op postTweet(@body body: TweetBody):
    | MessageResponse<"Tweet posted successfully.">
    | ValidationErrorResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse
    | ConflictResponse
    | RateLimitResponse;
}
