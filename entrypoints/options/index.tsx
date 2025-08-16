import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./globals.css";

// This is the entry point for the popup page
ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);