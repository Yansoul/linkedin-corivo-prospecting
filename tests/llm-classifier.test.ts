import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import {
  buildResponsesCreateParams,
  createOpenAIClient,
  parseClassifierOutput,
  shouldPrepareFromDecision,
  technicalRiskRank
} from "../src/llm-classifier.js";

describe("LLM classifier helpers", () => {
  it("parses strict JSON classifier output", () => {
    const parsed = parseClassifierOutput(
      JSON.stringify({
        qualified: true,
        shouldPrepareConnection: true,
        roleCategory: "Product Marketing",
        companyCategory: "SaaS",
        technicalRisk: "low",
        icpFitScore: 0.91,
        confidence: 0.88,
        reason: "Product marketing SaaS profile with AI adoption context.",
        redFlags: []
      })
    );

    expect(parsed.roleCategory).toBe("Product Marketing");
    expect(parsed.confidence).toBe(0.88);
  });

  it("rejects malformed or non-enum model output", () => {
    expect(() =>
      parseClassifierOutput(
        JSON.stringify({
          qualified: true,
          shouldPrepareConnection: true,
          roleCategory: "Engineer",
          companyCategory: "SaaS",
          technicalRisk: "very-low",
          icpFitScore: 0.91,
          confidence: 0.88,
          reason: "Bad enum values.",
          redFlags: []
        })
      )
    ).toThrow();
  });

  it("applies confidence and technical risk thresholds", () => {
    const config = resolveConfig();
    const decision = parseClassifierOutput(
      JSON.stringify({
        qualified: true,
        shouldPrepareConnection: true,
        roleCategory: "Product Marketing",
        companyCategory: "SaaS",
        technicalRisk: "medium",
        icpFitScore: 0.91,
        confidence: 0.88,
        reason: "Qualified but riskier than configured threshold.",
        redFlags: []
      })
    );

    expect(technicalRiskRank("medium-low")).toBeLessThan(technicalRiskRank("medium"));
    expect(shouldPrepareFromDecision(decision, config.classifier)).toBe(false);
  });

  it("builds an OpenAI client with explicit API key and base URL", () => {
    const client = createOpenAIClient({
      ...resolveConfig().classifier,
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1"
    });

    expect(client.apiKey).toBe("test-key");
    expect(client.baseURL).toBe("https://api.example.com/v1");
  });

  it("adds minimal reasoning only in fast mode", () => {
    const baseConfig = resolveConfig().classifier;
    const fastParams = buildResponsesCreateParams(
      { ...baseConfig, fastMode: true },
      { query: "q", searchCard: {}, profile: {} }
    );
    const normalParams = buildResponsesCreateParams(
      { ...baseConfig, fastMode: false },
      { query: "q", searchCard: {}, profile: {} }
    );

    expect(fastParams.reasoning).toEqual({ effort: "minimal" });
    expect(normalParams.reasoning).toBeUndefined();
  });
});
