import type { PageLike, WarningSignal } from "./types.js";
import { normalizeWhitespace } from "./text.js";

export type WarningJudge = (candidate: WarningSignal) => Promise<WarningSignal | null>;

export const hardWarningKeywords = [
  "captcha",
  "sign in to linkedin",
  "join now",
  "login",
  "security check",
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

export const softWarningKeywords = ["verify", "verification"];
export const warningKeywords = [...hardWarningKeywords, ...softWarningKeywords];

export function detectWarningFromText(text: string, pageUrl: string | null = null): WarningSignal | null {
  const visibleText = normalizeWhitespace(text);
  const lower = visibleText.toLowerCase();
  const urlHint = pageUrl?.toLowerCase() ?? "";
  const urlKeywords = loginRequiredUrl(urlHint) ? ["login_required_url"] : [];
  const matchedKeywords = [...warningKeywords.filter((keyword) => lower.includes(keyword)), ...urlKeywords];
  const hardMatchedKeywords = [...hardWarningKeywords.filter((keyword) => lower.includes(keyword)), ...urlKeywords];
  if (hardMatchedKeywords.length === 0 && !checkpointUrl(urlHint)) return null;

  const warningType = loginRequiredSignal(matchedKeywords, urlHint)
    ? "login_required"
    : matchedKeywords.find((keyword) => ["captcha", "checkpoint", "rate limit", "restricted"].includes(keyword)) ??
      (checkpointUrl(urlHint) ? "checkpoint" : hardMatchedKeywords[0]);

  return {
    warningType,
    pageUrl,
    visibleText,
    matchedKeywords
  };
}

export function detectSoftWarningCandidateFromText(text: string, pageUrl: string | null = null): WarningSignal | null {
  const visibleText = normalizeWhitespace(text);
  const lower = visibleText.toLowerCase();
  const matchedKeywords = softWarningKeywords.filter((keyword) => lower.includes(keyword));
  if (matchedKeywords.length === 0) return null;

  return {
    warningType: matchedKeywords[0],
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

function checkpointUrl(urlHint: string): boolean {
  return urlHint.includes("linkedin.com/checkpoint");
}

function loginRequiredSignal(matchedKeywords: string[], urlHint: string): boolean {
  return (
    loginRequiredUrl(urlHint) ||
    matchedKeywords.includes("sign in to linkedin") ||
    (matchedKeywords.includes("login") && matchedKeywords.includes("join now"))
  );
}

export async function detectWarningOnPage(page: PageLike, judge?: WarningJudge): Promise<WarningSignal | null> {
  const playwrightPage = page as unknown as { textContent(selector: string): Promise<string | null> };
  const text = await playwrightPage.textContent("body");
  const warning = detectWarningFromText(text ?? "", page.url());
  if (warning) return warning;

  const softCandidate = detectSoftWarningCandidateFromText(text ?? "", page.url());
  if (!softCandidate || !judge) return null;

  return judge(softCandidate);
}
