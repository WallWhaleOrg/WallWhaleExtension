/**
 * @file Implements the main SDK for interacting with the WallWhale Download API.
 */

/**
 * Represents a download job on the server.
 */
export interface Job {
  /**
   * Unique identifier for the job.
   * @type {string}
   */
  id: string;

  /**
   * Identifier for the published file being downloaded.
   * @type {string}
   */
  pubfileId: string;

  /**
   * The current status of the job (e.g., "pending", "downloading", "completed", "failed").
   * @type {string}
   */
  status: string;

  /**
   * The account name used for the download.
   * @type {string}
   */
  accountName: string;

  /**
   * The root directory where the file will be saved on the server.
   * @type {string}
   */
  saveRoot: string;

  /**
   * Timestamp (in milliseconds) when the job started. Optional.
   * @type {number | undefined}
   */
  startedAt?: number;

  /**
   * Timestamp (in milliseconds) when the job finished. Optional.
   * @type {number | undefined}
   */
  finishedAt?: number;

  /**
   * Error message if the job failed. Optional.
   * @type {string | undefined}
   */
  error?: string;
}

/**
 * Defines the request payload for creating a new download job.
 */
export interface CreateJobRequest {
  /**
   * The URL or ID of the item to download.
   * @type {string}
   */
  urlOrId: string;

  /**
   * The account name to use for authentication.
   * @type {string}
   */
  accountName: string;

  /**
   * Optional root directory for saving the download on the server.
   * @type {string | undefined}
   */
  saveRoot?: string;
}

/**
 * Represents a standard error response from the API.
 */
export interface ApiError {
  /**
   * A descriptive error message.
   * @type {string}
   */
  message: string;
}

/**
 * Configuration for API key authentication.
 */
export interface ApiKeyConfig {
  /**
   * The API key for authentication.
   * @type {string}
   */
  apiKey: string;

  /**
   * If true, the API key is sent in the 'x-api-key' header.
   * If false or undefined, it's sent as a Bearer token in the 'Authorization' header.
   * @type {boolean | undefined}
   */
  useHeader?: boolean;
}

/**
 * Configuration for initializing the SDK.
 */
export interface SdkConfig {
  /**
   * The base URL of the WallWhale Download API.
   * @type {string}
   */
  baseUrl: string;

  /**
   * The authentication configuration.
   * @type {ApiKeyConfig}
   */
  auth: ApiKeyConfig;
}
/**
 * The main SDK class for the WallWhale Download API.
 */
export class DownloadApiSdk {
  protected baseUrl: string;
  protected auth: ApiKeyConfig;

  /**
   * Creates an instance of the DownloadApiSdk.
   * @param {SdkConfig} config - The SDK configuration.
   */
  constructor(config: SdkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.auth = config.auth;
  }

  /**
   * Constructs the appropriate authentication headers for API requests.
   * @protected
   * @returns {HeadersInit} The headers object.
   */
  protected getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.auth.useHeader) {
      headers["x-api-key"] = this.auth.apiKey;
    } else {
      headers["authorization"] = `Bearer ${this.auth.apiKey}`;
    }

    return headers;
  }

  /**
   * A generic response handler that processes HTTP responses, handles errors,
   * and parses JSON.
   * @private
   * @template T - The expected response type.
   * @param {Response} response - The fetch Response object.
   * @returns {Promise<T>} A promise that resolves with the parsed JSON response.
   * @throws {Error} Throws an error for non-successful responses.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = (await response.json()) as ApiError;
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If we can't parse JSON, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Creates a new download job on the server.
   * @param {CreateJobRequest} request - The details of the job to create.
   * @returns {Promise<Job>} A promise that resolves with the created job object.
   */
  async createJob(request: CreateJobRequest): Promise<Job> {
    const response = await fetch(`${this.baseUrl}/api/v1/downloads`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    return this.handleResponse<Job>(response);
  }

  /**
   * Retrieves the current status of a specific job.
   * @param {string} jobId - The ID of the job to check.
   * @returns {Promise<Job>} A promise that resolves with the job's current state.
   */
  async getJobStatus(jobId: string): Promise<Job> {
    const response = await fetch(`${this.baseUrl}/api/v1/downloads/${jobId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse<Job>(response);
  }

  /**
   * Cancels a running download job.
   * @param {string} jobId - The ID of the job to cancel.
   * @returns {Promise<void>} A promise that resolves when the job is successfully cancelled.
   */
  async cancelJob(jobId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/downloads/${jobId}/cancel`,
      {
        method: "POST",
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<void>(response);
  }

  /**
   * Downloads the completed job's zip file as a Blob.
   * This is useful for in-memory processing or saving with custom logic.
   * @param {string} jobId - The ID of the completed job.
   * @returns {Promise<Blob>} A promise that resolves with the zip file as a Blob.
   */
  async downloadJobZip(jobId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/downloads/${jobId}/zip`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = (await response.json()) as ApiError;
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    console.log("Download job zip response:", response);
    return response.blob();
  }

  /**
   * Constructs the direct download URL for a job's zip file.
   * Note: This may not work with all authentication methods (e.g., header-based).
   * @param {string} jobId - The ID of the job.
   * @returns {string} The direct download URL.
   */
  getJobZipUrl(jobId: string): string {
    const url = new URL(`${this.baseUrl}/api/v1/downloads/${jobId}/zip`);

    if (this.auth.useHeader) {
      console.warn(
        "Direct download URLs may not be compatible with header-based authentication."
      );
    }

    return url.toString();
  }

  /**
   * Streams job logs using Server-Sent Events (SSE).
   * Provides real-time updates on the job's progress.
   * @param {string} jobId - The ID of the job to stream logs for.
   * @param {object} [options={}] - Options for handling log events.
   * @param {(logLine: string) => void} [options.onLog] - Callback for each log line received.
   * @param {() => void} [options.onEnd] - Callback when the log stream ends.
   * @param {(error: Error) => void} [options.onError] - Callback for any streaming errors.
   * @returns {Promise<string[]>} A promise that resolves with an array of all log lines once the stream is complete.
   */
  async streamJobLogs(
    jobId: string,
    options: {
      onLog?: (logLine: string) => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const logs: string[] = [];

      const url = new URL(`${this.baseUrl}/api/v1/downloads/${jobId}/logs`);

      // EventSource doesn't support custom headers, so we must use fetch for header-based auth.
      if (this.auth.useHeader) {
        console.warn(
          "Using fetch for log streaming due to header-based authentication."
        );
        this.streamWithFetch(jobId, options, logs, resolve, reject);
        return;
      }

      // If server supported, token could be passed as a query param.
      // url.searchParams.set('token', this.auth.apiKey);

      const eventSource = new EventSource(url.toString());

      eventSource.onmessage = (event) => {
        const logLine = event.data;
        logs.push(logLine);

        if (options.onLog) {
          options.onLog(logLine);
        }
      };

      eventSource.addEventListener("end", () => {
        eventSource.close();
        if (options.onEnd) {
          options.onEnd();
        }
        resolve(logs);
      });

      eventSource.onerror = () => {
        eventSource.close();
        const error = new Error("Failed to stream logs via EventSource");
        if (options.onError) {
          options.onError(error);
        }
        reject(error);
      };
    });
  }

  /**
   * An alternative log streaming implementation using the Fetch API.
   * This is required for authentication methods that need custom headers.
   * @private
   * @param {string} jobId - The job ID.
   * @param {object} options - Streaming options.
   * @param {string[]} logs - Array to accumulate logs.
   * @param {(logs: string[]) => void} resolve - Promise resolve function.
   * @param {(error: Error) => void} reject - Promise reject function.
   */
  private async streamWithFetch(
    jobId: string,
    options: {
      onLog?: (logLine: string) => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    },
    logs: string[],
    resolve: (logs: string[]) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/downloads/${jobId}/logs`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body reader is not available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep any incomplete line

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const logLine = line.substring(6); // Remove 'data: ' prefix
            logs.push(logLine);

            if (options.onLog) {
              options.onLog(logLine);
            }
          } else if (line.startsWith("event: end")) {
            // The server signaled the end of the stream
            if (options.onEnd) {
              options.onEnd();
            }
            resolve(logs);
            return;
          }
        }
      }

      // If the loop finishes without an 'end' event, resolve with what we have
      resolve(logs);
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Unknown streaming error");
      if (options.onError) {
        options.onError(err);
      }
      reject(err);
    }
  }

  /**
   * Polls the job status endpoint until the job reaches a terminal state
   * (completed, failed, or cancelled), or until it times out.
   * @param {string} jobId - The ID of the job to monitor.
   * @param {object} [options={}] - Polling configuration.
   * @param {number} [options.pollInterval=2000] - Interval in ms between status checks.
   * @param {number} [options.timeout=300000] - Total time in ms before polling gives up.
   * @param {(job: Job) => void} [options.onStatusUpdate] - Callback for each status update received.
   * @returns {Promise<Job>} A promise that resolves with the final job object.
   * @throws {Error} Throws an error if the polling times out.
   */
  async waitForJobCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onStatusUpdate?: (job: Job) => void;
    } = {}
  ): Promise<Job> {
    const {
      pollInterval = 2000,
      timeout = 300000, // 5 minutes
      onStatusUpdate,
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.getJobStatus(jobId);

      if (onStatusUpdate) {
        onStatusUpdate(job);
      }

      if (["completed", "failed", "cancelled"].includes(job.status)) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Job polling timed out");
  }
}

/**
 * Provides high-level utility functions, particularly useful in a browser extension context.
 */
export class ExtensionDownloadUtils {
  private sdk: DownloadApiSdk;

  /**
   * Creates an instance of ExtensionDownloadUtils.
   * @param {DownloadApiSdk} sdk - An initialized SDK instance.
   */
  constructor(sdk: DownloadApiSdk) {
    this.sdk = sdk;
  }

  /**
   * Downloads a job's zip file and triggers a save dialog in the browser.
   * Uses `chrome.downloads` API if available, otherwise falls back to a standard link click.
   * @param {string} jobId - The ID of the completed job to download.
   * @param {string} [filename] - The suggested filename for the download.
   * @returns {Promise<void>} A promise that resolves when the download is initiated.
   */
  async downloadAndSave(jobId: string, filename?: string): Promise<void> {
    try {
      const blob = await this.sdk.downloadJobZip(jobId);
      const url = URL.createObjectURL(blob);

      // Use chrome.downloads API for a better experience in extensions
      if (typeof chrome !== "undefined" && chrome.downloads) {
        await new Promise<void>((resolve, reject) => {
          chrome.downloads.download(
            {
              url,
              filename: filename || `download-${jobId}.zip`,
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (downloadId === undefined) {
                reject(new Error("Download failed to start."));
              } else {
                resolve();
              }
            }
          );
        });
      } else {
        // Fallback for standard web pages
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `download-${jobId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`Failed to download and save job ${jobId}: ${error}`);
    }
  }

  /**
   * A convenience method that chains job creation, waiting for completion, and downloading the result.
   * @param {CreateJobRequest} request - The job creation request.
   * @param {object} [options={}] - Options for polling and downloading.
   * @param {string} [options.filename] - The filename for the downloaded zip.
   * @param {number} [options.pollInterval] - Polling interval in ms.
   * @param {number} [options.timeout] - Polling timeout in ms.
   * @param {(job: Job) => void} [options.onStatusUpdate] - Callback for status updates.
   * @returns {Promise<Job>} A promise that resolves with the completed job object.
   * @throws {Error} Throws an error if the job fails or times out.
   */
  async createAndDownload(
    request: CreateJobRequest,
    options: {
      filename?: string;
      pollInterval?: number;
      timeout?: number;
      onStatusUpdate?: (job: Job) => void;
    } = {}
  ): Promise<Job> {
    const job = await this.sdk.createJob(request);

    const completedJob = await this.sdk.waitForJobCompletion(job.id, options);

    if (completedJob.status === "completed") {
      await this.downloadAndSave(job.id, options.filename);
    } else if (completedJob.status === "failed") {
      throw new Error(`Job failed: ${completedJob.error || "Unknown error"}`);
    }

    return completedJob;
  }
}

/**
 * Factory function to create and initialize the DownloadApiSdk.
 * @param {SdkConfig} config - The configuration object for the SDK.
 * @returns {DownloadApiSdk} A new instance of the SDK.
 */
export function createSdk(config: SdkConfig): DownloadApiSdk {
  return new DownloadApiSdk(config);
}

/**
 * Factory function to create the extension utility helper.
 * @param {DownloadApiSdk} sdk - An initialized instance of the DownloadApiSdk.
 * @returns {ExtensionDownloadUtils} A new instance of the extension utilities.
 */
export function createExtensionUtils(
  sdk: DownloadApiSdk
): ExtensionDownloadUtils {
  return new ExtensionDownloadUtils(sdk);
}
