export interface ApiResponseBase {
  success: boolean;
  message?: string;
}

export interface ApiErrorResponse extends ApiResponseBase {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiValidationErrorResponse extends ApiResponseBase {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    errors: {
      field: string;
      message?: string;
    }[];
  };
}

export interface ApiSuccessResponse<T> extends ApiResponseBase {
  success: true;
  data: T | null;
}
