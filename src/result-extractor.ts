import type { ButtonState, PageLike, SearchResultCard } from "./types.js";
import { normalizeWhitespace, nullableText } from "./text.js";

const buttonStates: ButtonState[] = ["Connect", "Pending", "Connected", "Message", "Follow"];

export function buildPeopleSearchUrl(query: string, baseUrl = "https://www.linkedin.com"): string {
  const url = new URL("/search/results/people/", baseUrl);
  url.searchParams.set("keywords", query);
  url.searchParams.set("origin", "SWITCH_SEARCH_VERTICAL");
  return url.toString();
}

export async function extractSearchResultCards(page: PageLike, query: string): Promise<SearchResultCard[]> {
  const cards = await page.locator('a[href*="/in/"]').count();
  if (cards === 0) return [];

  return pageEvaluate(page, query);
}

export function extractSearchResultCardsFromDocument(document: Document, query: string): SearchResultCard[] {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')];
  const seen = new Set<string>();
  const cards: SearchResultCard[] = [];

  for (const link of links) {
    const profileUrl = normalizeProfileUrl(link.href, document.location?.origin ?? "https://www.linkedin.com");
    if (!profileUrl || seen.has(profileUrl)) continue;
    seen.add(profileUrl);

    const container = findCardContainer(link);
    const rawText = normalizeWhitespace(container?.textContent ?? link.textContent ?? "");
    const name = extractName(link);
    const lines = rawText.split(/\n| {2,}/).map(normalizeWhitespace).filter(Boolean);
    const headline = inferHeadline(container, name);
    const location = inferLocation(container, lines);
    const buttonState = inferButtonState(container);

    cards.push({
      name,
      profileUrl,
      headline,
      location,
      currentCompany: inferCompany(headline),
      connectionDegree: inferConnectionDegree(rawText),
      buttonState,
      rawText,
      query,
      rank: cards.length + 1
    });
  }

  return cards;
}

function findCardContainer(link: Element): Element | null {
  return (
    link.closest("li") ??
    link.closest('[data-view-name*="search"]') ??
    link.closest(".reusable-search__result-container") ??
    link.parentElement
  );
}

function extractName(link: HTMLAnchorElement): string {
  return normalizeWhitespace(link.textContent ?? "").replace(/\s+View.*$/i, "");
}

function inferHeadline(container: Element | null, name: string): string | null {
  const explicit = nullableText(
    container?.querySelector(".entity-result__primary-subtitle, [data-test-search-result-headline]")?.textContent
  );
  if (explicit) return explicit;

  const text = normalizeWhitespace(container?.textContent ?? "");
  const withoutName = normalizeWhitespace(text.replace(name, ""));
  const line = withoutName
    .split(/(?=Boca Raton|United States|Connect|Message|Pending|Connected|Follow)/i)[0]
    ?.replace(/^(2nd|3rd|1st)\b/i, "");
  return nullableText(line);
}

function inferLocation(container: Element | null, lines: string[]): string | null {
  const explicit = nullableText(container?.querySelector(".entity-result__secondary-subtitle")?.textContent);
  if (explicit) return explicit;
  return lines.find((line) => /United States|Greater|Area|Remote|China|Europe|Singapore|Canada|London|New York/i.test(line)) ?? null;
}

function inferCompany(headline: string | null): string | null {
  if (!headline) return null;
  const atMatch = headline.match(/\bat\s+([^|,]+)/i);
  return nullableText(atMatch?.[1]);
}

function inferConnectionDegree(rawText: string): string | null {
  return rawText.match(/\b(1st|2nd|3rd)\b/i)?.[1] ?? null;
}

function inferButtonState(container: Element | null): ButtonState {
  const texts = [...(container?.querySelectorAll("button, [role='button']") ?? [])]
    .map((element) => normalizeWhitespace(element.getAttribute("aria-label") ?? element.textContent ?? ""))
    .join(" ");

  for (const state of buttonStates) {
    if (new RegExp(`\\b${state}\\b`, "i").test(texts)) return state;
  }

  return "Unknown";
}

function normalizeProfileUrl(href: string, origin: string): string | null {
  const url = new URL(href, origin);
  const match = url.pathname.match(/^\/in\/[^/]+\/?/i);
  if (!match) return null;
  return `${url.origin}${match[0].replace(/\/?$/, "/")}`;
}

async function pageEvaluate(page: PageLike, query: string): Promise<SearchResultCard[]> {
  const playwrightPage = page as unknown as {
    evaluate<T>(expression: string): Promise<T>;
  };
  const cards = await playwrightPage.evaluate<
    Array<Omit<SearchResultCard, "buttonState"> & { buttonState: string }>
  >(String.raw`
    (() => {
      const normalizeWhitespace = (value) => (value ?? "").replace(/\\s+/g, " ").trim();
      const nullableText = (value) => {
        const normalized = normalizeWhitespace(value);
        return normalized.length > 0 ? normalized : null;
      };
      const normalizeProfileUrl = (href) => {
        const url = new URL(href, document.location.origin);
        const match = url.pathname.match(/^\/in\/[^/]+\/?/i);
        if (!match) return null;
        return url.origin + match[0].replace(/\/?$/, "/");
      };
      const findCardContainer = (link) =>
        link.closest("li") ??
        link.closest('[data-view-name*="search"]') ??
        link.closest(".reusable-search__result-container") ??
        link.parentElement;
      const inferButtonState = (container) => {
        const states = ["Connect", "Pending", "Connected", "Message", "Follow"];
        const texts = [...(container?.querySelectorAll("button, [role='button']") ?? [])]
          .map((element) => normalizeWhitespace(element.getAttribute("aria-label") ?? element.textContent ?? ""))
          .join(" ");
        for (const state of states) {
          if (texts.toLowerCase().includes(state.toLowerCase())) return state;
        }
        return "Unknown";
      };
      const links = [...document.querySelectorAll('a[href*="/in/"]')];
      const seen = new Set();
      const cards = [];
      for (const link of links) {
        const profileUrl = normalizeProfileUrl(link.href);
        if (!profileUrl || seen.has(profileUrl)) continue;
        seen.add(profileUrl);
        const container = findCardContainer(link);
        const rawText = normalizeWhitespace(container?.textContent ?? link.textContent ?? "");
        const name = normalizeWhitespace(link.textContent ?? "").replace(/\s+View.*$/i, "");
        const headline = nullableText(
          container?.querySelector(".entity-result__primary-subtitle, [data-test-search-result-headline]")?.textContent
        );
        const atMatch = headline?.match(/\bat\s+([^|,]+)/i);
        cards.push({
          name,
          profileUrl,
          headline,
          location: nullableText(container?.querySelector(".entity-result__secondary-subtitle")?.textContent),
          currentCompany: nullableText(atMatch?.[1]),
          connectionDegree: rawText.match(/\b(1st|2nd|3rd)\b/i)?.[1] ?? null,
          buttonState: inferButtonState(container),
          rawText,
          query: ${JSON.stringify(query)},
          rank: cards.length + 1
        });
      }
      return cards;
    })()
  `);
  return cards.map((card) => ({
    ...card,
    buttonState: toButtonState(card.buttonState)
  })) as SearchResultCard[];
}

function toButtonState(value: string): ButtonState {
  return buttonStates.includes(value as ButtonState) ? (value as ButtonState) : "Unknown";
}
