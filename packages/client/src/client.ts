/**
 * Triple-A API Client
 *
 * HTTP client with:
 * - Automatic authentication headers
 * - Error handling for API-specific error codes
 * - Retry logic for transient errors
 * - Request/response logging (if DEBUG=1)
 */

import type {
  Note,
  Label,
  Project,
  Contact,
  APIResponse,
  NotesQueryParams,
  CreateNoteInput,
  UpdateNoteInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateContactInput,
  UpdateContactInput,
  SearchRequest,
  BatchRequest,
  BatchResponse,
} from '@triple-a/types';

import { createConfig, type ClientConfig } from './config';

export interface ClientError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export class TripleAClient {
  private baseURL: string;
  private apiKey: string;
  private timeout: number;
  private retries: number;

  constructor(options?: Partial<ClientConfig>) {
    const config = createConfig(options);
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
    this.retries = config.retries;
  }

  /**
   * Make an HTTP request to the Triple-A API
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 1
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    if (process.env.DEBUG) {
      console.log(`[${method}] ${path}`);
      if (body) {
        console.log('Body:', JSON.stringify(body, null, 2));
      }
    }

    try {
      const response = await fetch(url, options);

      if (process.env.DEBUG) {
        console.log(`Response: ${response.status} ${response.statusText}`);
      }

      // Handle successful responses
      if (response.ok) {
        const data = await response.json();
        return data as T;
      }

      // Handle error responses
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
        code: 'UNKNOWN_ERROR',
      }));

      // Retry on rate limiting (429)
      if (response.status === 429 && attempt < this.retries) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        console.error(
          `Rate limit exceeded. Retrying in ${retryAfter} seconds (attempt ${attempt}/${this.retries})...`
        );
        await this.sleep(retryAfter * 1000);
        return this.request<T>(method, path, body, attempt + 1);
      }

      // Retry on server errors (500)
      if (response.status >= 500 && attempt < this.retries) {
        console.error(
          `Server error (${response.status}). Retrying (attempt ${attempt}/${this.retries})...`
        );
        await this.sleep(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
        return this.request<T>(method, path, body, attempt + 1);
      }

      // Throw error for non-retryable errors
      const error = new Error(errorData.error || 'API request failed') as ClientError;
      error.code = errorData.code;
      error.status = response.status;
      error.details = errorData.details;
      throw error;
    } catch (err) {
      // Handle network errors and timeouts
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          throw new Error(
            `Network error: Unable to reach ${this.baseURL}. Is the server running?`
          );
        }
      }

      throw err;
    }
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build query string from params
   */
  private buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  // ============================================
  // Notes API
  // ============================================

  /**
   * Get all notes with optional filters
   */
  async getNotes(params?: NotesQueryParams): Promise<APIResponse<Note[]>> {
    return this.request('GET', '/api/v1/notes' + this.buildQuery(params as Record<string, unknown>));
  }

  /**
   * Get a single note by ID
   */
  async getNote(id: string): Promise<Note> {
    const response = await this.request<APIResponse<Note>>('GET', `/api/v1/notes/${id}`);
    return response.data;
  }

  /**
   * Create a new note
   */
  async createNote(data: CreateNoteInput): Promise<Note> {
    const response = await this.request<APIResponse<Note>>('POST', '/api/v1/notes', data);
    return response.data;
  }

  /**
   * Update a note (partial update)
   */
  async updateNote(id: string, data: UpdateNoteInput): Promise<Note> {
    const response = await this.request<APIResponse<Note>>('PATCH', `/api/v1/notes/${id}`, data);
    return response.data;
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/notes/${id}`);
  }

  /**
   * Search notes
   */
  async searchNotes(request: SearchRequest): Promise<APIResponse<Note[]>> {
    return this.request('POST', '/api/v1/search', request);
  }

  // ============================================
  // Labels API
  // ============================================

  /**
   * Get all labels
   */
  async getLabels(): Promise<APIResponse<Label[]>> {
    return this.request('GET', '/api/v1/labels');
  }

  /**
   * Get a single label by ID
   */
  async getLabel(id: string): Promise<Label> {
    const response = await this.request<APIResponse<Label>>('GET', `/api/v1/labels/${id}`);
    return response.data;
  }

  /**
   * Create a new label
   */
  async createLabel(data: CreateLabelInput): Promise<Label> {
    const response = await this.request<APIResponse<Label>>('POST', '/api/v1/labels', data);
    return response.data;
  }

  /**
   * Update a label
   */
  async updateLabel(id: string, data: UpdateLabelInput): Promise<Label> {
    const response = await this.request<APIResponse<Label>>('PUT', `/api/v1/labels/${id}`, data);
    return response.data;
  }

  /**
   * Delete a label
   */
  async deleteLabel(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/labels/${id}`);
  }

  // ============================================
  // Projects API
  // ============================================

  /**
   * Get all projects
   */
  async getProjects(): Promise<APIResponse<Project[]>> {
    return this.request('GET', '/api/v1/projects');
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<Project> {
    const response = await this.request<APIResponse<Project>>('GET', `/api/v1/projects/${id}`);
    return response.data;
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectInput): Promise<Project> {
    const response = await this.request<APIResponse<Project>>('POST', '/api/v1/projects', data);
    return response.data;
  }

  /**
   * Update a project
   */
  async updateProject(id: string, data: UpdateProjectInput): Promise<Project> {
    const response = await this.request<APIResponse<Project>>('PUT', `/api/v1/projects/${id}`, data);
    return response.data;
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/projects/${id}`);
  }

  // ============================================
  // Contacts API
  // ============================================

  /**
   * Get all contacts
   */
  async getContacts(): Promise<APIResponse<Contact[]>> {
    return this.request('GET', '/api/v1/contacts');
  }

  /**
   * Get a single contact by ID
   */
  async getContact(id: string): Promise<Contact> {
    const response = await this.request<APIResponse<Contact>>('GET', `/api/v1/contacts/${id}`);
    return response.data;
  }

  /**
   * Create a new contact
   */
  async createContact(data: CreateContactInput): Promise<Contact> {
    const response = await this.request<APIResponse<Contact>>('POST', '/api/v1/contacts', data);
    return response.data;
  }

  /**
   * Update a contact
   */
  async updateContact(id: string, data: UpdateContactInput): Promise<Contact> {
    const response = await this.request<APIResponse<Contact>>('PUT', `/api/v1/contacts/${id}`, data);
    return response.data;
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/contacts/${id}`);
  }

  // ============================================
  // Batch API
  // ============================================

  /**
   * Execute batch operations
   */
  async batch(request: BatchRequest): Promise<BatchResponse> {
    return this.request('POST', '/api/v1/batch', request);
  }

  // ============================================
  // History API
  // ============================================

  /**
   * Get note history
   */
  async getHistory(noteId?: string): Promise<APIResponse<unknown[]>> {
    const path = noteId ? `/api/v1/history?note_id=${noteId}` : '/api/v1/history';
    return this.request('GET', path);
  }

  // ============================================
  // Low-level HTTP methods (for advanced usage)
  // ============================================

  /**
   * GET request (low-level)
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * POST request (low-level)
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * PUT request (low-level)
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * PATCH request (low-level)
   */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * DELETE request (low-level)
   */
  async del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

/**
 * Create a new Triple-A client instance
 */
export function createClient(options?: Partial<ClientConfig>): TripleAClient {
  return new TripleAClient(options);
}
