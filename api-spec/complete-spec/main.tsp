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

@doc("Single user session, providing details about the device, location, and activity status.")
model SessionResponse {
  @doc("Unique identifier for the session.")
  id: string;

  @doc("The type of device or client used for this session (e.g., 'Linux', 'Android', 'Web', 'Windows').")
  deviceType: string;

  @doc("The location where the session was initiated or active")
  location: string | null;

  @doc("The UTC timestamp indicating the last time this session was active.")
  lastActive: utcDateTime;

  @doc("A boolean flag indicating whether this session is the one currently making the API request.")
  isCurrent: boolean;
}

@doc("A single external social account connected to the user's primary account.")
model ConnectedAccountResponse {
  @doc("The name of the external provider (e.g., 'google', 'github').")
  provider: string;

  @doc("The unique identifier (e.g., email address) associated with the user")
  displayIdentifier: string;

  @doc("The connection status.")
  status: "Connected" | "Error";

  @doc("The timestamp when this external account was first linked.")
  connectedAt: utcDateTime;
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
  languageCode: LanguageCode = LanguageCode.EN;
}

@doc("User's biography with structured entities")
model UserBio {
  @doc("The user's bio text (max 160 characters)")
  @maxLength(160)
  text: string | null;

  @doc("Structured entities found in the bio (mentions and hashtags)")
  bioEntities: BioEntities | null;
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

@doc("Relationship state between the current user and the subject user. Defines blocking and muting status")
model UserRelationship {
  @doc("True if the current user has blocked this user, preventing them from viewing their profile or interacting.")
  blocking: boolean;

  @doc("True if this user has blocked the current user.")
  blockedBy: boolean;

  @doc("True if the current user has muted this user, hiding their posts from the feed without unfollowing.")
  muted: boolean;

  @doc("Is the user followed by the current logged-in user")
  following: boolean | null;

  @doc("Is the user following the current logged-in user")
  follower: boolean | null;
}

@doc("Complete user profile with full account details and relationship context.")
model UserProfile {
  ...PublicUser;

  @doc("Relationship state between the authenticated user and this profile user, including blocks and mutes.")
  relationship: UserRelationship;

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
  media?: MediaItem[] | null;

  @doc("The ID of the tweet this one is a reply to.")
  isReplyToTweetId?: string | null;

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
  isReplyToTweetId: string | null;

  @doc("The ID of the tweet being quoted.")
  quotedTweetId: string | null;

  @doc("The full object of the tweet being quoted, for easy display.")
  quotedTweet: CompactTweet | null; // Hydrated object for a quoted tweet.
}

@doc("Defines the filter categories for the notifications list.")
enum NotificationFilter {
  @doc("Show all types of notifications.")
  all,

  @doc("Show only conversational notifications like replies, mentions, and quotes.")
  mentions,
}

@doc("Summarizes the users (actors) who triggered a notification.")
model NotificationActorSummary {
  @doc("A sample of users for UI previews (e.g., 'Alex, Maria...').")
  @maxItems(3)
  previewActors: UserMetadata[];

  @doc("The total count of all users (e.g., for '...and 4 others').")
  @minValue(1)
  totalActorCount: int32;
}

@doc("Represents a single notification item for a user.")
model Notification {
  @doc("Unique ID for the notification event.")
  id: string;

  @doc("The specific action that triggered this notification.")
  type: NotificationType;

  @doc("Summary of the user(s) who triggered this notification.")
  actorSummary: NotificationActorSummary;

  @doc("The primary, new tweet(s) that are the subject of this notification.\ne.g., the new reply, the new quote, or the set of tweets that were liked.")
  @minItems(0)
  primaryTweets?: Tweet[];

  @doc("The secondary, contextual tweet.\ne.g., your original tweet that was replied to or quoted.")
  parentTweet?: Tweet;

  @doc("Timestamp of the *latest* event in this aggregation.")
  latestEventAt: utcDateTime;

  @doc("Indicates whether the notification has been read.")
  isRead: boolean;
}

enum NotificationType {
  FOLLOW: "FOLLOW",
  LIKE: "LIKE",
  REPLY: "REPLY",
  QUOTE: "QUOTE",
  RETWEET: "RETWEET",
  TWEET: "TWEET",
  MENTION: "MENTION",
}

@doc("Query parameters for cursor-based pagination")
model CursorPaginationParameters {
  @query
  @doc("The cursor position to start fetching from")
  cursor: string;

  @query
  @doc("The number of items to return per page (default: 20)")
  limit: int32 = 20;
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

model AccountInfo {
  username: string;
  email: string | null;
  accountCreationDate: utcDateTime;
  accountCreationIp: string | null;
  country: string;
  languages: LanguageCode[];
  gender: Gender;
  birthDate: plainDate;
  age: int32;
}

enum LanguageCode {
  AR,
  EN,
}

enum Gender {
  Male,
  Female,
}

alias FollowingListResponse = DataResponseWithPagination<FollowingUser[]>;
alias FollowersListResponse = DataResponseWithPagination<FollowingUser[]>;
alias BlockedListResponse = DataResponseWithPagination<CompactUser[]>;
alias MutedListResponse = DataResponseWithPagination<CompactUser[]>;
alias SessionListResponse = DataResponse<SessionResponse[]>;
alias NotificationsListResponse = DataResponseWithPagination<Notification[]>;

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
    | (DataResponse<{
        accessToken: string;
        refreshToken: string;
      }> &
        SetAuthCookieResponse)
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("/logout")
  @doc("refresh token is required in cookie from web clints and in body from mobile clients")
  @summary("refresh token is required in cookie from web clints and in body from mobile clients")
  @useAuth(BearerAuth)
  op logout(
    @cookie("refresh_token") refreshToken?: string,
    @body body?: {
      refreshToken: string;
    },
  ): MessageResponse<"Logged out successfully."> | UnauthorizedResponse | InternalServerErrorResponse;

  @post
  @route("/refresh-token")
  @doc("refresh token is required in cookie from web clints and in body from mobile clients")
  @summary("refresh token is required in cookie from web clints and in body from mobile clients")
  op refreshToken(
    @cookie("refresh_token") refreshToken?: string,
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
  @summary("User's profile details")
  @get
  @route("/{username}/profile")
  op getUserProfile(@path username: string):
    | DataResponse<UserProfile>
    | UnauthorizedResponse
    | NotFoundResponse
    | InternalServerErrorResponse;

  @summary("List user's tweets")
  @get
  @route("/{username}/tweets")
  op getUserTweets(@path username: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | UnauthorizedResponse
    | NotFoundResponse
    | InternalServerErrorResponse;

  @summary("List user's replies and tweets")
  @get
  @route("/{username}/replies")
  op getUserReplies(@path username: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | UnauthorizedResponse
    | NotFoundResponse
    | InternalServerErrorResponse;

  @summary("List user's liked tweets")
  @get
  @route("/{username}/likes")
  op getUserLikes(@path username: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | UnauthorizedResponse
    | NotFoundResponse
    | ForbiddenResponse
    | InternalServerErrorResponse;

  @summary("List user's tweets with media attachments")
  @get
  @route("/{username}/media")
  op getUserMedia(@path username: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | UnauthorizedResponse
    | NotFoundResponse
    | InternalServerErrorResponse;

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
  @get
  @summary("Get the authenticated user's profile")
  op getMyProfile(): DataResponse<UserProfile> | UnauthorizedResponse | InternalServerErrorResponse;

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

  @post
  @summary("Deactivate or delete the authenticated user's account.")
  op deactivateAccount(
    @body body: {
      currentPassword: string;
    },
  ):
    | MessageResponse<"Account deactivated successfully. You have been logged out.">
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;
  @useAuth(BearerAuth)
  @route("/settings")
  namespace Settings {
    @summary("Validate the current user's password")
    @doc("This endpoint allows an already authenticated user to verify their password. It is used in order to show account info in the settings page.")
    @useAuth(BearerAuth)
    @post
    @route("password/validate")
    op validatePassword(
      @body body: {
        password: string;
      },
    ):
      | DataResponse<{
          isValid: boolean;
        }>
      | UnauthorizedResponse
      | ForbiddenResponse
      | ValidationErrorResponse
      | InternalServerErrorResponse;

    @summary("Get the authenticated user's account information")
    @doc("Retrieves detailed profile and account settings for the currently authenticated user, identified by their JWT.")
    @get
    op getAccountInfo():
      | DataResponse<AccountInfo>
      | UnauthorizedResponse
      | InternalServerErrorResponse
      | ForbiddenResponse;

    @patch(#{ implicitOptionality: true })
    @route("/username")
    @summary("Change the authenticated user's username")
    op updateUsername(
      @body body: {
        newUsername: string;
      },
    ):
      | MessageResponse<"Username changed successfully.">
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

    @put
    @route("/country")
    @summary("Update the authenticated user's country")
    op updateCountry(
      @body body: {
        countryName: string;
      },
    ):
      | MessageResponse<"Country updated successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @put
    @route("/gender")
    @summary("Update the authenticated user's gender")
    op updateGender(
      @body body: {
        gender: Gender;
      },
    ):
      | MessageResponse<"Gender updated successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @put
    @route("/birthdate")
    @summary("Update the authenticated user's birth date")
    op updateBirthDate(
      @body body: {
        date: plainDate | null;
      },
    ):
      | MessageResponse<"Birth date updated successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @put
    @route("/language")
    @summary("Update the authenticated user's default language")
    op updateLanguage(
      @body body: {
        language: LanguageCode;
      },
    ):
      | MessageResponse<"Default language updated successfully.">
      | BadRequestResponse
      | ValidationErrorResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @summary("List a user's blocks")
    @get
    @route("/blocks")
    op listUserBlocks(
      ...CursorPaginationParameters,
    ): BlockedListResponse | UnauthorizedResponse | InternalServerErrorResponse;

    @summary("List a user's mutes")
    @get
    @route("/mutes")
    op listUserMutes(
      ...CursorPaginationParameters,
    ): MutedListResponse | UnauthorizedResponse | InternalServerErrorResponse;

    @get
    @route("/sessions")
    @summary("Retrieve all active and recent sessions for the authenticated user.")
    op getSessions(): SessionListResponse | UnauthorizedResponse | InternalServerErrorResponse;

    @delete
    @route("/sessions/{sessionId}")
    @summary("Log out or terminate a specific session by its ID.")
    op deleteSession(@path sessionId: string):
      | MessageResponse<"Session terminated successfully.">
      | NotFoundResponse
      | UnauthorizedResponse
      | InternalServerErrorResponse;

    @get
    @route("/connected-accounts")
    @summary("Retrieve a list of all external social accounts connected for login.")
    op getConnectedAccounts(
    ): DataResponse<ConnectedAccountResponse[]> | UnauthorizedResponse | InternalServerErrorResponse;

    @post
    @route("/connected-accounts/{provider}")
    @summary("Disconnect an external social account by its provider (e.g., 'google', 'github').")
    op disconnectAccount(
      @path provider: string,
      @body body: {
        currentPassword: string;
      },
    ):
      | MessageResponse<"Account disconnected successfully.">
      | BadRequestResponse
      | UnauthorizedResponse
      | NotFoundResponse
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

@tag("Notifications")
@route("/notifications")
@useAuth(BearerAuth)
namespace Notifications {
  @get
  op listUserNotifications(
    ...CursorPaginationParameters,

    @query
    @doc("Filters the notifications by a specific category. Defaults to 'all'.")
    filter?: NotificationFilter = NotificationFilter.all,
  ):
    | NotificationsListResponse
    | BadRequestResponse
    | ValidationErrorResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @route("/count")
  @doc("Get the count of unseen notifications")
  op getNotificationsCount(): DataResponse<{
    unseenCount: integer;
  }> | UnauthorizedResponse | InternalServerErrorResponse;

  @patch
  @route("/mark-all-seen")
  @doc("Mark all notifications as seen")
  op markAllNotificationsAsSeen(): DataResponse<{
    updatedCount: integer;
  }> | UnauthorizedResponse | InternalServerErrorResponse;

  @patch
  @route("/{notificationId}/mark-seen")
  @doc("Mark a specific notification as seen by its ID")
  op markNotificationAsSeen(@path notificationId: string):
    | DataResponse<{
        updatedCount: integer;
      }>
    | UnauthorizedResponse
    | NotFoundResponse
    | ValidationErrorResponse
    | BadRequestResponse
    | InternalServerErrorResponse;
}

@tag("Tweets")
@route("/tweets")
@useAuth(BearerAuth)
namespace Tweets {
  @post
  @summary("Create a new tweet")
  op postTweet(@body body: TweetBody):
    | MessageResponse<"Tweet posted successfully.">
    | ValidationErrorResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse
    | ConflictResponse
    | RateLimitResponse;

  @get
  @route("/{id}")
  @summary("Get a specific tweet by ID")
  op getTweet(@path id: string):
    | DataResponse<Tweet>
    | NotFoundResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @route("/{id}/replies")
  @summary("Get replies to a specific tweet")
  op getTweetReplies(@path id: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | NotFoundResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @route("/{id}/quotes")
  @summary("Get quotes to a specific tweet")
  op getTweetQuotes(@path id: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<Tweet[]>
    | NotFoundResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @route("/{id}/retweets")
  @summary("Get users who retweeted a tweet")
  op getTweetRetweeters(@path id: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<UserMetadataWithBio[]>
    | NotFoundResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @get
  @route("/{id}/likes")
  @summary("Get users who liked my tweet")
  op getTweetLikes(@path id: string, ...CursorPaginationParameters):
    | DataResponseWithPagination<UserMetadataWithFollowInfo[]>
    | NotFoundResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("/{id}/like")
  @summary("Like a tweet")
  op likeTweet(@path id: string):
    | MessageResponse<"Tweet liked successfully.">
    | NotFoundResponse
    | ConflictResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @delete
  @route("/{id}/like")
  @summary("Unlike a tweet")
  op unlikeTweet(@path id: string):
    | MessageResponse<"Tweet unliked successfully.">
    | NotFoundResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @post
  @route("/{id}/retweet")
  @summary("Retweet a tweet")
  op retweetTweet(@path id: string):
    | MessageResponse<"Tweet retweeted successfully.">
    | NotFoundResponse
    | ConflictResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @delete
  @route("/{id}/retweet")
  @summary("Undo retweet")
  op unretweetTweet(@path id: string):
    | MessageResponse<"Retweet undone successfully.">
    | NotFoundResponse
    | BadRequestResponse
    | UnauthorizedResponse
    | InternalServerErrorResponse;

  @delete
  @route("/{id}")
  @summary("Delete a tweet")
  op deleteTweet(@path id: string):
    | MessageResponse<"Tweet deleted successfully.">
    | NotFoundResponse
    | UnauthorizedResponse
    | ForbiddenResponse
    | InternalServerErrorResponse;
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
