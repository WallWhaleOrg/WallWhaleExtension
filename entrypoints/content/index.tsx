import App from "./App";
import ReactDOM from "react-dom/client";
import React from "react";
import "./globals.css";

export const PortalContext = React.createContext<HTMLElement | null>(null);

const ContentRoot = () => {
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null,
    );

    return (
        <React.StrictMode>
            <PortalContext.Provider value={portalContainer}>
                <div ref={setPortalContainer} id="trackjobs-wxt">
                    <App />
                </div>
            </PortalContext.Provider>
        </React.StrictMode>
    );
};

export default defineContentScript({
    matches: ["<all_urls>"],
    cssInjectionMode: "ui",

    async main(ctx) {
        let __themeStorageHandler: ((e: StorageEvent) => void) | null = null;

        const ui = await createShadowRootUi(ctx, {
            name: "trackjobs-wxt-container",
            position: "inline",
            anchor: "#profileBlock > div > div.game_area_purchase_margin",
            isolateEvents: ["keydown", "keyup", "keypress", "wheel"],
            onMount: (container) => {
                // Apply theme classes to the shadow UI container so CSS injected into the shadow
                // root can react to light/dark mode (the ThemeProvider writes theme to localStorage).
                const applyThemeToContainer = (value: string | null) => {
                    container.classList.remove("light", "dark");

                    if (!value || value === "system") {
                        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                            ? "dark"
                            : "light";
                        container.classList.add(systemTheme);
                        return;
                    }

                    if (value === "light" || value === "dark") {
                        container.classList.add(value);
                    }
                };

                // initial apply
                applyThemeToContainer(localStorage.getItem("vite-ui-theme"));

                // listen for changes to the storage key so ThemeProvider setTheme() updates the shadow UI
                __themeStorageHandler = (e: StorageEvent) => {
                    if (e.key === "vite-ui-theme") {
                        applyThemeToContainer(e.newValue);
                    }
                };

                window.addEventListener("storage", __themeStorageHandler);

                const app = document.createElement("main");
                app.id = "trackjobs-app-dialog";

                container.append(app);
                const root = ReactDOM.createRoot(app);
                root.render(<ContentRoot />);
                return root;
            },
            onRemove: (root) => {
                root?.unmount();
                if (__themeStorageHandler) {
                    window.removeEventListener("storage", __themeStorageHandler);
                    __themeStorageHandler = null;
                }
            },
        });

        ui.mount();
    },
});