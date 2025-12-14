export interface GifMediaFormat {
  url: string;
  dims: number[];
  size: number;
}

export interface GifResult {
  id: string;
  title: string;
  media_formats: {
    gif: GifMediaFormat;
    tinygif: GifMediaFormat;
    nanogif: GifMediaFormat;
  };
  content_description: string;
}

export interface TenorResponse {
  results: GifResult[];
  next: string;
}
