import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { extractSearchResultCardsFromDocument } from "../src/result-extractor.js";

describe("extractSearchResultCardsFromDocument", () => {
  it("extracts normalized LinkedIn people result cards", () => {
    const html = readFileSync(join(import.meta.dirname, "fixtures/search-results.html"), "utf8");
    const document = new JSDOM(html, { url: "https://www.linkedin.com/search/results/people/" }).window.document;

    const cards = extractSearchResultCardsFromDocument(document, "product marketing manager AI startup");

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: "Miranda Schumes, MBA",
      profileUrl: "https://www.linkedin.com/in/mirandaschumes/",
      headline: "Sr. Product Marketing Manager | Product Manager | AI & ML | B2B SaaS",
      location: "Boca Raton, Florida, United States",
      buttonState: "Connect",
      rank: 1
    });
    expect(cards[1].profileUrl).toBe("https://www.linkedin.com/in/example-engineer/");
    expect(cards[1].buttonState).toBe("Message");
  });
});
