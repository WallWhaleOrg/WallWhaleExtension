/**
 * Batch download management system
 */

import { DownloadApiSdk, Job, CreateJobRequest } from "./sdk";
import { OptimizedDownloadApiSdk } from "./optimized-sdk";

export interface BatchDownloadOptions {
  maxConcurrent?: number;
  retryFailed?: boolean;
  retryAttempts?: number;
  onProgress?: (completed: number, total: number, failed: number) => void;
  onJobComplete?: (job: Job, index: number) => void;
  onJobError?: (error: Error, request: CreateJobRequest, index: number) => void;
}

type RequiredBatchOptions = {
  maxConcurrent: number;
  retryFailed: boolean;
  retryAttempts: number;
  onProgress: (completed: number, total: number, failed: number) => void;
  onJobComplete: (job: Job, index: number) => void;
  onJobError: (error: Error, request: CreateJobRequest, index: number) => void;
};

export interface BatchResult {
  batchId: string;
  successful: Job[];
  failed: { request: CreateJobRequest; error: Error; index: number }[];
  totalTime: number;
}

export class BatchDownloadManager {
  private activeDownloads = new Map<string, Job>();
  private queue: CreateJobRequest[] = [];
  private options: RequiredBatchOptions;

  constructor(
    private sdk: DownloadApiSdk | OptimizedDownloadApiSdk,
    options: BatchDownloadOptions = {}
  ) {
    this.options = {
      maxConcurrent: options.maxConcurrent || 2,
      retryFailed: options.retryFailed ?? true,
      retryAttempts: options.retryAttempts || 3,
      onProgress: options.onProgress || (() => {}),
      onJobComplete: options.onJobComplete || (() => {}),
      onJobError: options.onJobError || (() => {}),
    };
  }

  /**
   * Add multiple jobs to batch processing
   */
  async addBatch(requests: CreateJobRequest[]): Promise<BatchResult> {
    const batchId = `batch_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = Date.now();

    // Add all requests to queue
    this.queue.push(...requests);

    const results = await this.processBatch(batchId);

    return {
      batchId,
      successful: results.successful,
      failed: results.failed,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Process batch of downloads
   */
  private async processBatch(batchId: string): Promise<{
    successful: Job[];
    failed: { request: CreateJobRequest; error: Error; index: number }[];
  }> {
    const successful: Job[] = [];
    const failed: { request: CreateJobRequest; error: Error; index: number }[] =
      [];
    const totalRequests = this.queue.length;

    // Process requests concurrently up to maxConcurrent limit
    const promises: Promise<void>[] = [];

    for (
      let i = 0;
      i < Math.min(this.options.maxConcurrent, this.queue.length);
      i++
    ) {
      promises.push(this.processNextRequest(successful, failed, totalRequests));
    }

    await Promise.allSettled(promises);

    // Process remaining requests
    while (this.queue.length > 0) {
      await this.processNextRequest(successful, failed, totalRequests);
    }

    return { successful, failed };
  }

  /**
   * Process next request in queue
   */
  private async processNextRequest(
    successful: Job[],
    failed: { request: CreateJobRequest; error: Error; index: number }[],
    totalRequests: number
  ): Promise<void> {
    if (this.queue.length === 0) return;

    const request = this.queue.shift()!;
    const index = totalRequests - this.queue.length - 1;

    try {
      const job = await this.sdk.createJob(request);
      const completedJob = await this.sdk.waitForJobCompletion(job.id);

      if (completedJob.status === "completed") {
        successful.push(completedJob);
        this.options.onJobComplete?.(completedJob, index);
      } else {
        const error = new Error(
          `Job failed with status: ${completedJob.status}`
        );
        failed.push({ request, error, index });
        this.options.onJobError?.(error, request, index);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failed.push({ request, error: err, index });
      this.options.onJobError?.(err, request, index);
    }

    // Update progress
    const completed = successful.length + failed.length;
    this.options.onProgress?.(completed, totalRequests, failed.length);
  }

  /**
   * Retry failed downloads
   */
  async retryFailed(
    failedRequests: { request: CreateJobRequest; error: Error; index: number }[]
  ): Promise<BatchResult> {
    if (!this.options.retryFailed) {
      throw new Error("Retry is disabled");
    }

    const retryRequests = failedRequests.map((f) => f.request);
    return this.addBatch(retryRequests);
  }

  /**
   * Get current batch statistics
   */
  getStats(): {
    activeDownloads: number;
    queueLength: number;
    maxConcurrent: number;
  } {
    return {
      activeDownloads: this.activeDownloads.size,
      queueLength: this.queue.length,
      maxConcurrent: this.options.maxConcurrent,
    };
  }

  /**
   * Cancel all pending downloads
   */
  cancelAll(): void {
    this.queue = [];
    // Note: In a real implementation, you'd need to cancel active downloads
    // This would require additional SDK methods for cancellation
  }
}

/**
 * Resumable download manager for large files
 */
export interface DownloadChunk {
  id: string;
  start: number;
  end: number;
  data?: Blob;
  downloaded: boolean;
  retryCount: number;
}

export class ResumableDownloadManager {
  private chunks = new Map<string, DownloadChunk[]>();
  private chunkSize = 1024 * 1024; // 1MB chunks

  constructor(
    private sdk: DownloadApiSdk | OptimizedDownloadApiSdk,
    chunkSize?: number
  ) {
    if (chunkSize) {
      this.chunkSize = chunkSize;
    }
  }

  /**
   * Download file with resumable chunks
   */
  async downloadWithResume(
    jobId: string,
    options: {
      onProgress?: (progress: number) => void;
      onChunkComplete?: (chunk: DownloadChunk) => void;
      maxRetries?: number;
    } = {}
  ): Promise<Blob> {
    const chunks: Blob[] = [];
    let offset = 0;
    let totalSize = 0;

    // First, get job status to determine file size if available
    const job = await this.sdk.getJobStatus(jobId);
    if (job.status !== "completed") {
      throw new Error("Job must be completed before downloading");
    }

    // Download in chunks
    while (true) {
      try {
        const chunk = await this.downloadChunk(jobId, offset, this.chunkSize);

        if (chunk.size === 0) break; // No more data

        chunks.push(chunk);
        totalSize += chunk.size;
        offset += chunk.size;

        options.onProgress?.((offset / (totalSize || offset)) * 100);
        options.onChunkComplete?.({
          id: `chunk_${offset}`,
          start: offset - chunk.size,
          end: offset,
          data: chunk,
          downloaded: true,
          retryCount: 0,
        });
      } catch (error) {
        console.warn(`Failed to download chunk at offset ${offset}:`, error);

        // Retry logic
        let retryCount = 0;
        const maxRetries = options.maxRetries || 3;

        while (retryCount < maxRetries) {
          try {
            const chunk = await this.downloadChunk(
              jobId,
              offset,
              this.chunkSize
            );
            chunks.push(chunk);
            totalSize += chunk.size;
            offset += chunk.size;
            break;
          } catch (retryError) {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw retryError;
            }
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * Math.pow(2, retryCount))
            );
          }
        }
      }
    }

    return new Blob(chunks);
  }

  /**
   * Download a specific chunk
   */
  private async downloadChunk(
    jobId: string,
    offset: number,
    size: number
  ): Promise<Blob> {
    // This is a simplified implementation
    // In a real scenario, you'd need server support for range requests
    const response = await fetch(
      `${(this.sdk as any).baseUrl}/api/v1/downloads/${jobId}/chunk`,
      {
        method: "GET",
        headers: {
          Range: `bytes=${offset}-${offset + size - 1}`,
          ...(this.sdk as any).getHeaders(),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 416) {
        // Range not satisfiable - no more data
        return new Blob([]);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.blob();
  }
}
