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
    const ui = await createShadowRootUi(ctx, {
      name: "trackjobs-wxt-container",
      position: "inline",
      anchor: "body",
      isolateEvents: ["keydown", "keyup", "keypress", "wheel"],
      onMount: (container) => {
        const app = document.createElement("main");
        app.id = "trackjobs-app-dialog";
        const style = document.createElement("style");
        //this is a bit of an hack and there must be a proper api (will find it later)
        const fontLink = `chrome-extension://${browser.runtime.id}/fonts/Geist.ttf`;
        style.textContent = `
					@font-face {
						font-family: "Geist";
						src: url('${fontLink}') format("truetype");
						font-weight: normal;
						font-style: normal;
						font-display: swap;
					}
					#trackjobs-app-dialog {
						font-family: 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
					}
				`;
        container.append(app);
				container.append(style);
        const root = ReactDOM.createRoot(app);
        root.render(<ContentRoot />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});