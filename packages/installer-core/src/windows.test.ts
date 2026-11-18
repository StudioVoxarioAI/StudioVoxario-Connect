import { describe, expect, it } from "vitest";
import { compareVersions, expandEnv, parseRegQuery, splitCommandLine } from "./windows";

describe("windows helpers", () => {
  it("parseRegQuery", () => {
    const out = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StudioVoxario.app
    DisplayName    REG_SZ    Voxar.app
    DisplayVersion    REG_SZ    0.0.58
    InstallLocation    REG_SZ    C:\\Users\\Jan Novák\\AppData\\Local\\Voxar.app
    UninstallString    REG_SZ    "C:\\Users\\Jan Novák\\AppData\\Local\\.StudioVoxario-uninstaller\\StudioVoxario Installer.exe" --uninstall --target=C%3A%5Cx
    EstimatedSize    REG_DWORD    0x4b0
    Empty    REG_SZ
`;
    const r = parseRegQuery(out);
    expect(r.DisplayVersion).toBe("0.0.58");
    expect(r.InstallLocation).toBe("C:\\Users\\Jan Novák\\AppData\\Local\\Voxar.app");
    expect(r.EstimatedSize).toBe("1200");
    expect(r.Empty).toBe("");
    expect(splitCommandLine(r.UninstallString!)).toEqual({ file: "C:\\Users\\Jan Novák\\AppData\\Local\\.StudioVoxario-uninstaller\\StudioVoxario Installer.exe", args: ["--uninstall", "--target=C%3A%5Cx"] });
  });
  it("expandEnv", () => {
    expect(expandEnv("%LOCALAPPDATA%\\Voxar.app", { LocalAppData: "C:\\L" })).toBe("C:\\L\\Voxar.app");
    expect(expandEnv("%NIC%\\x", {})).toBeNull();
  });
  it("compareVersions", () => {
    expect(compareVersions("1.10.0", "1.9.2")).toBe(1);
    expect(compareVersions("0.0.58", "0.0.58")).toBe(0);
    expect(compareVersions("v0.24.0", "0.24.1")).toBe(-1);
  });
});
