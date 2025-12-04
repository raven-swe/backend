export interface Interest {
  code: string;
  name: string;
  isSelected: boolean;
}

export class InterestsResponseDto {
  interests: Interest[];
}
