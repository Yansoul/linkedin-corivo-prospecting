import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDotenvFile } from "../src/env-loader.js";

describe("loadDotenvFile", () => {
  it("loads simple .env key-value pairs without overriding existing env", () => {
    const dir = mkdtempSync(join(tmpdir(), "linkedin-corivo-env-"));
    const envPath = join(dir, ".env");
    writeFileSync(
      envPath,
      [
        "OPENAI_API_KEY=file-key",
        'OPENAI_BASE_URL="https://api.example.com/v1"',
        "OPENAI_MODEL=gpt-5.4-mini",
        "OPENAI_FAST_MODE=true"
      ].join("\n")
    );

    const env: Record<string, string | undefined> = { OPENAI_API_KEY: "existing-key" };
    loadDotenvFile(envPath, env);

    expect(env.OPENAI_API_KEY).toBe("existing-key");
    expect(env.OPENAI_BASE_URL).toBe("https://api.example.com/v1");
    expect(env.OPENAI_MODEL).toBe("gpt-5.4-mini");
    expect(env.OPENAI_FAST_MODE).toBe("true");
    expect(readFileSync(envPath, "utf8")).toContain("file-key");
  });
});
