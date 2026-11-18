// Vývoj: Vite (renderer s HMR) + Electron načítající dev server
import { spawn } from "node:child_process";
import { createServer } from "vite";

const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();
const url = `http://localhost:${server.config.server.port}/`;
await import("./build-electron.mjs");
const electron = (await import("electron")).default;
const child = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, CONNECT_DEV_URL: url } });
child.on("exit", async (code) => { await server.close(); process.exit(code ?? 0); });
