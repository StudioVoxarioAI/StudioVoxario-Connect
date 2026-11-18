import type { ReactNode } from "react";

// Stav stahování v horní liště – napojí se ve Fázi 3 (fronta stahování)
export function DownloadIndicator({ fallback }: { fallback: ReactNode }) {
  return <>{fallback}</>;
}
