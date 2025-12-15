import { AuthorDto } from './author.dto';

type CompactAuthorDtoCached = Omit<AuthorDto, 'relationship'>;
export type CompactAuthorDto = Omit<
  AuthorDto,
  'relationship' | 'isBlocked' | 'isFollowing' | 'isMuted'
>;

export type CompactAuthorWithId = CompactAuthorDtoCached & { id: string };
