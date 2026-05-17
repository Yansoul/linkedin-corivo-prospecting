import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package scripts", () => {
  it("makes pnpm dev run the prospecting workflow without extra args", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
      packageManager?: string;
    };

    expect(pkg.scripts.dev).toBe("tsx src/cli.ts run");
    expect(pkg.scripts.scan).toBe("tsx src/cli.ts run --mode scan --classifier-provider none --no-allow-send-without-note");
    expect(pkg.scripts.chrome).toBe("bash scripts/open-chrome-cdp.sh");
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });

  it("launches Chrome CDP through macOS LaunchServices and verifies the endpoint", () => {
    const script = readFileSync("scripts/open-chrome-cdp.sh", "utf8");

    expect(script).toContain('open -na "Google Chrome" --args');
    expect(script).toContain(".local/share/corivo-linkedin-chrome");
    expect(script).toContain("/json/version");
    expect(script).toContain("https://www.linkedin.com/feed/");
  });
});
