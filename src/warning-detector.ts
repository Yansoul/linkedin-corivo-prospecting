import type { PageLike, WarningSignal } from "./types.js";
import { normalizeWhitespace } from "./text.js";

export const warningKeywords = [
  "captcha",
  "sign in to linkedin",
  "join now",
  "login",
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
  const urlHint = pageUrl?.toLowerCase() ?? "";
  const urlKeywords = loginRequiredUrl(urlHint) ? ["login_required_url"] : [];
  const matchedKeywords = [...warningKeywords.filter((keyword) => lower.includes(keyword)), ...urlKeywords];
  if (matchedKeywords.length === 0) return null;

  const warningType = loginRequiredSignal(matchedKeywords, urlHint)
    ? "login_required"
    : matchedKeywords.find((keyword) => ["captcha", "checkpoint", "rate limit", "restricted"].includes(keyword)) ??
      (urlHint.includes("checkpoint") ? "checkpoint" : matchedKeywords[0]);

  return {
    warningType,
    pageUrl,
    visibleText,
    matchedKeywords
  };
}

function loginRequiredUrl(urlHint: string): boolean {
  return (
    urlHint.includes("linkedin.com/login") ||
    urlHint.includes("linkedin.com/authwall") ||
    urlHint.includes("sessionredirect=")
  );
}

function loginRequiredSignal(matchedKeywords: string[], urlHint: string): boolean {
  return (
    loginRequiredUrl(urlHint) ||
    matchedKeywords.includes("sign in to linkedin") ||
    (matchedKeywords.includes("login") && matchedKeywords.includes("join now"))
  );
}

export async function detectWarningOnPage(page: PageLike): Promise<WarningSignal | null> {
  const playwrightPage = page as unknown as { textContent(selector: string): Promise<string | null> };
  const text = await playwrightPage.textContent("body");
  return detectWarningFromText(text ?? "", page.url());
}
