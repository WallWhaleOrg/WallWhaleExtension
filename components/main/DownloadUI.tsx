"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { DownloadLogs, generateEnhancedTemplateLogs, type LogEntry } from "@/components/ui/download-logs"
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
    Pill,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedBeam } from "../ui/shadcn-io/animated-beam"
import { PillStatus, PillDelta } from "../ui/shadcn-io/pill"

type DownloadStatus = "idle" | "downloading" | "completed" | "error"

interface DownloadSectionProps {
    extensionName?: string
    onServerDownload?: () => Promise<Blob>
    className?: string
}

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
            return <AlertCircleIcon className="h-3 w-3 text-red-500" />
        default:
            return <InfoIcon className="h-3 w-3 text-blue-500" />
    }
}

const getLogBadgeVariant = (level: string) => {
    switch (level) {
        case "success":
            return "default"
        case "warning":
            return "secondary"
        case "error":
            return "destructive"
        default:
            return "outline"
    }
}

export function DownloadUI({ extensionName = "My Extension", onServerDownload, className }: DownloadSectionProps) {
    const [status, setStatus] = useState<DownloadStatus>("idle")
    const [progress, setProgress] = useState(0)
    const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null)
    const [downloadSpeed, setDownloadSpeed] = useState(0)
    const [lastDownloadTime, setLastDownloadTime] = useState<Date | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])

    // Refs for animated beam
    const containerRef = useRef<HTMLDivElement>(null)
    const serverRef = useRef<HTMLDivElement>(null)
    const clientRef = useRef<HTMLDivElement>(null)

    const simulateDownload = async () => {
        setStatus("downloading")
        setProgress(0)
        setLogs([])
        setDownloadSpeed(Math.floor(Math.random() * 50) + 10) // Random speed 10-60 MB/s

        const totalDuration = 8000 // 8 seconds total
        const updateInterval = 100 // Update every 100ms
        const totalSteps = totalDuration / updateInterval

        let currentStep = 0

        const progressInterval = setInterval(() => {
            currentStep++

            // Create a smooth curve that starts fast, slows in middle, speeds up at end
            const normalizedStep = currentStep / totalSteps
            let easedProgress

            if (normalizedStep < 0.3) {
                // Fast start (0-30%)
                easedProgress = normalizedStep * 100 * 1.2
            } else if (normalizedStep < 0.7) {
                // Slow middle (30-70%)
                const middleProgress = (normalizedStep - 0.3) / 0.4
                easedProgress = 36 + middleProgress * 34 * 0.6
            } else {
                // Fast finish (70-100%)
                const endProgress = (normalizedStep - 0.7) / 0.3
                easedProgress = 70 + endProgress * 30 * 1.3
            }

            const finalProgress = Math.min(Math.round(easedProgress), 100)
            setProgress(finalProgress)
            setLogs(generateEnhancedTemplateLogs(finalProgress))

            if (finalProgress >= 100 || currentStep >= totalSteps) {
                clearInterval(progressInterval)

                // Create a mock blob for demonstration
                const mockBlob = new Blob(["Mock extension data"], { type: "application/zip" })
                setDownloadBlob(mockBlob)
                setStatus("completed")
                setLastDownloadTime(new Date())
            }
        }, updateInterval)
    }

    const handleServerDownload = async () => {
        try {
            setStatus("downloading")
            setProgress(0)
            setLogs([])

            if (onServerDownload) {
                const progressPromise = new Promise<void>((resolve) => {
                    const totalDuration = 6000 // 6 seconds for server downloads
                    const updateInterval = 150
                    const totalSteps = totalDuration / updateInterval
                    let currentStep = 0

                    const progressInterval = setInterval(() => {
                        currentStep++
                        const progress = Math.min(Math.round((currentStep / totalSteps) * 95), 95) // Stop at 95%
                        setProgress(progress)
                        setLogs(generateEnhancedTemplateLogs(progress))

                        if (currentStep >= totalSteps) {
                            clearInterval(progressInterval)
                            resolve()
                        }
                    }, updateInterval)
                })

                const [blob] = await Promise.all([onServerDownload(), progressPromise])

                // Complete the final 5%
                setProgress(100)
                setLogs(generateEnhancedTemplateLogs(100))
                setDownloadBlob(blob)
            } else {
                // Use realistic simulation timing
                await simulateDownload()
                return
            }

            setStatus("completed")
            setLastDownloadTime(new Date())
        } catch (error) {
            setStatus("error")
            console.error("Download failed:", error)
        }
    }

    const handleDownloadFromBlob = () => {
        if (!downloadBlob) return

        const url = URL.createObjectURL(downloadBlob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${extensionName.toLowerCase().replace(/\s+/g, "-")}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const getStatusBadge = () => {
        switch (status) {
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
                            <CheckCircleIcon className="text-emerald-500" size={12} />
                            {status === "completed" ? "Completed" : "Ready"}
                        </PillStatus>
                        Download Status
                    </Pill>

                    {downloadSpeed > 0 && (
                        <Pill>
                            <PillDelta delta={downloadSpeed} />
                            {downloadSpeed} MB/s
                        </Pill>
                    )}

                    {lastDownloadTime && (
                        <Pill className="text-muted-foreground">
                            <ZapIcon size={12} />
                            Last: {lastDownloadTime.toLocaleTimeString()}
                        </Pill>
                    )}

                    {status === "downloading" && (
                        <>
                            <Pill>
                                <PillStatus>
                                    <ShieldCheckIcon className="text-blue-500" size={12} />
                                    Secure
                                </PillStatus>
                                Connection
                            </Pill>
                            <Pill>
                                <PillStatus>
                                    <DatabaseIcon className="text-purple-500" size={12} />
                                    {Math.round(progress * 2.5)}MB
                                </PillStatus>
                                Downloaded
                            </Pill>
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

                    {status === "downloading" && (
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
                {status === "downloading" && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Downloading...</span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}

                {progress >= 30 && logs.length > 0 && <DownloadLogs logs={logs} maxHeight="max-h-72" autoScroll={true} />}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {status === "idle" || status === "error" ? (
                        <Button onClick={handleServerDownload} className="flex-1" disabled={status === "downloading"}>
                            <ServerIcon className="mr-2 h-4 w-4" />
                            Start Download
                        </Button>
                    ) : status === "completed" ? (
                        <>
                            <Button onClick={handleDownloadFromBlob} variant="default" className="flex-1">
                                <DownloadIcon className="mr-2 h-4 w-4" />
                                Download Again
                            </Button>
                            <Button onClick={handleServerDownload} variant="outline" className="flex-1 bg-transparent">
                                <RefreshCwIcon className="mr-2 h-4 w-4" />
                                Re-trigger Server Download
                            </Button>
                        </>
                    ) : (
                        <Button disabled className="flex-1">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Downloading...
                        </Button>
                    )}
                </div>

                {/* Error Message */}
                {status === "error" && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm text-destructive">Download failed. Please try again or check your connection.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
