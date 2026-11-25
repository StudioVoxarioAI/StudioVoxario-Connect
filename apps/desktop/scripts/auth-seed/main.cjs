// Pomocník testu e2e-auth: zapíše šifrované uložené přihlášení (account.bin) stejně jako Connect (safeStorage).
const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
safeStorage.setUsePlainTextEncryption(true);
app.whenReady().then(() => {
  const payload = JSON.stringify({ refresh_token: process.env.SEED_RT, user: { id: "u1", email: "hrac@example.com", name: "Hráč", avatar: "" } });
  fs.writeFileSync(path.join(process.env.SEED_DIR, "account.bin"), safeStorage.encryptString(payload));
  app.exit(safeStorage.isEncryptionAvailable() ? 0 : 3);
});
