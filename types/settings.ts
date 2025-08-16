import { SdkConfig } from "@/sdk/sdk";

interface ExtensionSettings {
  wallwhaleSettings: SdkConfig;
  colorScheme: "light" | "dark" | "system";
  downloadSettings: {
    saveRoot: string;
    pollInterval: number;
    timeout: number;
    concurrency: number;
    retries: number;
    autoDownload: boolean;
  };
  notifications: {
    enabled: boolean;
    notifyOnComplete: boolean;
    notifyOnFail: boolean;
  };
  historyRetentionDays: number;
}

export type { ExtensionSettings };
