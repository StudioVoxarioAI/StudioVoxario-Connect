// Soukromé úložiště her (Supabase Storage `game-updates`): buildy Ashes of Eryon a Fantasy stahuje jen přihlášený
// uživatel s přístupem – Connect proto volá `/storage/v1/object/authenticated/…` s jeho tokenem (obnovuje se za běhu,
// takže vydrží i dlouhé stahování). Dokud je bucket ještě veřejný (před nasazením migrace webu), použije se záložně
// veřejná adresa; rozhodnutí se pamatuje na 10 minut, aby se u stovek souborů nezkoušelo dvakrát.
import { net } from "electron";
import { api } from "./api";
import { accessToken } from "./auth";

const PUBLIC = "/storage/v1/object/public/";
const AUTH = "/storage/v1/object/authenticated/";
let publicUntil = 0;   // do kdy rovnou veřejně (autorizovaný přístup odmítnut = bucket je ještě veřejný)

export const isStorageUrl = (url: string) => url.includes(PUBLIC);
const toAuth = (url: string) => url.replace(PUBLIC, AUTH);
const merge = (init: RequestInit | undefined, extra: Record<string, string>): RequestInit =>
  ({ ...(init ?? {}), headers: { ...((init?.headers as Record<string, string>) ?? {}), ...extra } });

export async function storageFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isStorageUrl(url)) return net.fetch(url, init);
  if (Date.now() >= publicUntil) {
    const token = await accessToken();
    if (token) {
      const res = await net.fetch(toAuth(url), merge(init, { apikey: api().publishableKey, authorization: `Bearer ${token}` }));
      if (res.ok || res.status === 206 || res.status === 416) return res;
      if (res.status !== 400 && res.status !== 403 && res.status !== 404) return res;   // 429/5xx: řeší opakování výše
      // bez přístupu nebo bucket ještě veřejný: zkusit veřejnou adresu (soukromý bucket ji odmítne → bez přístupu)
      const pub = await net.fetch(url, init);
      if (pub.ok || pub.status === 206) { publicUntil = Date.now() + 10 * 60_000; return pub; }
      return res.status === 400 ? new Response(null, { status: 403, statusText: "Bez přístupu" }) : res;
    }
  }
  return net.fetch(url, init);
}
