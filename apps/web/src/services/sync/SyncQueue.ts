import { generateId } from '@/store/schema';
import type { QueuedOperation, SyncServiceConfig, SyncTable } from './types';

const STORAGE_KEY = 'triple-a-sync-queue';

/**
 * SyncQueue manages failed sync operations with exponential backoff retry.
 * Persists to localStorage so retries survive page reloads.
 */
export class SyncQueue {
  private queue: QueuedOperation[] = [];
  private config: SyncServiceConfig;

  constructor(config: SyncServiceConfig) {
    this.config = config;
    this.loadFromStorage();
  }

  /**
   * Add an operation to the retry queue.
   * If an operation for the same table+localId exists, update it.
   */
  enqueue(op: {
    table: SyncTable;
    operation: 'upsert' | 'delete';
    localId: string;
    data: Record<string, unknown>;
    lastError?: string;
  }): void {
    const existing = this.queue.find(
      (q) => q.table === op.table && q.localId === op.localId
    );

    if (existing) {
      // Update existing with new data
      existing.data = op.data;
      existing.lastError = op.lastError;
      existing.retryCount++;
      existing.nextRetryAt = this.calculateNextRetry(existing.retryCount);
    } else {
      this.queue.push({
        id: generateId(),
        table: op.table,
        operation: op.operation,
        localId: op.localId,
        data: op.data,
        retryCount: 0,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
        lastError: op.lastError,
      });
    }

    this.persistToStorage();
  }

  /**
   * Get all operations that are ready to be retried (nextRetryAt <= now).
   */
  getReadyItems(): QueuedOperation[] {
    const now = Date.now();
    return this.queue.filter((op) => op.nextRetryAt <= now);
  }

  /**
   * Get all items that have exceeded max retries.
   */
  getFailedItems(): QueuedOperation[] {
    return this.queue.filter((op) => op.retryCount >= this.config.maxRetries);
  }

  /**
   * Remove an operation from the queue (call after successful sync).
   */
  remove(id: string): void {
    this.queue = this.queue.filter((op) => op.id !== id);
    this.persistToStorage();
  }

  /**
   * Remove operation by table and localId.
   */
  removeByLocalId(table: SyncTable, localId: string): void {
    this.queue = this.queue.filter(
      (op) => !(op.table === table && op.localId === localId)
    );
    this.persistToStorage();
  }

  /**
   * Clear all operations from the queue.
   */
  clear(): void {
    this.queue = [];
    this.persistToStorage();
  }

  /**
   * Get the number of pending operations.
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Get all queued operations.
   */
  getAll(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Calculate next retry time using exponential backoff with jitter.
   */
  private calculateNextRetry(retryCount: number): number {
    const delay = Math.min(
      this.config.baseRetryDelay * Math.pow(2, retryCount),
      this.config.maxRetryDelay
    );
    // Add 0-20% jitter to prevent thundering herd
    const jitter = delay * 0.2 * Math.random();
    return Date.now() + delay + jitter;
  }

  /**
   * Load queue from localStorage.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch {
      console.warn('[SyncQueue] Failed to load from storage, starting fresh');
      this.queue = [];
    }
  }

  /**
   * Persist queue to localStorage.
   */
  private persistToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[SyncQueue] Failed to persist queue:', e);
    }
  }
}
