/**
 * Circuit Breaker pattern implementation for resilient API calls
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  successThreshold?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  totalRequests: number;
}

export class CircuitBreaker {
  protected failures = 0;
  protected successes = 0;
  protected totalRequests = 0;
  protected lastFailureTime = 0;
  protected state: CircuitState = "CLOSED";
  protected options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 10000, // 10 seconds
      successThreshold: options.successThreshold || 3,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Last failure: ${new Date(
            this.lastFailureTime
          ).toISOString()}`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;

    if (this.state === "HALF_OPEN") {
      // Check if we've met the success threshold to close the circuit
      if (this.successes >= this.options.successThreshold) {
        this.reset();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = "OPEN";
    }
  }

  /**
   * Check if circuit should attempt to reset
   */
  protected shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.options.recoveryTimeout;
  }

  /**
   * Reset circuit breaker to closed state
   */
  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = "CLOSED";
  }

  /**
   * Manually trip the circuit breaker
   */
  trip(): void {
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to closed state
   */
  forceClose(): void {
    this.reset();
  }

  /**
   * Force circuit to open state
   */
  forceOpen(): void {
    this.trip();
  }
}

/**
 * Enhanced Circuit Breaker with exponential backoff
 */
export class ExponentialBackoffCircuitBreaker extends CircuitBreaker {
  private backoffMultiplier = 2;
  private maxBackoffTime = 300000; // 5 minutes

  constructor(
    options: CircuitBreakerOptions & {
      backoffMultiplier?: number;
      maxBackoffTime?: number;
    } = {}
  ) {
    super(options);
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.maxBackoffTime = options.maxBackoffTime || 300000;
  }

  /**
   * Calculate backoff time with exponential increase
   */
  private calculateBackoffTime(): number {
    const baseBackoff = this.options.recoveryTimeout;
    const exponentialBackoff =
      baseBackoff *
      Math.pow(this.backoffMultiplier, Math.min(this.failures, 10));
    return Math.min(exponentialBackoff, this.maxBackoffTime);
  }

  /**
   * Override shouldAttemptReset to use exponential backoff
   */
  protected shouldAttemptReset(): boolean {
    const backoffTime = this.calculateBackoffTime();
    return Date.now() - this.lastFailureTime > backoffTime;
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuits
 */
export class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a specific service
   */
  getCircuit(
    serviceName: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, new CircuitBreaker(options));
    }
    return this.circuits.get(serviceName)!;
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = circuit.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.forceClose();
    }
  }

  /**
   * Remove a circuit breaker
   */
  removeCircuit(serviceName: string): boolean {
    return this.circuits.delete(serviceName);
  }
}

// Global circuit breaker registry
export const globalCircuitRegistry = new CircuitBreakerRegistry();
