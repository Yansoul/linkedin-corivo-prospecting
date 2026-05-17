import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { extractProfileContextFromDocument } from "../src/profile-extractor.js";

describe("extractProfileContextFromDocument", () => {
  it("extracts profile context needed by the classifier", () => {
    const html = readFileSync(join(import.meta.dirname, "fixtures/profile-product-marketing.html"), "utf8");
    const document = new JSDOM(html, { url: "https://www.linkedin.com/in/mirandaschumes/" }).window.document;

    const profile = extractProfileContextFromDocument(document, "https://www.linkedin.com/in/mirandaschumes/");

    expect(profile).toMatchObject({
      name: "Miranda Schumes, MBA",
      headline: "Sr. Product Marketing Manager | AI & B2B SaaS",
      location: "Boca Raton, Florida, United States",
      visibleConnectState: "Connect"
    });
    expect(profile.about).toContain("product launches");
    expect(profile.experience[0]).toMatchObject({
      title: "Sr. Product Marketing Manager",
      company: "Claravine",
      dateRange: "2023 - Present"
    });
    expect(profile.skills).toContain("Go-to-Market Strategy");
  });
});
