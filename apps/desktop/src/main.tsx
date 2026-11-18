import "@fontsource/orbitron/600.css";
import "@fontsource/oxanium/latin-ext-600.css";
import "@fontsource/oxanium/latin-ext-700.css";
import "@fontsource/oxanium/600.css";
import "@fontsource/oxanium/700.css";
import "@fontsource/rajdhani/latin-ext-600.css";
import "@fontsource/orbitron/800.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@connect/ui/src/tokens.css";
import "./index.css";
import "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { Setup } from "./pages/Setup";

// vlastní instalátor (electron/setup.ts) otevírá stejné UI s #/setup
const setup = window.location.hash.startsWith("#/setup");
createRoot(document.getElementById("root")!).render(<StrictMode>{setup ? <Setup /> : <App />}</StrictMode>);
