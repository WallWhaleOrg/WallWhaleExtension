import { ExtensionSettings } from "./settings";

export interface LocalStorageSave {
  settings: ExtensionSettings;
  hystory?: any[]; // Optional history field, can be typed more specifically if needed
  version?: string; // Optional version field
}
