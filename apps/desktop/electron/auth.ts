// Přihlášení Connectu účtem webu StudioVoxario – stejný tok jako launcher Ashes of Eryon (web: launcher-auth,
// Voxar.app/game/launcher/spec/AUTH_HANDOFF.md), heslo Connect nikdy nevidí:
//  1. PKCE pár (verifier + challenge) a náhodný state; lokální server 127.0.0.1:<náhodný port>,
//  2. v systémovém prohlížeči <web>/game/auth/launcher?state&challenge&port&device&app=connect,
//  3. web po potvrzení přesměruje na http://127.0.0.1:<port>/callback?code&state,
//  4. launcher-auth "redeem" (kód + verifier) -> token_hash -> /auth/v1/verify -> vlastní relace,
//  5. obnovovací token šifrovaně (Electron safeStorage: Windows DPAPI, macOS Keychain, Linux libsecret);
//     bez bezpečného úložiště se relace neukládá (jen do zavření aplikace).
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, net, safeStorage, shell } from "electron";
import { api } from "./api";
import { demoUser, isDemo } from "./demo";

const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
export interface AccountUser { id: string; email: string; name: string; avatar: string; createdAt?: string }
export interface AuthStatus { signedIn: boolean; pending: boolean; user: AccountUser | null; error: string | null; secureStorage: boolean; offline: boolean }

let session: { access_token: string; refresh_token: string; expires_at: number } | null = null;
let user: AccountUser | null = null;
let pending: { url: string; finish: (e: Error | null) => void } | null = null;
let lastError: string | null = null;
let offline = false;
let loaded = false;

const file = () => path.join(app.getPath("userData"), "account.bin");
const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function status(): AuthStatus {
  if (isDemo) return { signedIn: true, pending: false, user: demoUser, error: null, secureStorage: true, offline: false };
  return { signedIn: !!user, pending: !!pending, user, error: lastError, secureStorage: safeStorage.isEncryptionAvailable(), offline };
}
function emit() {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:auth", status());
}

function persist() {
  if (!session?.refresh_token || !safeStorage.isEncryptionAvailable()) return;
  try {
    const payload = JSON.stringify({ refresh_token: session.refresh_token, user });
    fs.writeFileSync(file(), safeStorage.encryptString(payload), { mode: 0o600 });
  } catch { /* bez uložení zůstane přihlášení jen do zavření */ }
}
function readStored(): { refresh_token: string; user: AccountUser } | null {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file())) return null;
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
  } catch { return null; }
}
function forget() {
  session = null;
  user = null;
  offline = false;
  try { fs.rmSync(file(), { force: true }); } catch { /* nic */ }
}

async function call(url: string, body: unknown, token?: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const res = await net.fetch(url, {
    method: "POST",
    headers: { apikey: api().publishableKey, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  let data: Record<string, unknown> | null = null;
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* prázdné tělo */ }
  return { ok: res.ok, status: res.status, data };
}
const fn = (body: unknown, token?: string) => call(`${api().supabaseUrl}/functions/v1/launcher-auth`, body, token);

async function adoptSession(data: Record<string, unknown>) {
  if (!data?.access_token || !data?.refresh_token) throw new Error("Server nevrátil relaci.");
  session = {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token),
    expires_at: Number(data.expires_at) || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
  };
  const u = (data.user ?? {}) as { id?: string; email?: string; created_at?: string };
  const prev: AccountUser | null = user;
  user = { id: String(u.id), email: u.email ?? "", name: prev && prev.id === u.id ? prev.name : "", avatar: prev && prev.id === u.id ? prev.avatar : "", createdAt: u.created_at };
  offline = false;
  await loadProfile();
  persist();
}

async function loadProfile() {
  if (!user?.id || !session) return;
  try {
    const res = await net.fetch(
      `${api().supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=display_name,username,avatar_url&limit=1`,
      { headers: { apikey: api().publishableKey, authorization: `Bearer ${session.access_token}`, accept: "application/json" } },
    );
    const rows = res.ok ? ((await res.json()) as Array<{ display_name?: string; username?: string; avatar_url?: string }>) : [];
    const p = rows[0] ?? {};
    user.name = p.display_name || p.username || user.email.split("@")[0] || "Hráč";
    user.avatar = /^https:\/\//.test(p.avatar_url ?? "") ? p.avatar_url! : "";
  } catch {
    if (!user.name) user.name = user.email.split("@")[0] || "Hráč";
  }
}

async function refresh(refreshToken: string) {
  const r = await call(`${api().supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { refresh_token: refreshToken });
  if (!r.ok) {
    const err = new Error(String(r.data?.error_description ?? r.data?.msg ?? "Obnovení relace selhalo")) as Error & { invalid?: boolean };
    err.invalid = r.status === 400 || r.status === 401;
    throw err;
  }
  await adoptSession(r.data!);
}

/** Platný přístupový token (obnoví se 60 s před vypršením). Bez sítě vrátí null a ponechá uložené přihlášení. */
export async function accessToken(): Promise<string | null> {
  if (session && session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  const rt = session?.refresh_token ?? readStored()?.refresh_token;
  if (!rt) return null;
  try {
    await refresh(rt);
    return session!.access_token;
  } catch (e) {
    if ((e as { invalid?: boolean }).invalid) { forget(); lastError = "Přihlášení vypršelo – přihlaste se prosím znovu."; emit(); }
    else { offline = true; emit(); }
    return null;
  }
}

/** Při startu: obnoví uložené přihlášení (offline zůstane uživatel zobrazený z uložených údajů). */
export async function restore(): Promise<AuthStatus> {
  if (loaded) return status();
  loaded = true;
  const stored = readStored();
  if (stored?.refresh_token) {
    user = stored.user ?? null;
    try { await refresh(stored.refresh_token); } catch (e) {
      if ((e as { invalid?: boolean }).invalid) { forget(); lastError = "Přihlášení vypršelo – přihlaste se prosím znovu."; }
      else offline = true;
    }
  }
  emit();
  return status();
}

function page(title: string, text: string, ok: boolean) {
  const color = ok ? "#3fe0ff" : "#ff5d6c";
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#05070b;color:#eef;font-family:system-ui"><div style="text-align:center;max-width:460px"><div style="font-size:44px;color:${color}">${ok ? "✓" : "✕"}</div><h1 style="font-weight:700">${title}</h1><p style="color:#9ab">${text}</p></div></body>`;
}

function deviceName() {
  const host = String(os.hostname() || "").replace(/[^\w\- ]/g, "").slice(0, 40);
  const osName = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
  return host ? `Connect · ${osName} · ${host}` : `Connect · ${osName}`;
}

export function signIn(): AuthStatus {
  if (pending) { void shell.openExternal(pending.url); return status(); }
  lastError = null;
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(24));
  let finished = false;
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url || "/", "http://127.0.0.1");
    if (u.pathname !== "/callback" || u.searchParams.get("state") !== state || finished) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nenalezeno");
      return;
    }
    const code = u.searchParams.get("code");
    if (!code) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page("Přihlášení zamítnuto", "Connect přihlášený nebyl. Tohle okno můžete zavřít.", false));
      finish(new Error("denied"));
      return;
    }
    try {
      const r = await fn({ action: "redeem", code, verifier, device: deviceName() });
      if (!r.ok || !r.data?.token_hash) throw new Error(String(r.data?.error ?? "Kód se nepodařilo ověřit."));
      const v = await call(`${api().supabaseUrl}/auth/v1/verify`, { type: "magiclink", token_hash: r.data.token_hash });
      if (!v.ok) throw new Error(String(v.data?.msg ?? v.data?.error_description ?? "Server přihlášení odmítl."));
      await adoptSession(v.data!);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page("StudioVoxario Connect je přihlášený", "Vraťte se do aplikace – tohle okno můžete zavřít.", true));
      finish(null);
    } catch (e) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page("Přihlášení se nepovedlo", "Zkuste to v Connectu znovu.", false));
      finish(e as Error);
    }
  });
  const timer = setTimeout(() => finish(new Error("timeout")), SIGN_IN_TIMEOUT_MS);
  function finish(error: Error | null) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    setTimeout(() => server.close(), 1500);
    pending = null;
    if (error) {
      const m = error.message;
      lastError = m === "cancelled" ? null : m === "denied" ? "Přihlášení bylo v prohlížeči zamítnuto."
        : m === "timeout" ? "Přihlášení vypršelo – zkuste to znovu." : m;
    }
    emit();
  }
  server.on("error", (e) => finish(e));
  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const url = `${api().web}/game/auth/launcher?state=${state}&challenge=${challenge}&port=${port}&app=connect&device=${encodeURIComponent(deviceName())}`;
    pending = { url, finish };
    void shell.openExternal(url);
    emit();
  });
  return { ...status(), pending: true };
}

export function cancelSignIn(): AuthStatus {
  pending?.finish(new Error("cancelled"));
  return status();
}

export async function signOut(): Promise<AuthStatus> {
  const token = session?.access_token;
  forget();
  lastError = null;
  emit();
  if (token) { try { await call(`${api().supabaseUrl}/auth/v1/logout?scope=local`, {}, token); } catch { /* offline */ } }
  return status();
}

/** Jednorázový lístek pro hru (Ashes of Eryon / Fantasy si z něj udělají vlastní relaci – Fáze 3). */
export async function gameTicket(): Promise<string | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    const r = await fn({ action: "ticket", device: deviceName() }, token);
    return r.ok ? String(r.data?.token_hash ?? "") || null : null;
  } catch { return null; }
}

/** Volání REST / RPC webu jménem přihlášeného uživatele. */
export async function rest<T>(pathAndQuery: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("not_signed_in");
  const res = await net.fetch(`${api().supabaseUrl}${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers: { apikey: api().publishableKey, authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Edge funkce webu jménem uživatele (nebo anonymně). */
export async function edge<T>(name: string, body: unknown, signedIn = true): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = signedIn ? await accessToken() : null;
  const r = await call(`${api().supabaseUrl}/functions/v1/${name}`, body, token ?? undefined);
  return { ok: r.ok, status: r.status, data: r.data as T | null };
}
