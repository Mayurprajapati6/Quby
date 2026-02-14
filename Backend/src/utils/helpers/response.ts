export interface SuccessResponse<T = any> {
  success: true;
  message?: string;
  data: T;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
}

export function successResponse<T>(data: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
  };
}

export function errorResponse(message: string, error?: any): ErrorResponse {
  return {
    success: false,
    message,
    ...(error && { error }),
  };
}

export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}