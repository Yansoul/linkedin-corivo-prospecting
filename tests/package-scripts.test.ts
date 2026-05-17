import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package scripts", () => {
  it("makes pnpm dev run the prospecting workflow without extra args", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
      packageManager?: string;
    };

    expect(pkg.scripts.dev).toBe("tsx src/cli.ts run");
    expect(pkg.scripts.scan).toBe("tsx src/cli.ts run --mode scan --classifier-provider none");
    expect(pkg.scripts.chrome).toBe("bash scripts/open-chrome-cdp.sh");
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });
});
