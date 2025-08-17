import { Console } from "console";
import { init } from "./utils/init";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });
  // get from the local storage
  init();
  console.log("Background initialized");
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message?.type === "downloadBlob" &&
      message.blobUrl &&
      message.filename
    ) {
      (async () => {
        try {
          const opts = {
            url: message.blobUrl,
            filename: message.filename || "downloaded_file",
            saveAs: !!message.saveAs,
          } as any;

          // Preferred: WebExtensions-style browser.downloads.download (returns a Promise)
          if (
            typeof browser !== "undefined" &&
            browser.downloads &&
            typeof browser.downloads.download === "function"
          ) {
            try {
              const maybePromise = browser.downloads.download(opts);
              if (maybePromise && typeof maybePromise.then === "function") {
                const downloadId = await maybePromise;
                console.log("Download started with ID:", downloadId);
                sendResponse({ ok: true, downloadId });
              } else {
                // Some polyfills may return id synchronously
                console.log("Download started (sync) with ID:", maybePromise);
                sendResponse({ ok: true, downloadId: maybePromise });
              }
            } catch (err) {
              console.error("Download failed (browser.downloads):", err);
              sendResponse({ ok: false, error: String(err) });
            }

            return;
          }

          // Fallback: chrome.downloads.download (callback-style)
          if (
            typeof chrome !== "undefined" &&
            chrome.downloads &&
            typeof chrome.downloads.download === "function"
          ) {
            chrome.downloads.download(opts, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error("Download failed:", chrome.runtime.lastError);
                sendResponse({
                  ok: false,
                  error: chrome.runtime.lastError.message,
                });
              } else {
                console.log("Download started with ID:", downloadId);
                sendResponse({ ok: true, downloadId });
              }
            });
            return;
          }

          // If we reach here, no downloads API available in this environment
          console.error(
            "No downloads API available (browser.downloads or chrome.downloads)"
          );
          sendResponse({
            ok: false,
            error: "Downloads API not available in this environment",
          });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true; // keep channel open for async sendResponse
    }
  });
});
