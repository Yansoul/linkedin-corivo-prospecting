import type { PageLike, WarningSignal } from "./types.js";
import { normalizeWhitespace } from "./text.js";

export const warningKeywords = [
  "captcha",
  "security check",
  "verify",
  "verification",
  "unusual activity",
  "suspicious",
  "restricted",
  "temporarily limited",
  "rate limit",
  "too many",
  "try again later",
  "account safety",
  "checkpoint"
];

export function detectWarningFromText(text: string, pageUrl: string | null = null): WarningSignal | null {
  const visibleText = normalizeWhitespace(text);
  const lower = visibleText.toLowerCase();
  const matchedKeywords = warningKeywords.filter((keyword) => lower.includes(keyword));
  if (matchedKeywords.length === 0) return null;

  const urlHint = pageUrl?.toLowerCase() ?? "";
  const warningType =
    matchedKeywords.find((keyword) => ["captcha", "checkpoint", "rate limit", "restricted"].includes(keyword)) ??
    (urlHint.includes("checkpoint") ? "checkpoint" : matchedKeywords[0]);

  return {
    warningType,
    pageUrl,
    visibleText,
    matchedKeywords
  };
}

export async function detectWarningOnPage(page: PageLike): Promise<WarningSignal | null> {
  const playwrightPage = page as unknown as { textContent(selector: string): Promise<string | null> };
  const text = await playwrightPage.textContent("body");
  return detectWarningFromText(text ?? "", page.url());
}
