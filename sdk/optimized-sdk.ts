/**
 * Optimized SDK with caching, circuit breaker, and connection pooling
 */

import { DownloadApiSdk, Job, CreateJobRequest, SdkConfig } from "./sdk";
import { SmartCache } from "./smart-cache";
import {
  CircuitBreaker,
  ExponentialBackoffCircuitBreaker,
} from "./circuit-breaker";
import { PooledHttpClient } from "./connection-pool";

export interface OptimizedSdkOptions {
  enableCache?: boolean;
  enableCircuitBreaker?: boolean;
  enableConnectionPooling?: boolean;
  cacheTtl?: number;
  circuitBreakerOptions?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    useExponentialBackoff?: boolean;
  };
  connectionPoolOptions?: {
    maxConnections?: number;
    timeout?: number;
    retryAttempts?: number;
  };
}

export class OptimizedDownloadApiSdk extends DownloadApiSdk {
  private cache: SmartCache;
  private circuitBreaker: CircuitBreaker | ExponentialBackoffCircuitBreaker;
  private httpClient: PooledHttpClient;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private options: Required<OptimizedSdkOptions>;

  constructor(config: SdkConfig, options: OptimizedSdkOptions = {}) {
    super(config);

    this.options = {
      enableCache: options.enableCache ?? true,
      enableCircuitBreaker: options.enableCircuitBreaker ?? true,
      enableConnectionPooling: options.enableConnectionPooling ?? true,
      cacheTtl: options.cacheTtl || 30000,
      circuitBreakerOptions: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        useExponentialBackoff: false,
        ...options.circuitBreakerOptions,
      },
      connectionPoolOptions: {
        maxConnections: 3,
        timeout: 10000,
        retryAttempts: 3,
        ...options.connectionPoolOptions,
      },
    };

    // Initialize components
    this.cache = new SmartCache({
      defaultTtl: this.options.cacheTtl,
      maxSize: 100,
    });

    this.circuitBreaker = this.options.circuitBreakerOptions
      .useExponentialBackoff
      ? new ExponentialBackoffCircuitBreaker(this.options.circuitBreakerOptions)
      : new CircuitBreaker(this.options.circuitBreakerOptions);

    this.httpClient = new PooledHttpClient(this.options.connectionPoolOptions);
  }

  /**
   * Enhanced request execution with all optimizations
   */
  private async executeWithOptimizations<T>(
    operation: string,
    requestFn: () => Promise<T>,
    cacheKey?: string,
    useCache: boolean = true
  ): Promise<T> {
    // Check cache first
    if (useCache && cacheKey && this.options.enableCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Request deduplication
    if (this.requestQueue.has(operation)) {
      return this.requestQueue.get(operation)!;
    }

    const executeRequest = async (): Promise<T> => {
      if (this.options.enableCircuitBreaker) {
        return this.circuitBreaker.execute(requestFn);
      }
      return requestFn();
    };

    const promise = executeRequest().finally(() => {
      this.requestQueue.delete(operation);
    });

    this.requestQueue.set(operation, promise);
    const result = await promise;

    // Cache the result
    if (useCache && cacheKey && this.options.enableCache) {
      this.cache.set(cacheKey, result, this.options.cacheTtl);
    }

    return result;
  }

  /**
   * Enhanced createJob with optimizations
   */
  async createJob(request: CreateJobRequest): Promise<Job> {
    const operation = `createJob_${JSON.stringify(request)}`;

    return this.executeWithOptimizations(
      operation,
      async () => {
        if (this.options.enableConnectionPooling) {
          return this.httpClient.post<Job>(
            `${this.baseUrl}/api/v1/downloads`,
            request,
            {
              headers: this.getHeaders(),
              priority: 1, // High priority for job creation
            } as any
          );
        }

        // Fallback to original implementation
        return super.createJob(request);
      },
      undefined, // Don't cache job creation
      false
    );
  }

  /**
   * Enhanced getJobStatus with caching
   */
  async getJobStatus(jobId: string): Promise<Job> {
    const operation = `getJobStatus_${jobId}`;
    const cacheKey = `job_status_${jobId}`;

    return this.executeWithOptimizations(
      operation,
      async () => {
        if (this.options.enableConnectionPooling) {
          return this.httpClient.get<Job>(
            `${this.baseUrl}/api/v1/downloads/${jobId}`,
            {
              headers: this.getHeaders(),
              priority: 2, // Medium priority for status checks
            } as any
          );
        }

        return super.getJobStatus(jobId);
      },
      cacheKey,
      true
    );
  }

  /**
   * Enhanced cancelJob
   */
  async cancelJob(jobId: string): Promise<void> {
    const operation = `cancelJob_${jobId}`;

    // Invalidate cache for this job
    this.cache.invalidate(`job_status_${jobId}`);

    return this.executeWithOptimizations(
      operation,
      async () => {
        if (this.options.enableConnectionPooling) {
          return this.httpClient.post<void>(
            `${this.baseUrl}/api/v1/downloads/${jobId}/cancel`,
            undefined,
            {
              headers: this.getHeaders(),
              priority: 1,
            } as any
          );
        }

        return super.cancelJob(jobId);
      },
      undefined,
      false
    );
  }

  /**
   * Enhanced downloadJobZip with optimizations
   */
  async downloadJobZip(jobId: string): Promise<Blob> {
    const operation = `downloadJobZip_${jobId}`;

    return this.executeWithOptimizations(
      operation,
      async () => {
        if (this.options.enableConnectionPooling) {
          const response = await fetch(
            `${this.baseUrl}/api/v1/downloads/${jobId}/zip`,
            {
              method: "GET",
              headers: this.getHeaders(),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.blob();
        }

        return super.downloadJobZip(jobId);
      },
      undefined, // Don't cache blobs
      false
    );
  }

  /**
   * Enhanced waitForJobCompletion with smart polling
   */
  async waitForJobCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onStatusUpdate?: (job: Job) => void;
    } = {}
  ): Promise<Job> {
    const { pollInterval = 2000, timeout = 300000, onStatusUpdate } = options;

    const startTime = Date.now();
    let lastStatus: Job | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        const job = await this.getJobStatus(jobId);
        lastStatus = job;

        if (onStatusUpdate) {
          onStatusUpdate(job);
        }

        if (["completed", "failed", "cancelled"].includes(job.status)) {
          return job;
        }

        // Adaptive polling - increase interval for long-running jobs
        const elapsed = Date.now() - startTime;
        const adaptiveInterval =
          elapsed > 60000 ? pollInterval * 2 : pollInterval;

        await new Promise((resolve) => setTimeout(resolve, adaptiveInterval));
      } catch (error) {
        console.warn(`Failed to get job status for ${jobId}:`, error);
        // Continue polling despite errors
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Job ${jobId} timed out after ${timeout}ms. Last status: ${
        lastStatus?.status || "unknown"
      }`
    );
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cacheStats: any;
    circuitBreakerStats: any;
    connectionPoolStats: any;
    activeRequests: number;
  } {
    return {
      cacheStats: this.cache.getStats(),
      circuitBreakerStats: this.circuitBreaker.getStats(),
      connectionPoolStats: this.httpClient.getStats(),
      activeRequests: this.requestQueue.size,
    };
  }

  /**
   * Clear all caches and reset circuit breaker
   */
  clearOptimizations(): void {
    this.cache.clear();
    this.circuitBreaker.forceClose();
  }

  /**
   * Gracefully shutdown optimizations
   */
  async shutdown(): Promise<void> {
    await this.httpClient.drain();
    this.clearOptimizations();
  }
}

/**
 * Factory function for optimized SDK
 */
export function createOptimizedSdk(
  config: SdkConfig,
  options?: OptimizedSdkOptions
): OptimizedDownloadApiSdk {
  return new OptimizedDownloadApiSdk(config, options);
}
