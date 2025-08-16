import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { ExtensionSettings } from "@/types/settings"
import type { ApiKeyConfig, Job } from "@/sdk/sdk"
import { getLocalStorageSettings, setLocalStorageSettings, getLocalStorage } from "@/entrypoints/background/utils/localstorage"
import { setupApi } from "@/entrypoints/background/utils/konfiger"

export function TabsDemo() {
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [useHeader, setUseHeader] = useState(true)
  const [version, setVersion] = useState("1.2.2")
  const [history, setHistory] = useState<Job[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // load stored settings and history using shared helpers
    (async () => {
      const stored = await getLocalStorageSettings()
      if (stored) {
        setBaseUrl(stored.wallwhaleSettings?.baseUrl || "")
        setApiKey(stored.wallwhaleSettings?.auth?.apiKey || "")
        setUseHeader(stored.wallwhaleSettings?.auth?.useHeader ?? true)
      } else {
        // create defaults if none exist
        const defaults = await setupApi()
        setBaseUrl(defaults.wallwhaleSettings.baseUrl || "")
        setApiKey(defaults.wallwhaleSettings.auth?.apiKey || "")
        setUseHeader(defaults.wallwhaleSettings.auth?.useHeader ?? true)
        // persisted by setupApi
      }

      const local = await getLocalStorage()
      if (local?.version) setVersion(local.version)
      if (local?.hystory) setHistory(local.hystory)
    })()
  }, [])

  // Provide an interactive UI to open the extension options/settings page
  const [opening, setOpening] = useState(false)

  const openSettings = async () => {
    const runtimeGlobal: any =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : {};

    const runtime = runtimeGlobal.browser?.runtime || runtimeGlobal.chrome?.runtime
    if (!runtime?.openOptionsPage) {
      // If unavailable just close the popup
      try { runtimeGlobal.close?.() ?? runtimeGlobal.window?.close?.() } catch (_) { }
      return
    }

    try {
      setOpening(true)
      const p = runtime.openOptionsPage()
      if (p && typeof p.then === "function") {
        await p.catch((err: any) => console.error("Failed to open options page:", err))
      }
      // give browser a moment to open options then close the popup
      setTimeout(() => {
        try { runtimeGlobal.close?.() ?? runtimeGlobal.window?.close?.() } catch (_) { }
      }, 200)
    } catch (err) {
      console.error("openOptionsPage error:", err)
    } finally {
      setOpening(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    const apisett: ApiKeyConfig = {
      apiKey: apiKey,
      useHeader: useHeader,
    }

    // Merge with existing defaults to keep full shape
    const base = (await getLocalStorageSettings()) || (await setupApi())
    const settings: ExtensionSettings = {
      ...base,
      wallwhaleSettings: {
        ...base.wallwhaleSettings,
        baseUrl: baseUrl,
        auth: {
          ...(base.wallwhaleSettings.auth || {}),
          ...apisett,
        },
      },
    }

    await setLocalStorageSettings(settings)
    setSaving(false)
  }

  const refreshHistory = async () => {
    const local = await getLocalStorage()
    setHistory(local?.hystory || [])
  }

  return (
    <div className="w-full">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Open Settings</CardTitle>
          <CardDescription>Open the extension settings page to configure WallWhale.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">You can open the full settings page to edit base URL, API key, and other options.</div>
        </CardContent>
        <CardFooter>
          <Button onClick={openSettings} disabled={opening}>{opening ? "Opening…" : "Open Settings"}</Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">Download History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>WallWhale Settings</CardTitle>
              <CardDescription>Configure your WallWhale instance and API key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input id="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:3000" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="apiKey">API Key</Label>
                <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <input id="useHeader" type="checkbox" checked={useHeader} onChange={(e) => setUseHeader(e.target.checked)} />
                <Label htmlFor="useHeader">Send API key in x-api-key header (otherwise Bearer)</Label>
              </div>

              <div>
                <Label>Version</Label>
                <div className="text-sm text-muted-foreground">{version}</div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Download History</CardTitle>
              <CardDescription>Recent download jobs recorded by this extension.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-end">
                <Button variant="outline" onClick={refreshHistory}>Refresh</Button>
              </div>

              {history === null && <div className="text-sm text-muted-foreground">No history loaded. Click Refresh to load.</div>}

              {history && history.length === 0 && <div className="text-sm text-muted-foreground">No download history available.</div>}

              {history && history.length > 0 && (
                <div className="space-y-2">
                  {history.map((job) => (
                    <div key={job.id} className="p-2 border rounded-md">
                      <div className="flex justify-between">
                        <div className="font-medium">{job.accountName || job.id}</div>
                        <div className="text-sm">{job.status}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : "-"} • Finished: {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
