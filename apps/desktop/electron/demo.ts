// Ukázkový režim jen pro vývoj a náhledy obrazovek (CONNECT_DEMO=1): přihlášený ukázkový účet a knihovna
// bez přístupu k webu. V běžném spuštění se nikdy nepoužije.
export const isDemo = process.env.CONNECT_DEMO === "1";
export const demoUser = { id: "demo", email: "hrac@studiovoxario.com", name: "Sokolcz", avatar: "", createdAt: "2026-04-18T10:00:00Z" };
export const demoStates: Record<string, "owned" | "claimable" | "needs_key" | "no_access" | "needs_license"> = {
  "ashes-of-eryon": "owned", fantasy: "owned", "voxario-studio-engine": "needs_license", "voxar-app": "needs_key",
  "voxario-protect": "needs_key", "voxario-browser": "owned",
};
