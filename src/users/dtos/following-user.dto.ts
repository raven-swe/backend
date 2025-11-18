import { CompactUserDto } from './compact-user.dto';

export class FollowingUserDto extends CompactUserDto {
  isFollowing: boolean;
  isBlocked: boolean;
}
