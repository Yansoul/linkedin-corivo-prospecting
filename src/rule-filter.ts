import type { AppConfig, RuleFilterResult, SearchResultCard } from "./types.js";
import { includesKeyword, unique } from "./text.js";

export class RuleFilter {
  constructor(private readonly config: AppConfig["filters"]) {}

  decide(card: SearchResultCard): RuleFilterResult {
    if (this.config.skipButtonStates.includes(card.buttonState)) {
      return {
        decision: "skip_unavailable_action",
        positiveMatches: [],
        negativeMatches: [],
        reason: `Button state ${card.buttonState} is not actionable.`
      };
    }

    const text = [card.name, card.headline, card.currentCompany, card.rawText].filter(Boolean).join(" ");
    const positiveMatches = keywordMatches(text, this.config.positiveKeywords);
    const negativeMatches = keywordMatches(text, this.config.negativeKeywords);

    if (negativeMatches.length > 0) {
      return {
        decision: "skip_obvious_technical",
        positiveMatches,
        negativeMatches,
        reason: `Matched technical/R&D keywords: ${negativeMatches.join(", ")}.`
      };
    }

    if (positiveMatches.length > 0) {
      return {
        decision: "likely_qualified",
        positiveMatches,
        negativeMatches,
        reason: `Matched ICP role keywords: ${positiveMatches.join(", ")}.`
      };
    }

    if (/\b(ai|saas|startup|operator|operations|gtm)\b/i.test(text)) {
      return {
        decision: "needs_profile_review",
        positiveMatches,
        negativeMatches,
        reason: "Ambiguous card has AI/SaaS/startup/operator context and needs profile review."
      };
    }

    return {
      decision: "skip_low_relevance",
      positiveMatches,
      negativeMatches,
      reason: "No ICP-positive keywords or relevant AI/SaaS/startup context found."
    };
  }
}

function keywordMatches(text: string, keywords: string[]): string[] {
  return unique(keywords.filter((keyword) => includesKeyword(text, keyword.toLowerCase())));
}
