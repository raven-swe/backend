import { Exclude } from 'class-transformer';
import { BioDto } from 'src/users/dtos';

export class RetweeterDto {
  @Exclude()
  userId: string;

  username: string;
  displayName: string;
  avatarUrl: string;
  isFollowing: boolean;
  isFollower: boolean;
  bio: BioDto | null;
}
