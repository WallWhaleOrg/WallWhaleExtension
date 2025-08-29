
import ReactDOM from "react-dom/client";
import React from "react";
import "@/assets/tailwind.css"; // Adjust the path if necessary
import Appp from "./App";

export const PortalContext = React.createContext<HTMLElement | null>(null);

const ContentRoot = () => {
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null,
    );

    return (
        <React.StrictMode>
            <PortalContext.Provider value={portalContainer}>
                <div ref={setPortalContainer} id="trackjobs-wxt">
                    <Appp />
                </div>
            </PortalContext.Provider>
        </React.StrictMode>
    );
};

export default defineContentScript(
    {
        matches: ["https://www.wallpaperengine.space/*"],
        cssInjectionMode: "ui",

        async main(ctx) {
            let __themeStorageHandler: ((e: StorageEvent) => void) | null = null;

            const ui = await createShadowRootUi(ctx, {
                name: "trackjobs-wxt-container",
                position: "inline",
                anchor: "#yui_3_17_2_1_1755535091817_920",
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
                    console.log("Theme applied:", localStorage.getItem("vite-ui-theme"));
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
    },);