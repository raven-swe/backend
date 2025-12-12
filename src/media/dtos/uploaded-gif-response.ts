export class UploadedGifResponse {
  id: string;
  url: string;
  width: number;
  height: number;
  altText?: string;
  variations: {
    tinygifUrl: string;
    nanogifUrl: string;
  };
}
