import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { RuleFilter } from "../src/rule-filter.js";
import type { SearchResultCard } from "../src/types.js";

const baseCard: SearchResultCard = {
  name: "Miranda Schumes",
  profileUrl: "https://www.linkedin.com/in/mirandaschumes/",
  headline: "Sr. Product Marketing Manager | B2B SaaS | AI",
  location: "Boca Raton, Florida, United States",
  currentCompany: "Claravine",
  connectionDegree: "2nd",
  buttonState: "Connect",
  rawText: "Sr. Product Marketing Manager B2B SaaS AI",
  query: "product marketing manager AI startup",
  rank: 1
};

describe("RuleFilter", () => {
  it("marks obvious ICP roles as likely qualified", () => {
    const result = new RuleFilter(resolveConfig().filters).decide(baseCard);

    expect(result.decision).toBe("likely_qualified");
    expect(result.positiveMatches).toContain("product marketing");
  });

  it("skips unavailable action states before deeper review", () => {
    const result = new RuleFilter(resolveConfig().filters).decide({
      ...baseCard,
      buttonState: "Pending"
    });

    expect(result.decision).toBe("skip_unavailable_action");
  });

  it("skips obviously technical profiles even when AI is present", () => {
    const result = new RuleFilter(resolveConfig().filters).decide({
      ...baseCard,
      headline: "Machine Learning Engineer building AI infrastructure",
      rawText: "Machine Learning Engineer building AI infrastructure"
    });

    expect(result.decision).toBe("skip_obvious_technical");
    expect(result.negativeMatches).toContain("machine learning engineer");
  });

  it("sends ambiguous AI/SaaS startup cards to profile review", () => {
    const result = new RuleFilter(resolveConfig().filters).decide({
      ...baseCard,
      headline: "AI startup operator",
      rawText: "AI startup operator"
    });

    expect(result.decision).toBe("needs_profile_review");
  });
});
