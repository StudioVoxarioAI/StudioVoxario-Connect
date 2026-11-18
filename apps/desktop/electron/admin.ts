// Správa přístupů ke hrám z Connectu (jen správce / editor – ověřuje web: game_admin_access_*).
// Dokud web nemá nové funkce, Ashes of Eryon jde přes ashes_admin_access_* (jen správce).
import { rest } from "./auth";
import { isDemo } from "./demo";

export interface AccessRow { user_id: string; email: string | null; name: string | null; note: string | null; created_at: string }
const notFound = (e: unknown) => /HTTP 404/.test(String((e as Error)?.message ?? e));
const demo: Record<string, AccessRow[]> = {
  "ashes-of-eryon": [{ user_id: "u1", email: "tester@studiovoxario.com", name: "Tester", note: "uzavřený test", created_at: "2026-10-24T10:00:00Z" }],
  fantasy: [{ user_id: "u2", email: "hrac@studiovoxario.com", name: "Hráč", note: null, created_at: "2026-11-18T10:00:00Z" }],
};

async function call(fn: string, legacy: string, body: Record<string, unknown>, legacyBody: Record<string, unknown>, game: string): Promise<AccessRow[]> {
  try {
    return await rest<AccessRow[]>(`/rest/v1/rpc/${fn}`, { method: "POST", body: { p_game: game, ...body } });
  } catch (e) {
    if (notFound(e) && game === "ashes-of-eryon") return rest<AccessRow[]>(`/rest/v1/rpc/${legacy}`, { method: "POST", body: legacyBody });
    throw e;
  }
}

export async function accessList(game: string): Promise<AccessRow[]> {
  if (isDemo) return demo[game] ?? [];
  return call("game_admin_access_list", "ashes_admin_access_list", {}, {}, game);
}
export async function accessGrant(game: string, who: string, note: string): Promise<AccessRow[]> {
  if (isDemo) { (demo[game] ??= []).unshift({ user_id: `u${Date.now()}`, email: who, name: who, note: note || null, created_at: new Date().toISOString() }); return demo[game]!; }
  return call("game_admin_access_grant", "ashes_admin_access_grant", { p_who: who, p_note: note || null }, { p_who: who, p_note: note || null }, game);
}
export async function accessRevoke(game: string, user: string): Promise<AccessRow[]> {
  if (isDemo) { demo[game] = (demo[game] ?? []).filter((r) => r.user_id !== user); return demo[game]!; }
  return call("game_admin_access_revoke", "ashes_admin_access_revoke", { p_user: user }, { p_user: user }, game);
}
