// API Types for REST API and API Key Management

export type APIKeyScope = 'read' | 'write' | 'delete';

export interface APIKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string; // e.g., "sk_live_abc1..."
  scopes: APIKeyScope[];
  rate_limit: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

export interface CreateAPIKeyInput {
  name: string;
  scopes: APIKeyScope[];
  rate_limit?: number; // default: 100
  expires_at?: string | null;
}

export interface CreateAPIKeyResponse {
  api_key: APIKey;
  full_key: string; // Only returned once on creation: "sk_live_..."
}

export interface APIAuditLog {
  id: string;
  api_key_id: string | null;
  user_id: string;
  method: string;
  path: string;
  status_code: number | null;
  ip_address: string | null;
  user_agent: string | null;
  response_time_ms: number | null;
  created_at: string;
}

// API Response Types
export interface APIResponse<T> {
  data: T;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next?: string;
}

export interface APIError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// Query Parameters for Notes Endpoint
export interface NotesQueryParams {
  date?: string; // YYYY-MM-DD
  project_id?: string;
  completed?: boolean;
  category?: 'todo' | 'followup' | 'notes' | 'meeting';
  pinned?: boolean;
  assignee_id?: string;
  limit?: number; // default: 100, max: 1000
  offset?: number; // default: 0
  sort?: 'created_at' | 'updated_at' | 'sort_order';
  order?: 'asc' | 'desc';
}

// Search Request
export interface SearchRequest {
  query: string;
  filters?: {
    category?: 'todo' | 'followup' | 'notes' | 'meeting';
    completed?: boolean;
    date_from?: string;
    date_to?: string;
    project_id?: string;
  };
  limit?: number;
  offset?: number;
}

// Batch Operations
export type BatchOperation =
  | { action: 'create'; data: CreateNoteInput }
  | { action: 'update'; id: string; data: Partial<UpdateNoteInput> }
  | { action: 'delete'; id: string };

export interface BatchRequest {
  operations: BatchOperation[];
}

export interface BatchResponse {
  results: Array<{
    success: boolean;
    operation: BatchOperation;
    data?: unknown;
    error?: APIError;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Note CRUD Input Types
export interface CreateNoteInput {
  content: string;
  description?: string | null;
  category: 'todo' | 'followup' | 'notes' | 'meeting';
  date: string; // YYYY-MM-DD
  deadline?: string | null;
  project_id?: string | null;
  assignee_id?: string | null;
  labels?: string[]; // Array of label IDs
}

export interface UpdateNoteInput {
  content?: string;
  description?: string | null;
  category?: 'todo' | 'followup' | 'notes' | 'meeting';
  date?: string;
  deadline?: string | null;
  completed?: boolean;
  pinned?: boolean;
  project_id?: string | null;
  assignee_id?: string | null;
  labels?: string[];
}

// Label CRUD Input Types
export interface CreateLabelInput {
  name: string;
  color: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}

// Project CRUD Input Types
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string;
  emoji?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string;
  emoji?: string;
}

// Contact CRUD Input Types
export interface CreateContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface UpdateContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
}

// HTTP Status Codes
export const HTTPStatusCode = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HTTPStatusCode = typeof HTTPStatusCode[keyof typeof HTTPStatusCode];

// Error Codes
export const APIErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type APIErrorCode = typeof APIErrorCode[keyof typeof APIErrorCode];
