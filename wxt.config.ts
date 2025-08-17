import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    resolve: {
      alias: {
        "@": "./*",
      },
    },
    plugins: [tailwindcss()],
  }),

  manifest: {
    name: "WallWhale",
    description: "Track and manage your job applications with ease",
    version: "1.2.2",
    permissions: ["activeTab", "storage", "scripting", "cookies"],
    host_permissions: [
      "http://localhost:3000/*",
      "https://localhost:3000/*",
      "https://wallwhale.com/*",
    ],
    action: {
      default_popup: "popup/index.html",
    },
    // Add options page so runtime.openOptionsPage() can create and open it
    options_ui: {
      page: "settings/index.html",
      open_in_tab: true,
    },
  },
});
