import { setupApi } from "./konfiger";

export function init() {
  browser.runtime.onInstalled.addListener(async () => {
    console.log("Extension installed!");
    // Set default data in local storage

    setupApi()
      .then(() => {
        console.log("API setup complete.");
        browser.runtime.openOptionsPage().catch((error) => {
          console.error("Failed to open options page:", error);
        });
      })
      .catch((error) => {
        console.error("Error during API setup:", error);
      });
  });
}
