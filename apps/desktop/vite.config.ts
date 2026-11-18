import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Renderer (React) – načítá se z file:// v Electronu, proto relativní base a HashRouter
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5183, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
