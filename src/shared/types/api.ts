export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ProblemDetails;
  correlationId?: string;
  timestamp: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  correlationId?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: any;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuthTokens {
  token: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    supplierId?: string;
  };
  token: string;
  expiresAt: string;
}
