/**
 * Connection pooling for efficient API request management
 */

export interface ConnectionPoolOptions {
  maxConnections?: number;
  timeout?: number;
  retryAttempts?: number;
  keepAlive?: boolean;
}

export interface QueuedRequest<T> {
  id: string;
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
}

export class ConnectionPool {
  private activeConnections = 0;
  private queue: QueuedRequest<any>[] = [];
  private options: Required<ConnectionPoolOptions>;

  constructor(options: ConnectionPoolOptions = {}) {
    this.options = {
      maxConnections: options.maxConnections || 3,
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 3,
      keepAlive: options.keepAlive || false,
    };
  }

  /**
   * Execute a request through the connection pool
   */
  async execute<T>(
    request: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: this.generateId(),
        request,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
      };

      this.queue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.activeConnections >= this.options.maxConnections) {
      return;
    }

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    while (
      this.queue.length > 0 &&
      this.activeConnections < this.options.maxConnections
    ) {
      const request = this.queue.shift()!;
      this.activeConnections++;
      this.executeRequest(request);
    }
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(
    queuedRequest: QueuedRequest<T>
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Request timeout")),
            this.options.timeout
          );
        });

        const result = await Promise.race([
          queuedRequest.request(),
          timeoutPromise,
        ]);

        queuedRequest.resolve(result);
        this.activeConnections--;
        this.processQueue();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.options.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    queuedRequest.reject(
      lastError || new Error("Request failed after all retries")
    );
    this.activeConnections--;
    this.processQueue();
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    activeConnections: number;
    maxConnections: number;
    queueLength: number;
    utilization: number;
  } {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.options.maxConnections,
      queueLength: this.queue.length,
      utilization: this.activeConnections / this.options.maxConnections,
    };
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    const error = new Error("Request cancelled due to queue clear");
    for (const request of this.queue) {
      request.reject(error);
    }
    this.queue = [];
  }

  /**
   * Drain the pool (wait for all active requests to complete)
   */
  async drain(): Promise<void> {
    while (this.activeConnections > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * HTTP Client with connection pooling
 */
export class PooledHttpClient {
  private pool: ConnectionPool;

  constructor(options: ConnectionPoolOptions = {}) {
    this.pool = new ConnectionPool(options);
  }

  /**
   * Make HTTP request through connection pool
   */
  async request<T>(
    url: string,
    options: RequestInit & { priority?: number } = {}
  ): Promise<T> {
    const { priority = 0, ...fetchOptions } = options;

    return this.pool.execute(async () => {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    }, priority);
  }

  /**
   * GET request
   */
  async get<T>(
    url: string,
    options: Omit<RequestInit, "method"> & { priority?: number } = {}
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  /**
   * POST request
   */
  async post<T>(
    url: string,
    data?: any,
    options: Omit<RequestInit, "method" | "body"> & { priority?: number } = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Drain the connection pool
   */
  async drain(): Promise<void> {
    return this.pool.drain();
  }
}

// Global connection pool instance
export const globalConnectionPool = new PooledHttpClient({
  maxConnections: 3,
  timeout: 10000,
  retryAttempts: 3,
});
