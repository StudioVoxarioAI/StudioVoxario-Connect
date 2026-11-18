// Adresy webu: z katalogu (web je může změnit bez nového vydání Connectu), jinak výchozí hodnoty.
// publishableKey je veřejný klíč webu (stejný je v JavaScriptu webu i ve stávajícím launcheru), ne tajemství.
import { currentCatalog } from "./catalog";

const DEFAULTS = {
  supabaseUrl: "https://rioexuvgvmdwvidfakxy.supabase.co",
  publishableKey: "sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-",
  web: "https://studiovoxario.com",
};

export function api(): typeof DEFAULTS {
  const a = currentCatalog()?.api ?? {};
  return {
    supabaseUrl: process.env.CONNECT_SUPABASE_URL ?? a.supabaseUrl ?? DEFAULTS.supabaseUrl,
    publishableKey: a.publishableKey ?? DEFAULTS.publishableKey,
    web: process.env.CONNECT_WEB_URL ?? a.web ?? DEFAULTS.web,
  };
}
