import { ApiKeyConfig, SdkConfig, createSdk, DownloadApiSdk } from "@/sdk/sdk";
import { ExtensionSettings } from "@/types/settings";
import {
  setLocalStorageSettings,
  getVersion,
  getWallWhaleSettings,
} from "./localstorage";

function normalizeBaseUrl(raw: string | undefined): string {
  if (!raw) return "http://localhost:3000";
  // If the user provided only host:port, add http://
  if (!/^https?:\/\//i.test(raw)) {
    return `http://${raw}`;
  }
  return raw.replace(/\/$/, ""); // strip trailing slash
}

export async function setupApi(overrides?: Partial<ExtensionSettings>) {
  const defaultSettings: ExtensionSettings = {
    wallwhaleSettings: {
      baseUrl: normalizeBaseUrl("http://localhost:3000"),
      auth: {
        apiKey: "",
        useHeader: true,
      } as ApiKeyConfig,
    },
    downloadSettings: {
      saveRoot: "",
      pollInterval: 2000,
      timeout: 300000,
      concurrency: 2,
      retries: 2,
      autoDownload: false,
    },
    colorScheme: "system",
    notifications: {
      enabled: true,
      notifyOnComplete: true,
      notifyOnFail: true,
    },
    historyRetentionDays: 30,
  };

  // If there are already settings in storage (set via OptionsPage), don't overwrite them.
  const existing = await getWallWhaleSettings();
  if (existing) {
    // merge overrides into existing SdkConfig if provided
    const merged: ExtensionSettings = {
      ...defaultSettings,
      wallwhaleSettings: {
        ...defaultSettings.wallwhaleSettings,
        ...existing,
        ...((overrides && overrides.wallwhaleSettings) || {}),
      },
      ...(overrides || {}),
    };

    console.log("Using existing WallWhale settings from storage");
    return merged;
  }

  const settings: ExtensionSettings = {
    ...defaultSettings,
    ...(overrides || {}),
  };

  await setLocalStorageSettings(settings);

  const version = await getVersion();
  if (version) {
    console.log("Current version:", version);
  } else {
    console.warn("No version found in local storage.");
  }

  return settings;
}

/**
 * Reads SDK config from storage, normalizes values and returns an initialized DownloadApiSdk.
 * Returns null if no SDK configuration is available in storage.
 */
export async function createSdkFromStorage(): Promise<DownloadApiSdk | null> {
  const sdkCfg = await getWallWhaleSettings();
  if (!sdkCfg) return null;

  const baseUrl = normalizeBaseUrl(sdkCfg.baseUrl);
  const auth = sdkCfg.auth || { apiKey: "", useHeader: true };

  const cfg: SdkConfig = {
    baseUrl,
    auth,
  };

  try {
    const sdk = createSdk(cfg);
    return sdk;
  } catch (err) {
    console.error("Failed to create DownloadApiSdk:", err);
    return null;
  }
}
