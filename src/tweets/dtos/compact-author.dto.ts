import { AuthorDto } from './author.dto';

export type CompactAuthorDto = Omit<AuthorDto, 'isBlocked' | 'isFollowing' | 'isMuted'> & {
  id: string;
};
