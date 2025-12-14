import { AuthorDto } from './author.dto';

export type CompactAuthorDto = Omit<
  AuthorDto,
  'relationship' | 'isBlocked' | 'isFollowing' | 'isMuted'
>;

export type CompactAuthorWithId = CompactAuthorDto & { id: string };
