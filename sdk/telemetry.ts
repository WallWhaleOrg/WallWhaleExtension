/**
 * Comprehensive telemetry and analytics system for download operations
 */

import { Job, CreateJobRequest } from "./sdk";

export interface DownloadEvent {
  type:
    | "started"
    | "progress"
    | "completed"
    | "failed"
    | "cancelled"
    | "retried";
  timestamp: number;
  jobId?: string;
  data?: any;
  metadata?: {
    userAgent?: string;
    referrer?: string;
    networkType?: string;
    downloadSpeed?: number;
  };
}

export interface MetricData {
  startTime: number;
  endTime?: number;
  events: DownloadEvent[];
  totalBytes?: number;
  errorCount: number;
  retryCount: number;
  averageResponseTime?: number;
}

export interface DownloadAnalytics {
  totalDownloads: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  retryRate: number;
  peakConcurrentDownloads: number;
  averageDownloadSpeed: number;
  networkEfficiency: number;
  timeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
}

export class DownloadTelemetry {
  private metrics = new Map<string, MetricData>();
  private events: DownloadEvent[] = [];
  private maxEvents = 1000;
  private sessionStartTime = Date.now();

  /**
   * Track a download event
   */
  trackEvent(event: DownloadEvent): void {
    // Add to global events list
    this.events.push(event);

    // Keep events list bounded
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Update metrics for specific job if applicable
    if (event.jobId) {
      this.updateJobMetrics(event.jobId, event);
    }

    // Log significant events
    this.logSignificantEvent(event);
  }

  /**
   * Track download start
   */
  trackDownloadStart(jobId: string, request: CreateJobRequest): void {
    const metric: MetricData = {
      startTime: Date.now(),
      events: [],
      errorCount: 0,
      retryCount: 0,
    };

    this.metrics.set(jobId, metric);

    this.trackEvent({
      type: "started",
      timestamp: Date.now(),
      jobId,
      data: { request },
      metadata: {
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        networkType: (navigator as any).connection?.effectiveType,
      },
    });
  }

  /**
   * Track download progress
   */
  trackDownloadProgress(jobId: string, progress: number, speed?: number): void {
    this.trackEvent({
      type: "progress",
      timestamp: Date.now(),
      jobId,
      data: { progress, speed },
      metadata: { downloadSpeed: speed },
    });
  }

  /**
   * Track download completion
   */
  trackDownloadComplete(jobId: string, totalBytes?: number): void {
    const metric = this.metrics.get(jobId);
    if (metric) {
      metric.endTime = Date.now();
      metric.totalBytes = totalBytes;
    }

    this.trackEvent({
      type: "completed",
      timestamp: Date.now(),
      jobId,
      data: {
        totalBytes,
        duration: metric ? Date.now() - metric.startTime : 0,
      },
    });
  }

  /**
   * Track download failure
   */
  trackDownloadError(jobId: string, error: Error): void {
    const metric = this.metrics.get(jobId);
    if (metric) {
      metric.errorCount++;
    }

    this.trackEvent({
      type: "failed",
      timestamp: Date.now(),
      jobId,
      data: {
        error: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Track download retry
   */
  trackDownloadRetry(jobId: string, attempt: number): void {
    const metric = this.metrics.get(jobId);
    if (metric) {
      metric.retryCount++;
    }

    this.trackEvent({
      type: "retried",
      timestamp: Date.now(),
      jobId,
      data: { attempt },
    });
  }

  /**
   * Get analytics for a specific job
   */
  getJobAnalytics(jobId: string): MetricData | null {
    return this.metrics.get(jobId) || null;
  }

  /**
   * Get comprehensive download analytics
   */
  getAnalytics(timeRange?: { start: number; end: number }): DownloadAnalytics {
    const relevantMetrics = this.getMetricsInRange(timeRange);
    const completedJobs = relevantMetrics.filter((m) => m.endTime);

    const totalDownloads = relevantMetrics.length;
    const successfulDownloads = completedJobs.length;
    const successRate =
      totalDownloads > 0 ? successfulDownloads / totalDownloads : 0;

    const averageDuration =
      completedJobs.length > 0
        ? completedJobs.reduce(
            (sum, m) => sum + (m.endTime! - m.startTime),
            0
          ) / completedJobs.length
        : 0;

    const totalErrors = relevantMetrics.reduce(
      (sum, m) => sum + m.errorCount,
      0
    );
    const errorRate = totalDownloads > 0 ? totalErrors / totalDownloads : 0;

    const totalRetries = relevantMetrics.reduce(
      (sum, m) => sum + m.retryCount,
      0
    );
    const retryRate = totalDownloads > 0 ? totalRetries / totalDownloads : 0;

    return {
      totalDownloads,
      successRate,
      averageDuration,
      errorRate,
      retryRate,
      peakConcurrentDownloads: this.calculatePeakConcurrency(relevantMetrics),
      averageDownloadSpeed: this.calculateAverageSpeed(completedJobs),
      networkEfficiency: this.calculateNetworkEfficiency(relevantMetrics),
      timeDistribution: this.calculateTimeDistribution(relevantMetrics),
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
  } {
    const completedJobs = Array.from(this.metrics.values()).filter(
      (m) => m.endTime
    );
    const responseTimes = completedJobs.map((m) => m.endTime! - m.startTime);

    if (responseTimes.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
      };
    }

    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index];

    const totalErrors = Array.from(this.metrics.values()).reduce(
      (sum, m) => sum + m.errorCount,
      0
    );
    const errorRate = totalErrors / this.metrics.size;

    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000; // in seconds
    const throughput = completedJobs.length / sessionDuration; // jobs per second

    return {
      averageResponseTime:
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime,
      errorRate,
      throughput,
    };
  }

  /**
   * Export telemetry data
   */
  exportData(): {
    metrics: Record<string, MetricData>;
    events: DownloadEvent[];
    sessionInfo: {
      startTime: number;
      duration: number;
      userAgent: string;
    };
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      events: [...this.events],
      sessionInfo: {
        startTime: this.sessionStartTime,
        duration: Date.now() - this.sessionStartTime,
        userAgent: navigator.userAgent,
      },
    };
  }

  /**
   * Clear old data
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;

    // Remove old metrics
    for (const [jobId, metric] of this.metrics.entries()) {
      if (metric.startTime < cutoffTime) {
        this.metrics.delete(jobId);
      }
    }

    // Remove old events
    this.events = this.events.filter((event) => event.timestamp >= cutoffTime);
  }

  /**
   * Update job metrics with new event
   */
  private updateJobMetrics(jobId: string, event: DownloadEvent): void {
    const metric = this.metrics.get(jobId);
    if (!metric) return;

    metric.events.push(event);

    // Update end time for terminal events
    if (["completed", "failed", "cancelled"].includes(event.type)) {
      metric.endTime = event.timestamp;
    }
  }

  /**
   * Log significant events to console
   */
  private logSignificantEvent(event: DownloadEvent): void {
    const logLevel =
      event.type === "failed"
        ? "error"
        : event.type === "completed"
        ? "info"
        : "debug";

    const message = `[DownloadTelemetry] ${event.type.toUpperCase()} ${
      event.jobId || ""
    }`;

    switch (logLevel) {
      case "error":
        console.error(message, event.data);
        break;
      case "info":
        console.info(message, event.data);
        break;
      default:
        console.debug(message, event.data);
    }
  }

  /**
   * Get metrics within time range
   */
  private getMetricsInRange(timeRange?: {
    start: number;
    end: number;
  }): MetricData[] {
    const metrics = Array.from(this.metrics.values());

    if (!timeRange) return metrics;

    return metrics.filter(
      (m) =>
        m.startTime >= timeRange.start &&
        (!m.endTime || m.endTime <= timeRange.end)
    );
  }

  /**
   * Calculate peak concurrent downloads
   */
  private calculatePeakConcurrency(metrics: MetricData[]): number {
    const events = metrics.flatMap((m) => m.events);
    const timePoints = new Map<number, number>();

    for (const metric of metrics) {
      // Count active downloads at different time points
      const startTime = metric.startTime;
      const endTime = metric.endTime || Date.now();

      timePoints.set(startTime, (timePoints.get(startTime) || 0) + 1);
      timePoints.set(endTime, (timePoints.get(endTime) || 0) - 1);
    }

    let current = 0;
    let peak = 0;

    for (const count of timePoints.values()) {
      current += count;
      peak = Math.max(peak, current);
    }

    return peak;
  }

  /**
   * Calculate average download speed
   */
  private calculateAverageSpeed(completedJobs: MetricData[]): number {
    const speeds = completedJobs
      .filter((m) => m.totalBytes && m.endTime)
      .map((m) => {
        const duration = (m.endTime! - m.startTime) / 1000; // seconds
        return m.totalBytes! / duration; // bytes per second
      });

    return speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0;
  }

  /**
   * Calculate network efficiency
   */
  private calculateNetworkEfficiency(metrics: MetricData[]): number {
    const totalRetries = metrics.reduce((sum, m) => sum + m.retryCount, 0);
    const totalRequests = metrics.length + totalRetries;

    return totalRequests > 0 ? metrics.length / totalRequests : 1;
  }

  /**
   * Calculate time distribution of downloads
   */
  private calculateTimeDistribution(
    metrics: MetricData[]
  ): DownloadAnalytics["timeDistribution"] {
    const distribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    for (const metric of metrics) {
      const hour = new Date(metric.startTime).getHours();

      if (hour >= 6 && hour < 12) distribution.morning++;
      else if (hour >= 12 && hour < 18) distribution.afternoon++;
      else if (hour >= 18 && hour < 22) distribution.evening++;
      else distribution.night++;
    }

    return distribution;
  }
}

// Global telemetry instance
export const globalTelemetry = new DownloadTelemetry();
