import { IsNotEmpty, IsString } from 'class-validator';
import { UploadMedia } from './upload-media.dto';

export class UploadGif extends UploadMedia {
  @IsString()
  @IsNotEmpty()
  tenorId: string;
}
