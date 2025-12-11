import { AuthorDto } from './author.dto';

type CompactAuthorDtoCached = Omit<AuthorDto, 'relationship'>;

export type CompactAuthorWithId = CompactAuthorDtoCached & { id: string };
