import { SdkConfig } from "@/sdk/sdk";
import { LocalStorageSave } from "@/types/localstorage";
import { ExtensionSettings } from "@/types/settings";

// Use a safe global reference — prefer globalThis, fall back to self/window if needed.
const runtimeGlobal: any =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
    ? self
    : typeof window !== "undefined"
    ? window
    : {};

const storageApi =
  runtimeGlobal.browser?.storage?.local || runtimeGlobal.chrome?.storage?.local;

async function setLocalStorageSettings(
  settings: ExtensionSettings
): Promise<ExtensionSettings> {
  const localStorageSave: LocalStorageSave = {
    settings,
    version: "1.0.0",
  };

  if (!storageApi) {
    console.warn("No storage API available to save settings");
    return settings;
  }

  // browser.storage.local.set returns a Promise, chrome.storage.local.set uses a callback
  if (runtimeGlobal.browser?.storage) {
    await storageApi.set({ wallwhale: localStorageSave });
  } else {
    await new Promise<void>((resolve) =>
      storageApi.set({ wallwhale: localStorageSave }, () => resolve())
    );
  }

  console.log("Settings saved to local storage:", localStorageSave);
  return settings;
}

async function getLocalStorageSettings(): Promise<ExtensionSettings | null> {
  const result = await getLocalStorage();
  if (!result || !result.settings) {
    console.warn("No settings found in local storage.");
    return null;
  }
  return result.settings || null;
}

async function getLocalStorage(): Promise<LocalStorageSave | null> {
  if (!storageApi) {
    console.warn("No storage API available to read settings");
    return null;
  }

  if (runtimeGlobal.browser?.storage) {
    const result = await storageApi.get("wallwhale");
    return result.wallwhale || null;
  }

  return await new Promise<LocalStorageSave | null>((resolve) => {
    storageApi.get("wallwhale", (res: any) => {
      // chrome may expose runtime.lastError on failures
      if (runtimeGlobal.chrome?.runtime?.lastError) {
        console.error(
          "Error retrieving local storage:",
          runtimeGlobal.chrome.runtime.lastError
        );
        resolve(null);
        return;
      }
      resolve(res?.wallwhale || null);
    });
  });
}

async function getVersion(): Promise<string | null> {
  const result = await getLocalStorage();
  if (result && result.version) {
    return result.version;
  }
  return null;
}

async function getWallWhaleSettings(): Promise<SdkConfig | null> {
  const settings = await getLocalStorageSettings();
  if (!settings) {
    console.warn("No WallWhale settings found in local storage.");
    return null;
  }
  return settings.wallwhaleSettings || null;
}

export {
  setLocalStorageSettings,
  getWallWhaleSettings,
  getLocalStorageSettings,
  getLocalStorage,
  getVersion,
};
