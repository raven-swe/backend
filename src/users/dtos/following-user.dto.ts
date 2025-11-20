import { CompactUserDto } from './compact-user.dto';

export class FollowingUserDto extends CompactUserDto {
  isFollowing: boolean;
  followsYou: boolean;
  isBlocked: boolean;
}
