import { IsNotEmpty, IsString } from 'class-validator';
export class UploadGif {
  @IsString()
  @IsNotEmpty()
  klipyId: string;
}
