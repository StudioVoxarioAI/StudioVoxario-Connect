// Malé lokální úložiště JSON (atomický zápis: dočasný soubor + přejmenování). Knihovna, instalace, nastavení.
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export class JsonStore<T extends object> {
  private data: T;
  constructor(private name: string, defaults: T) {
    this.data = defaults;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file(), "utf8"));
      if (raw && typeof raw === "object") this.data = { ...defaults, ...raw };
    } catch { /* první spuštění / poškozený soubor -> výchozí hodnoty */ }
  }
  private file() { return path.join(app.getPath("userData"), `${this.name}.json`); }
  get(): T { return this.data; }
  update(fn: (d: T) => void): T {
    fn(this.data);
    try {
      fs.mkdirSync(path.dirname(this.file()), { recursive: true });
      const tmp = this.file() + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
      fs.renameSync(tmp, this.file());
    } catch { /* zápis se zkusí příště */ }
    return this.data;
  }
}
