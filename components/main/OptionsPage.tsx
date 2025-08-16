import React, { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import type { ExtensionSettings } from "@/types/settings"
import type { ApiKeyConfig } from "@/sdk/sdk"
import { setupApi } from "@/entrypoints/background/utils/konfiger"
import { getLocalStorageSettings, setLocalStorageSettings } from "@/entrypoints/background/utils/localstorage"

// safe global helper to avoid referencing `window` in non-window contexts
const runtimeGlobal: any =
    typeof globalThis !== "undefined"
        ? globalThis
        : typeof self !== "undefined"
            ? self
            : typeof window !== "undefined"
                ? window
                : {};

const storageApi = runtimeGlobal.browser?.storage?.local || runtimeGlobal.chrome?.storage?.local

function getWallwhale(): Promise<{ wallwhale?: any }> {
    if (!storageApi) return Promise.resolve({})
    if (runtimeGlobal.browser?.storage) {
        return storageApi.get("wallwhale")
    }
    return new Promise((resolve) => storageApi.get("wallwhale", (res: any) => resolve(res)))
}

function setWallwhale(payload: any): Promise<void> {
    if (!storageApi) return Promise.resolve()
    if (runtimeGlobal.browser?.storage) {
        return storageApi.set(payload)
    }
    return new Promise((resolve) => storageApi.set(payload, () => resolve()))
}

// Defaults are provided by `setupApi` in `konfiger.ts` to centralize defaults across the app.

export function OptionsPage() {
    const [settings, setSettings] = useState<ExtensionSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        setLoading(true);
        // Use centralized defaults from konfiger; if storage already has settings, use them.
        (async () => {
            const stored = await getLocalStorageSettings()
            if (stored) {
                setSettings(stored)
                setLoading(false)
                return
            }

            // No stored settings: create defaults via setupApi and persist them
            const defaults = await setupApi()
            setSettings(defaults)
            setLoading(false)
        })()
    }, [])

    const save = async () => {
        if (!settings) return
        setSaving(true)
        await setLocalStorageSettings(settings)
        setSaving(false)
    }

    const resetToDefaults = async () => {
        const defaults = await setupApi()
        setSettings(defaults)
        await setLocalStorageSettings(defaults)
    }

    const exportSettings = () => {
        const data = JSON.stringify(settings, null, 2)
        const blob = new Blob([data], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "wallwhale-settings.json"
        a.click()
        URL.revokeObjectURL(url)
    }

    const importSettings = (file: File | null) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
            try {
                const parsed = JSON.parse(String(reader.result))
                // merge into current defaults
                const base = (await getLocalStorageSettings()) || (await setupApi())
                const merged = { ...base, ...parsed }
                setSettings(merged)
                await setLocalStorageSettings(merged)
            } catch (err) {
                console.error("Failed to import settings:", err)
                alert("Invalid settings file")
            }
        }
        reader.readAsText(file)
    }

    const handleTestConnection = async () => {
        setTestResult("Testing…")
        try {
            const url = (settings?.wallwhaleSettings.baseUrl || "/")
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            if (settings?.wallwhaleSettings.auth?.apiKey) {
                if (settings.wallwhaleSettings.auth.useHeader) headers["x-api-key"] = settings.wallwhaleSettings.auth.apiKey
                else headers["authorization"] = `Bearer ${settings.wallwhaleSettings.auth.apiKey}`
            }

            const resp = await fetch(url + "/health", { method: "GET", headers })
            if (resp.ok) setTestResult(`Connected: ${resp.status} ${resp.statusText}`)
            else setTestResult(`Failed: ${resp.status} ${resp.statusText}`)
        } catch (err: any) {
            setTestResult(`Error: ${err?.message || String(err)}`)
        }
    }

    if (loading || !settings) return <div className="p-4">Loading settings…</div>

    return (
        <div className="w-full p-4">
            <div className="grid grid-cols-1 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Extension Settings</CardTitle>
                        <CardDescription>Configure WallWhale integration, downloads and behaviour.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="general">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="downloads">Downloads</TabsTrigger>
                                <TabsTrigger value="network">Network</TabsTrigger>
                                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                            </TabsList>

                            <TabsContent value="general">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="colorScheme">Theme</Label>
                                            <RadioGroup defaultValue={settings.colorScheme} onValueChange={(v) => setSettings({ ...settings, colorScheme: v as any })}>
                                                <div className="flex gap-3 items-center">
                                                    <label className="flex items-center gap-2"><RadioGroupItem value="light" /> Light</label>
                                                    <label className="flex items-center gap-2"><RadioGroupItem value="dark" /> Dark</label>
                                                    <label className="flex items-center gap-2"><RadioGroupItem value="system" /> System</label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="historyRetention">History retention (days)</Label>
                                            <Input id="historyRetention" type="number" value={String(settings.historyRetentionDays || 30)} onChange={(e) => setSettings({ ...settings, historyRetentionDays: Number(e.target.value) })} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label>Notifications</Label>
                                        <div className="flex items-center gap-2">
                                            <input id="notifyEnabled" type="checkbox" checked={settings.notifications?.enabled ?? true} onChange={(e) => setSettings({ ...settings, notifications: { ...(settings.notifications || {}), enabled: e.target.checked } })} />
                                            <Label htmlFor="notifyEnabled">Enable notifications</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input id="notifyComplete" type="checkbox" checked={settings.notifications?.notifyOnComplete ?? true} onChange={(e) => setSettings({ ...settings, notifications: { ...(settings.notifications || {}), notifyOnComplete: e.target.checked } })} />
                                            <Label htmlFor="notifyComplete">Notify on completion</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input id="notifyFail" type="checkbox" checked={settings.notifications?.notifyOnFail ?? true} onChange={(e) => setSettings({ ...settings, notifications: { ...(settings.notifications || {}), notifyOnFail: e.target.checked } })} />
                                            <Label htmlFor="notifyFail">Notify on failure</Label>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="downloads">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="saveRoot">Default save root</Label>
                                        <Input id="saveRoot" value={settings.downloadSettings.saveRoot || ""} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, saveRoot: e.target.value } })} placeholder="/downloads" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="autoDownload">Auto download completed jobs</Label>
                                            <div className="flex items-center gap-2">
                                                <input id="autoDownload" type="checkbox" checked={settings.downloadSettings.autoDownload ?? false} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, autoDownload: e.target.checked } })} />
                                                <Label htmlFor="autoDownload">Enable</Label>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="concurrency">Concurrency</Label>
                                            <Input id="concurrency" type="number" value={String(settings.downloadSettings.concurrency ?? 2)} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, concurrency: Number(e.target.value) } })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="retries">Retry attempts</Label>
                                            <Input id="retries" type="number" value={String(settings.downloadSettings.retries ?? 2)} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, retries: Number(e.target.value) } })} />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="pollInterval">Status poll interval (ms)</Label>
                                            <Input id="pollInterval" type="number" value={String(settings.downloadSettings.pollInterval ?? 2000)} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, pollInterval: Number(e.target.value) } })} />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="network">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="baseUrl">WallWhale Base URL</Label>
                                        <Input id="baseUrl" value={settings.wallwhaleSettings.baseUrl || ""} onChange={(e) => setSettings({ ...settings, wallwhaleSettings: { ...settings.wallwhaleSettings, baseUrl: e.target.value } })} placeholder="https://example.com" />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="apiKey">API Key</Label>
                                        <Input id="apiKey" value={settings.wallwhaleSettings.auth?.apiKey || ""} onChange={(e) => setSettings({ ...settings, wallwhaleSettings: { ...settings.wallwhaleSettings, auth: { ...(settings.wallwhaleSettings.auth || {}), apiKey: e.target.value } } })} />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input id="useHeader" type="checkbox" checked={settings.wallwhaleSettings.auth?.useHeader ?? true} onChange={(e) => setSettings({ ...settings, wallwhaleSettings: { ...settings.wallwhaleSettings, auth: { ...(settings.wallwhaleSettings.auth || {}), useHeader: e.target.checked } } })} />
                                        <Label htmlFor="useHeader">Send API key in x-api-key header (unchecked = Bearer)</Label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" onClick={handleTestConnection}>Test connection</Button>
                                        <div className="text-sm text-muted-foreground">{testResult}</div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="advanced">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label>Timeout (ms)</Label>
                                        <Input type="number" value={String(settings.downloadSettings.timeout ?? 300000)} onChange={(e) => setSettings({ ...settings, downloadSettings: { ...settings.downloadSettings, timeout: Number(e.target.value) } })} />
                                    </div>

                                    <div className="space-y-1">
                                        <Label>Developer</Label>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(settings)); alert("Settings copied to clipboard") }}>Copy JSON</Button>
                                            <Button variant="ghost" onClick={exportSettings}>Export</Button>
                                            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>Import</Button>
                                            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => importSettings(e.target.files?.[0] ?? null)} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label>Reset</Label>
                                        <div className="flex gap-2">
                                            <Button variant="destructive" onClick={resetToDefaults}>Reset to defaults</Button>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                    <CardFooter>
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="outline" onClick={() => { getWallwhale().then((r) => { setSettings(r?.wallwhale?.settings || settings) }) }}>Reload</Button>
                            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}

export default OptionsPage
