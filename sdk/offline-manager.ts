/**
 * Offline queue management for download requests
 */

import { DownloadApiSdk, CreateJobRequest, Job } from "./sdk";
import { OptimizedDownloadApiSdk } from "./optimized-sdk";

export interface QueuedDownload {
  id: string;
  request: CreateJobRequest;
  timestamp: number;
  retryCount: number;
  priority: number;
  metadata?: {
    source?: string;
    userAgent?: string;
    referrer?: string;
  };
}

export interface OfflineManagerOptions {
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  persistenceKey?: string;
  autoSync?: boolean;
}

export class OfflineManager {
  private queue: QueuedDownload[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private options: Required<OfflineManagerOptions>;

  constructor(
    protected sdk: DownloadApiSdk | OptimizedDownloadApiSdk,
    options: OfflineManagerOptions = {}
  ) {
    this.options = {
      maxQueueSize: options.maxQueueSize || 100,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      persistenceKey: options.persistenceKey || "wallwhale_offline_queue",
      autoSync: options.autoSync ?? true,
    };

    this.setupEventListeners();
    this.loadPersistedQueue();
  }

  /**
   * Queue a download request for offline processing
   */
  async queueDownload(
    request: CreateJobRequest,
    priority: number = 0,
    metadata?: QueuedDownload["metadata"]
  ): Promise<string> {
    const queuedDownload: QueuedDownload = {
      id: this.generateId(),
      request,
      timestamp: Date.now(),
      retryCount: 0,
      priority,
      metadata,
    };

    // Check queue size limit
    if (this.queue.length >= this.options.maxQueueSize) {
      // Remove oldest low-priority items if queue is full
      this.evictLowPriorityItems();
    }

    this.queue.push(queuedDownload);
    this.persistQueue();

    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Try to process immediately if online
    if (this.isOnline && this.options.autoSync) {
      this.processOfflineQueue();
    }

    return queuedDownload.id;
  }

  /**
   * Process queued downloads when back online
   */
  async processOfflineQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const itemsToProcess = [...this.queue];

      for (const item of itemsToProcess) {
        if (!this.isOnline) break; // Stop if we go offline

        try {
          await this.sdk.createJob(item.request);

          // Remove successfully processed item
          this.queue = this.queue.filter((q) => q.id !== item.id);
        } catch (error) {
          console.warn(`Failed to process queued download ${item.id}:`, error);
          item.retryCount++;

          if (item.retryCount >= this.options.maxRetries) {
            // Remove item after max retries
            this.queue = this.queue.filter((q) => q.id !== item.id);
            console.error(
              `Removing queued download ${item.id} after ${this.options.maxRetries} retries`
            );
          } else {
            // Wait before retrying
            await new Promise((resolve) =>
              setTimeout(resolve, this.options.retryDelay)
            );
          }
        }
      }

      this.persistQueue();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): {
    queueLength: number;
    isOnline: boolean;
    syncInProgress: boolean;
    oldestItem?: number;
    newestItem?: number;
  } {
    const timestamps = this.queue.map((item) => item.timestamp);

    return {
      queueLength: this.queue.length,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      oldestItem: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestItem: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  /**
   * Get all queued downloads
   */
  getQueuedDownloads(): QueuedDownload[] {
    return [...this.queue];
  }

  /**
   * Remove a specific download from queue
   */
  removeFromQueue(downloadId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((item) => item.id !== downloadId);

    if (this.queue.length !== initialLength) {
      this.persistQueue();
      return true;
    }

    return false;
  }

  /**
   * Clear all queued downloads
   */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
  }

  /**
   * Force sync queued downloads
   */
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error("Cannot sync while offline");
    }

    await this.processOfflineQueue();
  }

  /**
   * Setup network event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener("online", () => {
      this.isOnline = true;
      if (this.options.autoSync) {
        this.processOfflineQueue();
      }
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });

    // Periodic cleanup of old items
    setInterval(() => {
      this.cleanupOldItems();
    }, 60000); // Clean up every minute
  }

  /**
   * Persist queue to localStorage
   */
  private persistQueue(): void {
    try {
      const serialized = JSON.stringify(this.queue);
      localStorage.setItem(this.options.persistenceKey, serialized);
    } catch (error) {
      console.warn("Failed to persist offline queue:", error);
    }
  }

  /**
   * Load persisted queue from localStorage
   */
  private loadPersistedQueue(): void {
    try {
      const serialized = localStorage.getItem(this.options.persistenceKey);
      if (serialized) {
        const parsed = JSON.parse(serialized) as QueuedDownload[];
        this.queue = parsed;

        // Sort by priority and timestamp
        this.queue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.timestamp - b.timestamp;
        });
      }
    } catch (error) {
      console.warn("Failed to load persisted offline queue:", error);
      this.queue = [];
    }
  }

  /**
   * Evict low priority items when queue is full
   */
  private evictLowPriorityItems(): void {
    // Find lowest priority
    const priorities = this.queue.map((item) => item.priority);
    const minPriority = Math.min(...priorities);

    // Remove oldest items with lowest priority
    this.queue = this.queue.filter((item) => item.priority > minPriority);

    // If still over limit, remove oldest items regardless of priority
    if (this.queue.length >= this.options.maxQueueSize) {
      this.queue.sort((a, b) => a.timestamp - b.timestamp);
      this.queue = this.queue.slice(-this.options.maxQueueSize + 10); // Keep some buffer
    }
  }

  /**
   * Clean up old items from queue
   */
  private cleanupOldItems(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const initialLength = this.queue.length;

    this.queue = this.queue.filter((item) => {
      // Keep items that are recent or have been retried few times
      return (
        item.timestamp > oneDayAgo || item.retryCount < this.options.maxRetries
      );
    });

    if (this.queue.length !== initialLength) {
      this.persistQueue();
    }
  }

  /**
   * Generate unique ID for queued download
   */
  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Enhanced Offline Manager with batch processing
 */
export class BatchOfflineManager extends OfflineManager {
  private batchSize = 5;

  constructor(
    sdk: DownloadApiSdk | OptimizedDownloadApiSdk,
    options: OfflineManagerOptions & { batchSize?: number } = {}
  ) {
    super(sdk, options);
    this.batchSize = options.batchSize || 5;
  }

  /**
   * Process offline queue in batches
   */
  async processOfflineQueue(): Promise<void> {
    if (this.getStats().syncInProgress || !this.getStats().isOnline) {
      return;
    }

    const queuedItems = this.getQueuedDownloads();
    if (queuedItems.length === 0) return;

    // Process in batches
    for (let i = 0; i < queuedItems.length; i += this.batchSize) {
      const batch = queuedItems.slice(i, i + this.batchSize);

      try {
        // Process batch concurrently
        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              await this.sdk.createJob(item.request);
              this.removeFromQueue(item.id);
            } catch (error) {
              console.warn(`Batch item ${item.id} failed:`, error);
              // Retry logic would be handled by parent class
            }
          })
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Batch processing failed:", error);
        break; // Stop processing if batch fails
      }
    }
  }
}
