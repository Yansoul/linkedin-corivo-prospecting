import { existsSync, readFileSync } from "node:fs";

export type EnvMap = Record<string, string | undefined>;

export function loadDotenvFile(path = ".env", env: EnvMap = process.env): void {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (env[parsed.key] === undefined) {
      env[parsed.key] = parsed.value;
    }
  }
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}
