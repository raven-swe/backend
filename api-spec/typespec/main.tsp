import "@typespec/http";
import "@typespec/openapi3";

using Http;

@service(#{ title: "Twitter" })
@server("https://example.com", "Single server endpoint")
namespace Twitter;

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

@doc("Entity mention in bio")
model BioMentionEntity {
    @doc("The username of the mentioned user")
    username: string; //we expose text but store as user id and hydrate
    
    @doc("Start position of the mention in the bio text")
    startPosition: int32;
}

@doc("Entity hashtag in bio")
model BioHashtagEntity {
    @doc("The hashtag text (without #)")
    hashtag: string;
    
    @doc("Start position of the hashtag in the bio text")
    startPosition: int32;
}

@doc("Bio entities containing mentions and hashtags")
model BioEntities {
    @doc("Array of mention entities in the bio")
    mentions?: BioMentionEntity[];
    
    @doc("Array of hashtag entities in the bio")
    hashtags?: BioHashtagEntity[];
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

    @doc("User's date of birth")
    birthdate: string | null;

    @doc("Date when the user joined")
    joinedAt: utcDateTime;
}

@doc("Authenticated user profile (includes private data)")
model AuthenticatedUser {
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

    @doc("URL to the user's banner image")
    bannerUrl: string | null;

    @doc("User's location")
    @maxLength(100)
    location: string | null;

    @doc("User's website URL")
    @maxLength(255)
    websiteUrl: string | null;

    @doc("Date when the user joined")
    joinedAt: utcDateTime;

    @doc("User's email address (private)")
    email: string;

    @doc("User's date of birth (private)")
    birthdate: plainDate;

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
    dateOfBirth: utcDateTime;
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

alias FollowingListResponse = DataResponseWithPagination<CompactUser[]>;
alias FollowersListResponse = DataResponseWithPagination<{
  ...CompactUser,
  isFollowing: boolean;
}[]>;
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
        op startRegister(@body body: RegisterStartBody): DataResponse<{
            creationToken: string;
        }>;

        @post
        @route("/verify")
        op verifyRegister(
            @body body: {
                creationToken: string;
                otp: string;
            },
        ): MessageResponse<"Registration verified successfully.">;

        @post
        @route("/resend-otp")
        op resendOtp(
            @body body: {
                creationToken: string;
            },
        ): MessageResponse<"otp resent successfully.">;

        @post
        @summary("Complete the registration process by setting a password")
        @route("/complete")
        op completeRegister(
            @body body: {
                creationToken: string;
                password: string;
            },
        ): DataResponse<{
            accessToken: string;
            refreshToken: string; 
        }>;
    }

    @post
    @route("/login")
    op login(
        @body body: {
            username: string;
            password: string;
        },
    ): DataResponse<{
        accessToken: string;
        refreshToken: string;
    }>;

    @post
    @route("/logout")
    @useAuth(BearerAuth)
    op logout(): MessageResponse<"Logged out successfully.">;

    @post
    @route("/refresh-token")
    op refreshToken(): DataResponse<{
        accessToken: string;
        refreshToken: string;
    }>;

    @route("/password")
    namespace Password {
        @post
        @route("/forgot")
        op forgotPassword(
            @body body: {
                email: string;
                recaptchaToken: string; // token from client side recaptcha v2
            },
        ): {
            ...OkResponse;
            ...Body<{
                success: true;
                message: "Password reset code sent to email.";
            }>;
        };

        @post
        @route("/reset")
        op resetPassword(
            @body body: {
                token: string;
                otp: string;
                newPassword: string;
            },
        ): MessageResponse<"Password reset successfully.">;

        @post
        @route("/change")
        op changePassword(
            @body body: {
                currentPassword: string;
                newPassword: string;
            },
        ): MessageResponse<"Password changed successfully.">;

        @post
        @route("/resend-otp")
        op resendOtpPassword(
            @body body: {
                creationToken: string;
            },
        ): MessageResponse<"otp resent successfully.">;
    };

    // check for email exists or not
    @get
    @route("/check-email")
    op checkEmail(@query email: string): DataResponse<{
        exists: boolean;
    }>;

    @route("/{provider}")
    namespace Oauth {
        @get
        @summary("Get OAuth URL for a given provider")
        op getOauthUrl(@path provider: string): void;

        @get
        @route("/callback")
        @summary("Handle OAuth callback for a given provider")
        op handleOauthCallback(@path provider: string): DataResponse<{
            accessToken: string;
            refreshToken: string;
        }>;
    }
}

@tag("Users")
@route("/users")
@useAuth(BearerAuth)
namespace Users {
    namespace Follows {
        @summary("List a user's followers")
        @get
        @route("/{username}/followers")
        op listUserFollowers(
            @path username: string,
            ...CursorPaginationParameters ,
        ): FollowersListResponse;

        @get
        @route("/{username}/mutual")
        @summary("List mutual followers with a user given their username")
        op listMutualFollowers(
            @path username: string,
            ...CursorPaginationParameters,
        ): FollowersListResponse;

        @route("/{username}/following")
        namespace Following {
            @summary("List users a user is following")
            @get
            op listUserFollowing(
                @path username: string,
                ...CursorPaginationParameters,
            ): FollowingListResponse;

            @summary("Follow a user")
            @post
            op followUser(
                @path
                username: string,
            ): FollowUserResponse;

            @summary("Unfollow a user")
            @delete
            op unfollowUser(
                @path
                username: string,
            ): UnfollowUserResponse;
        }
    }
}

@tag("Me")
@route("/me")
@useAuth(BearerAuth)
namespace Me {

    @patch( #{ implicitOptionality: true })
    @route("/username")
    @summary("Change the authenticated user's username")
    op changeMyUsername(
        @body body: {
            newUsername: string;
        },
    ): MessageResponse<"Username changed successfully.">;

    @get
    @summary("Get the authenticated user's profile")
    op getMyProfile(): DataResponse<AuthenticatedUser>;

    @patch(#{ implicitOptionality: true })
    @summary("Update the authenticated user's profile")
    op updateMyProfile(
        @body body: UpdateProfileRequest,
    ): DataResponse<AuthenticatedUser>;

    @put
    @route("/password")
    @summary("Change the authenticated user's password")
    op changeMyPassword(
        @body body: {
            currentPassword: string;
            newPassword: string;
        },
    ): MessageResponse<"Password changed successfully.">;

    @post
    @route("/profile-picture")
    op updateProfilePicture(
        @header contentType: "multipart/form-data",
        @multipartBody body: {
            profilePicture: HttpPart<File>;
        },
    ): MessageResponse<"Profile picture updated successfully.">;

    @delete
    @route("/profile-picture")
    op deleteProfilePicture(): MessageResponse<"Profile picture deleted successfully.">;

    @post
    @route("/banner")
    op updateBanner(
        @header contentType: "multipart/form-data",
        @multipartBody body: {
            banner: HttpPart<File>;
        },
    ): MessageResponse<"Banner updated successfully.">;

    @delete
    @route("/banner")
    op deleteBanner(): MessageResponse<"Banner deleted successfully.">;

    @route("/blocks")
    @useAuth(BearerAuth)
    namespace Blocks {
        @summary("List a user's blocks")
        @get
        op listUserBlocks(
            @path username: string,
            ...CursorPaginationParameters,
        ): BlockedListResponse;
        
        @summary("Block a user")
        @post
        @route("/{username}")
        op blockUser(
            @path
            username: string,
        ): BlockUserResponse;
        
        @summary("Unblock a user")
        @delete
        @route("/{username}")
        op unblockUser(
            @path
            username: string,
        ): UnblockUserResponse;
    }

    @route("/mutes")
    @useAuth(BearerAuth)
    namespace Mutes {
        @summary("List a user's mutes")
        @get
        op listUserMutes(
            @path username: string,
            ...CursorPaginationParameters,
        ): MutedListResponse;

        @summary("Mute a user")
        @post
        @route("/{username}")
        op muteUser(
            @path
            username: string,
        ): MuteUserResponse;

        @summary("Unmute a user")
        @delete
        @route("/{username}")
        op unmuteUser(
            @path
            username: string,
        ): UnmuteUserResponse;
    }
}

@tag("Onboarding")
@route("/onboarding")
@useAuth(BearerAuth)
namespace Onboarding {
    @get
    @route("/username-suggestions")
    op getUsernameSuggestions(@query query: string): DataResponse<{
        suggestions: string[];
    }>;

    @get
    @route("/follow-suggestions")
    op getFollowSuggestions(@query query: string): DataResponse<{
        suggestions: UserMetadata[];
    }>;
}