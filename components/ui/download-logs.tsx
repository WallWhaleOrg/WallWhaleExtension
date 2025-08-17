"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, NetworkIcon, ClockIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LogEntry {
    id: string
    timestamp: string
    level: "info" | "success" | "warning" | "error"
    message: string
    tag: string
    details?: string
    category?: "system" | "security" | "network" | "validation" | "performance"
}

interface DownloadLogsProps {
    logs: LogEntry[]
    className?: string
    maxHeight?: string
    showHeader?: boolean
    autoScroll?: boolean
}

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

const getCategoryColor = (category?: string) => {
    switch (category) {
        case "security":
            return "bg-red-50 border-red-200 text-red-700"
        case "network":
            return "bg-blue-50 border-blue-200 text-blue-700"
        case "validation":
            return "bg-green-50 border-green-200 text-green-700"
        case "performance":
            return "bg-purple-50 border-purple-200 text-purple-700"
        case "system":
            return "bg-gray-50 border-gray-200 text-gray-700"
        default:
            return "bg-muted border-muted-foreground/20 text-muted-foreground"
    }
}

export function DownloadLogs({
    logs,
    className,
    maxHeight = "max-h-64",
    showHeader = true,
    autoScroll = true,
}: DownloadLogsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const lastLogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (autoScroll && scrollContainerRef.current) {
            // Scroll the container only to the bottom to avoid moving the whole page.
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: "smooth",
            })
        }
    }, [logs.length, autoScroll])

    if (logs.length === 0) {
        return null
    }

    return (
        <Card className={cn("bg-muted/20 border-muted", className)}>
            {showHeader && (
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <NetworkIcon className="h-4 w-4" />
                        Download Logs
                        <Badge variant="outline" className="ml-auto">
                            {logs.length} entries
                        </Badge>
                    </CardTitle>
                </CardHeader>
            )}
            <CardContent className={showHeader ? "pt-0" : ""}>
                <div
                    ref={scrollContainerRef}
                    className={cn(
                        "space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
                        maxHeight,
                    )}
                >
                    {logs.map((log, index) => (
                        <div
                            key={log.id}
                            ref={index === logs.length - 1 ? lastLogRef : undefined}
                            className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-muted/50 hover:bg-background/80 transition-all duration-200 animate-in slide-in-from-bottom-2"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getLogIcon(log.level)}

                                <div className="flex items-center gap-2">
                                    <Badge variant={getLogBadgeVariant(log.level)} className="text-xs font-mono">
                                        {log.tag}
                                    </Badge>
                                    {log.category && (
                                        <Badge variant="outline" className={cn("text-xs", getCategoryColor(log.category))}>
                                            {log.category.toUpperCase()}
                                        </Badge>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground leading-tight">{log.message}</p>
                                    {log.details && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{log.details}</p>}
                                </div>

                                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                    <ClockIcon className="h-3 w-3" />
                                    {log.timestamp}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export const generateEnhancedTemplateLogs = (progress: number): LogEntry[] => {
    const logs: LogEntry[] = []
    const baseTime = new Date()

    if (progress >= 5) {
        logs.push({
            id: "init",
            timestamp: new Date(baseTime.getTime() - 8000).toLocaleTimeString(),
            level: "info",
            message: "Initializing download process",
            tag: "INIT",
            category: "system",
            details: "Establishing secure connection to server and validating permissions",
        })
    }

    if (progress >= 12) {
        logs.push({
            id: "dns",
            timestamp: new Date(baseTime.getTime() - 7200).toLocaleTimeString(),
            level: "success",
            message: "DNS resolution completed",
            tag: "DNS",
            category: "network",
            details: "Resolved download.extension-store.com to 192.168.1.100",
        })
    }

    if (progress >= 18) {
        logs.push({
            id: "auth",
            timestamp: new Date(baseTime.getTime() - 6500).toLocaleTimeString(),
            level: "success",
            message: "Authentication verified",
            tag: "AUTH",
            category: "security",
            details: "JWT token validated, user permissions confirmed",
        })
    }

    if (progress >= 25) {
        logs.push({
            id: "manifest",
            timestamp: new Date(baseTime.getTime() - 5800).toLocaleTimeString(),
            level: "info",
            message: "Downloading manifest file",
            tag: "MANIFEST",
            category: "system",
            details: "Retrieving extension metadata (v2.1.4) and dependency tree",
        })
    }

    if (progress >= 32) {
        logs.push({
            id: "checksum",
            timestamp: new Date(baseTime.getTime() - 5200).toLocaleTimeString(),
            level: "success",
            message: "Checksum verification passed",
            tag: "CHECKSUM",
            category: "validation",
            details: "SHA-256: a1b2c3d4e5f6... matches expected hash",
        })
    }

    if (progress >= 40) {
        logs.push({
            id: "security",
            timestamp: new Date(baseTime.getTime() - 4600).toLocaleTimeString(),
            level: "success",
            message: "Security scan completed",
            tag: "SECURITY",
            category: "security",
            details: "Malware scan passed, no suspicious code patterns detected",
        })
    }

    if (progress >= 48) {
        logs.push({
            id: "bandwidth",
            timestamp: new Date(baseTime.getTime() - 4000).toLocaleTimeString(),
            level: "info",
            message: "Optimizing bandwidth usage",
            tag: "OPTIMIZE",
            category: "performance",
            details: "Adaptive bitrate enabled, compression ratio: 65%",
        })
    }

    if (progress >= 55) {
        logs.push({
            id: "assets",
            timestamp: new Date(baseTime.getTime() - 3400).toLocaleTimeString(),
            level: "info",
            message: "Downloading extension assets",
            tag: "ASSETS",
            category: "system",
            details: "Processing 47 files: icons, scripts, stylesheets, and resources",
        })
    }

    if (progress >= 65) {
        logs.push({
            id: "cache",
            timestamp: new Date(baseTime.getTime() - 2800).toLocaleTimeString(),
            level: "success",
            message: "Cache optimization applied",
            tag: "CACHE",
            category: "performance",
            details: "Local cache hit rate: 78%, reducing download size by 2.3MB",
        })
    }

    if (progress >= 75) {
        logs.push({
            id: "validation",
            timestamp: new Date(baseTime.getTime() - 2200).toLocaleTimeString(),
            level: "success",
            message: "Package validation successful",
            tag: "VALIDATE",
            category: "validation",
            details: "All 47 files integrity verified, digital signature confirmed",
        })
    }

    if (progress >= 85) {
        logs.push({
            id: "compression",
            timestamp: new Date(baseTime.getTime() - 1600).toLocaleTimeString(),
            level: "info",
            message: "Finalizing package compression",
            tag: "COMPRESS",
            category: "performance",
            details: "GZIP compression applied, final size: 8.7MB (was 12.4MB)",
        })
    }

    if (progress >= 95) {
        logs.push({
            id: "cleanup",
            timestamp: new Date(baseTime.getTime() - 800).toLocaleTimeString(),
            level: "info",
            message: "Cleaning up temporary files",
            tag: "CLEANUP",
            category: "system",
            details: "Removing 15 temporary files, freeing 45MB disk space",
        })
    }

    if (progress >= 100) {
        logs.push({
            id: "complete",
            timestamp: new Date().toLocaleTimeString(),
            level: "success",
            message: "Download completed successfully",
            tag: "COMPLETE",
            category: "system",
            details: "Extension package ready for installation, total time: 8.2s",
        })
    }

    return logs
}
