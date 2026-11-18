// Malé lokální úložiště JSON (atomický zápis: dočasný soubor + přejmenování). Knihovna, instalace, nastavení.
// Načítá se líně při prvním použití – až po nastavení cesty userData (app.setPath) v main.ts.
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export class JsonStore<T extends object> {
  private data: T | null = null;
  constructor(private name: string, private defaults: T, private onLoad?: (d: T) => void) {}
  private file() { return path.join(app.getPath("userData"), `${this.name}.json`); }
  private load(): T {
    if (this.data) return this.data;
    let d: T = structuredClone(this.defaults);
    try {
      const raw = JSON.parse(fs.readFileSync(this.file(), "utf8"));
      if (raw && typeof raw === "object") d = { ...d, ...raw };
    } catch { /* první spuštění / poškozený soubor -> výchozí hodnoty */ }
    this.data = d;
    this.onLoad?.(d);
    return d;
  }
  get(): T { return this.load(); }
  update(fn: (d: T) => void): T {
    const d = this.load();
    fn(d);
    try {
      fs.mkdirSync(path.dirname(this.file()), { recursive: true });
      const tmp = this.file() + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
      fs.renameSync(tmp, this.file());
    } catch { /* zápis se zkusí příště */ }
    return d;
  }
}
