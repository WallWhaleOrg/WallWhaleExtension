"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { DownloadLogs, type LogEntry, createLogEntry } from "@/components/ui/download-logs"
import {
    CheckCircleIcon,
    DownloadIcon,
    RefreshCwIcon,
    ServerIcon,
    FileIcon,
    ZapIcon,
    AlertCircleIcon,
    InfoIcon,
    ShieldCheckIcon,
    DatabaseIcon,
    XCircleIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedBeam } from "../ui/shadcn-io/animated-beam"
import { Pill, PillStatus, PillDelta } from "../ui/shadcn-io/pill"
import type { DownloadApiSdk } from "@/sdk/sdk"
import { CreateJobRequest, createSdk } from "@/sdk/sdk" // Import SDK and types
import { getWallWhaleSettings } from "@/entrypoints/background/utils/localstorage"

type DownloadStatus = "idle" | "creating-job" | "streaming" | "downloading" | "completed" | "error"

// SDK will be created at runtime from local storage settings.
// We keep a ref so the SDK instance doesn't trigger re-renders.
// If no saved settings are found, a fallback empty SDK will be created and a warning logged.

// Build job request options helper
const buildJobreqoptions = (
    accountName: string,
    currentUrl: string,
    saveRoot?: string
): CreateJobRequest => {
    const returner: CreateJobRequest = {
        accountName: accountName,
        urlOrId: currentUrl,
    };
    if (saveRoot) {
        returner.saveRoot = saveRoot;
    }
    return returner;
};

const Circle = React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
    ({ className, children }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "z-10 flex size-12 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
                    className,
                )}
            >
                {children}
            </div>
        )
    },
)
Circle.displayName = "Circle"

const getLogIcon = (level: string) => {
    switch (level) {
        case "success":
            return <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
        case "warning":
            return <AlertCircleIcon className="h-3 w-3 text-amber-500" />
        case "error":
            return <XCircleIcon className="h-3 w-3 text-red-500" />
        default:
            return <InfoIcon className="h-3 w-3 text-blue-500" />
    }
}

const parseLogLevel = (log: string): "success" | "error" | "warning" | "info" => {
    const logLower = log.toLowerCase()
    if (logLower.includes("error") || logLower.includes("failed") || logLower.includes("archive not created")) {
        return "error"
    }
    if (logLower.includes("warning") || logLower.includes("warn")) {
        return "warning"
    }
    if (logLower.includes("success") || logLower.includes("completed") || logLower.includes("archive created")) {
        return "success"
    }
    return "info"
}

export function DownloadUI({ extensionName = "My Extension", className }: { extensionName?: string, className?: string }) {
    const [status, setStatus] = useState<DownloadStatus>("idle")
    const [progress, setProgress] = useState(0)
    const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null)
    const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)
    const [jobId, setJobId] = useState<string | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [error, setError] = useState<string | null>(null)
    const [downloadSpeed, setDownloadSpeed] = useState(0)
    const [lastDownloadTime, setLastDownloadTime] = useState<Date | null>(null)

    // Refs for animated beam
    const containerRef = useRef<HTMLDivElement>(null)
    const serverRef = useRef<HTMLDivElement>(null)
    const clientRef = useRef<HTMLDivElement>(null)
    // Mutable SDK instance for runtime use
    const runtimeSdkRef = useRef<DownloadApiSdk | null>(null)
    // Keep last added log to avoid repeating identical consecutive messages
    const lastLogRef = useRef<string | null>(null)

    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    const cfg = await getWallWhaleSettings()
                    if (mounted && cfg) {
                        runtimeSdkRef.current = createSdk(cfg)
                        console.log("SDK initialized from local storage", cfg)
                    } else if (mounted) {
                        // Fallback: create SDK with empty/default values to avoid runtime crashes
                        console.warn("No WallWhale settings found in local storage; using empty SDK config")
                        runtimeSdkRef.current = createSdk({ baseUrl: "", auth: { apiKey: "", useHeader: true } })
                    }
                } catch (e) {
                    console.error("Failed to initialize SDK from local storage", e)
                }
            })()
        return () => {
            mounted = false
        }
    }, [])

    // Get workshop item details from DOM
    const getWorkshopDetails = () => {
        const workshopitemname = document.querySelector(
            "#mainContents > div.workshopItemDetailsHeader > div.workshopItemTitle"
        )?.textContent;

        if (!workshopitemname) {
            throw new Error("Workshop item name not found");
        }

        const currentUrl = window.location.href;
        const workshopitemid = currentUrl.split("id=")[1]?.split("&")[0];

        if (!workshopitemid) {
            throw new Error("Workshop item ID not found in URL");
        }

        const filename = `[${workshopitemid}] ${workshopitemname}.zip`;

        return { workshopitemname, workshopitemid, filename };
    }

    const addLog = (message: string, level?: "success" | "error" | "warning" | "info") => {
        // Sanitize and normalize the incoming log message
        const sanitizeLog = (raw: string) => {
            if (!raw) return ""
            // Split into lines and remove noise lines (timestamps like 21:28:45 and lone 'DL' markers)
            const lines = raw
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.length > 0 && !/^\d{1,2}:\d{2}:\d{2}$/.test(l) && l !== "DL")

            // Replace Windows absolute paths with only the basename to hide local structure
            const hidePaths = (line: string) => {
                // Replace sequences like C:\folder\sub\file.ext or /home/user/... with just the filename
                // Windows paths
                line = line.replace(/[A-Za-z]:\\(?:[^\\\s]+\\)*([^\\\s]+)(?=(\s|$))/g, (m, filename) => filename)
                // Unix-like paths
                line = line.replace(/(?:\/~|\/)?(?:[\w\-. ]+\/)+(\S+\.[A-Za-z0-9]{1,6})(?=(\s|$))/g, (m, filename) => filename)
                // Generic long paths with backslashes or slashes
                line = line.replace(/(?:\\|\/)\S*(?:\\|\/)?([^\\\/\s]+)$/g, (m, filename) => filename)
                return line
            }

            const cleaned = lines.map(hidePaths)

            // Remove duplicate adjacent lines inside the same message
            const deduped: string[] = []
            for (const l of cleaned) {
                if (deduped.length === 0 || deduped[deduped.length - 1] !== l) deduped.push(l)
            }

            // Join with a compact separator and truncate long messages
            const joined = deduped.join(' — ')
            const truncated = joined.length > 300 ? joined.slice(0, 297) + '...' : joined

            // Replace literal 'undefined' when it appears as a value (e.g., "Download started: undefined")
            return truncated.replace(/:\s*undefined(?=$|\s)/i, ':')
        }

        const sanitized = sanitizeLog(message).trim()
        if (!sanitized) return

        // Avoid adding the same message twice in a row
        if (lastLogRef.current === sanitized) return

        const logLevel = level || parseLogLevel(sanitized)
        const entry = createLogEntry({ message: sanitized, level: logLevel, tag: "DL" })
        setLogs(prev => [...prev, entry])
        lastLogRef.current = sanitized
    }

    const updateProgress = (newProgress: number) => {
        setProgress(Math.min(newProgress, 100))
    }

    const startRealDownload = async () => {
        try {
            setStatus("creating-job")
            setProgress(0)
            setLogs([])
            setError(null)
            setDownloadSpeed(Math.floor(Math.random() * 50) + 10) // Random speed simulation

            addLog("Initializing download process...", "info")

            // Get workshop details
            const { workshopitemname, workshopitemid, filename } = getWorkshopDetails()
            addLog(`Found workshop item: ${workshopitemname} (ID: ${workshopitemid})`, "success")

            // Build job request with current URL
            const currentUrl = window.location.href
            const jobRequest = buildJobreqoptions("ruiiixx", currentUrl)
            addLog("Building job request...", "info")
            updateProgress(10)

            // Create job
            addLog("Creating job on server...", "info")
            if (!runtimeSdkRef.current) throw new Error("SDK not initialized")
            const job = await runtimeSdkRef.current.createJob(jobRequest)

            if (!job || !job.id) {
                throw new Error("Failed to create job")
            }

            setJobId(job.id)
            addLog(`Job created successfully: ${job.id}`, "success")
            updateProgress(20)

            setStatus("streaming")
            addLog("Starting log stream...", "info")

            const receivedLogs: string[] = []

            // Stream job logs
            await new Promise<void>((resolve, reject) => {
                if (!runtimeSdkRef.current) throw new Error("SDK not initialized")
                runtimeSdkRef.current.streamJobLogs(job.id, {
                    onLog: (log: string) => {
                        if (log.trim() === "") return

                        receivedLogs.push(log)
                        addLog(log, parseLogLevel(log))

                        // Update progress based on log content
                        const currentProgress = Math.min(20 + (receivedLogs.length * 2), 80)
                        updateProgress(currentProgress)
                    },
                    onError: (error: any) => {
                        addLog(`Stream error: ${error.message || error}`, "error")
                        reject(new Error(`Job stream error: ${error}`))
                    },
                    onEnd: () => {
                        addLog("Job stream completed", "success")
                        updateProgress(85)
                        resolve()
                    }
                })
            })

            // Check job status
            addLog("Checking job status...", "info")
            if (!runtimeSdkRef.current) throw new Error("SDK not initialized")
            const jobStatus = await runtimeSdkRef.current.getJobStatus(job.id)

            if (jobStatus.status !== "success") {
                throw new Error(`Job failed with status: ${jobStatus.status}`)
            }

            setStatus("downloading")
            addLog("Job completed successfully, downloading archive...", "success")
            updateProgress(90)

            // Process logs to find archive creation
            let archiveFound = false
            for (const log of receivedLogs) {
                if (log.trim() === "") continue

                if (log.includes("Archive created")) {
                    archiveFound = true
                    addLog("Archive created successfully, downloading...", "success")

                    // Download the zip file
                    if (!runtimeSdkRef.current) throw new Error("SDK not initialized")
                    const archive = await runtimeSdkRef.current.downloadJobZip(job.id)
                    const blobUrl = URL.createObjectURL(archive)

                    setDownloadBlob(archive)
                    setCurrentBlobUrl(blobUrl)

                    addLog(`Archive downloaded (${(archive.size / 1024 / 1024).toFixed(2)} MB)`, "success")

                    // Use Chrome extension API to download
                    if (typeof chrome !== 'undefined' && chrome.runtime) {
                        chrome.runtime.sendMessage(
                            {
                                type: "downloadBlob",
                                blobUrl: blobUrl,
                                filename: filename,
                            },
                            (resp) => {
                                if (!resp) {
                                    addLog("No response from background script", "error")
                                } else if (!resp.ok) {
                                    addLog(`Background download error: ${resp.error}`, "error")
                                } else {
                                    addLog(`Download started: ${resp.filename}`, "success")
                                }
                            }
                        )
                    } else {
                        // Fallback to direct download
                        const a = document.createElement("a")
                        a.href = blobUrl
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        addLog("Download started (direct)", "success")
                    }

                    break
                } else if (log.includes("Archive not created")) {
                    throw new Error("Archive creation failed")
                }
            }

            if (!archiveFound) {
                throw new Error("Archive creation log not found")
            }

            updateProgress(100)
            setStatus("completed")
            setLastDownloadTime(new Date())
            addLog("Download completed successfully!", "success")

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
            setError(errorMessage)
            setStatus("error")
            addLog(`Download failed: ${errorMessage}`, "error")
            console.error("Download failed:", error)
        }
    }

    const handleDownloadFromBlob = () => {
        if (!downloadBlob || !currentBlobUrl) return

        const { filename } = getWorkshopDetails()
        const a = document.createElement("a")
        a.href = currentBlobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        addLog("File downloaded from cache", "success")
    }

    const resetDownload = () => {
        setStatus("idle")
        setProgress(0)
        setLogs([])
        setError(null)
        setJobId(null)
        setDownloadBlob(null)
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
            setCurrentBlobUrl(null)
        }
        // Clear dedupe state so future runs can log similar messages again
        lastLogRef.current = null
    }

    const getStatusBadge = () => {
        switch (status) {
            case "creating-job":
                return (
                    <Badge variant="secondary" className="animate-pulse">
                        Creating Job
                    </Badge>
                )
            case "streaming":
                return (
                    <Badge variant="secondary" className="animate-pulse">
                        Processing
                    </Badge>
                )
            case "downloading":
                return (
                    <Badge variant="secondary" className="animate-pulse">
                        Downloading
                    </Badge>
                )
            case "completed":
                return (
                    <Badge variant="default" className="bg-emerald-500">
                        Completed
                    </Badge>
                )
            case "error":
                return <Badge variant="destructive">Error</Badge>
            default:
                return <Badge variant="outline">Ready</Badge>
        }
    }

    const isProcessing = ["creating-job", "streaming", "downloading"].includes(status)

    return (
        <Card className={cn("w-full max-w-4xl", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileIcon className="h-5 w-5" />
                    Download {extensionName}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Status Pills */}
                <div className="flex flex-wrap gap-3">
                    <Pill>
                        <PillStatus>
                            {status === "completed" ? (
                                <CheckCircleIcon className="text-emerald-500" size={12} />
                            ) : status === "error" ? (
                                <XCircleIcon className="text-red-500" size={12} />
                            ) : (
                                <InfoIcon className="text-blue-500" size={12} />
                            )}
                            {status === "completed" ? "Completed" :
                                status === "error" ? "Failed" :
                                    isProcessing ? "Processing" : "Ready"}
                        </PillStatus>
                        Download Status
                    </Pill>

                    {downloadSpeed > 0 && isProcessing && (
                        <Pill>
                            <PillDelta delta={downloadSpeed} />
                            {downloadSpeed} MB/s
                        </Pill>
                    )}

                    {jobId && (
                        <Pill className="text-muted-foreground">
                            <ServerIcon size={12} />
                            Job: {jobId.slice(0, 8)}...
                        </Pill>
                    )}

                    {lastDownloadTime && (
                        <Pill className="text-muted-foreground">
                            <ZapIcon size={12} />
                            Last: {lastDownloadTime.toLocaleTimeString()}
                        </Pill>
                    )}

                    {isProcessing && (
                        <>
                            <Pill>
                                <PillStatus>
                                    <ShieldCheckIcon className="text-blue-500" size={12} />
                                    Secure
                                </PillStatus>
                                Connection
                            </Pill>
                            {downloadBlob && (
                                <Pill>
                                    <PillStatus>
                                        <DatabaseIcon className="text-purple-500" size={12} />
                                        {(downloadBlob.size / 1024 / 1024).toFixed(1)}MB
                                    </PillStatus>
                                    Downloaded
                                </Pill>
                            )}
                        </>
                    )}
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">{getStatusBadge()}</div>

                {/* Animated Beam Visualization */}
                <div
                    className="relative flex w-full items-center justify-center overflow-hidden p-8 bg-muted/30 rounded-lg"
                    ref={containerRef}
                >
                    <div className="flex w-full max-w-md items-center justify-between">
                        <Circle ref={serverRef} className="bg-blue-50 border-blue-200">
                            <ServerIcon className="h-6 w-6 text-blue-600" />
                        </Circle>
                        <Circle ref={clientRef} className="bg-emerald-50 border-emerald-200">
                            <DownloadIcon className="h-6 w-6 text-emerald-600" />
                        </Circle>
                    </div>

                    {isProcessing && (
                        <AnimatedBeam
                            containerRef={containerRef}
                            fromRef={serverRef}
                            toRef={clientRef}
                            duration={2}
                            gradientStartColor="#3b82f6"
                            gradientStopColor="#10b981"
                        />
                    )}
                </div>

                {/* Progress Bar */}
                {isProcessing && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>
                                {status === "creating-job" ? "Creating job..." :
                                    status === "streaming" ? "Processing..." :
                                        "Downloading..."}
                            </span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <DownloadLogs
                        logs={logs}
                        maxHeight="max-h-72"
                        autoScroll={true}
                    />
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {status === "idle" || status === "error" ? (
                        <Button
                            onClick={startRealDownload}
                            className="flex-1"
                            disabled={isProcessing}
                        >
                            <ServerIcon className="mr-2 h-4 w-4" />
                            Start Download
                        </Button>
                    ) : status === "completed" ? (
                        <>
                            <Button
                                onClick={handleDownloadFromBlob}
                                variant="default"
                                className="flex-1"
                                disabled={!downloadBlob}
                            >
                                <DownloadIcon className="mr-2 h-4 w-4" />
                                Download from Blob (cache)
                            </Button>
                            <Button
                                onClick={resetDownload}
                                variant="outline"
                                className="flex-1 bg-transparent"
                            >
                                <RefreshCwIcon className="mr-2 h-4 w-4" />
                                Start New Download from server
                            </Button>
                        </>
                    ) : (
                        <Button disabled className="flex-1">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            {status === "creating-job" ? "Creating Job..." :
                                status === "streaming" ? "Processing..." :
                                    "Downloading..."}
                        </Button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm text-destructive font-medium">Download Failed</p>
                        <p className="text-sm text-destructive/80 mt-1">{error}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}