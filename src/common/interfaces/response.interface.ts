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

export interface CursorPagination {
  cursor?: string | null;
  nextCursor?: string | null;
  hasNextPage: boolean;
}

export interface ApiSuccessResponseWithPagination<T> {
  success: true;
  message?: string;
  data: T;
  pagination: CursorPagination;
}
