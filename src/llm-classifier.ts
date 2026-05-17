import OpenAI from "openai";
import { z } from "zod";
import type { AppConfig, ClassifierDecision, ProfileContext, SearchResultCard, TechnicalRisk } from "./types.js";

const roleCategorySchema = z.enum([
  "Growth",
  "Product Marketing",
  "Product Operations",
  "Business Operations",
  "Strategy Operations",
  "Chief of Staff",
  "Founder Associate",
  "User Research",
  "Market Research",
  "Content Strategy",
  "GTM",
  "Sales Ops",
  "RevOps",
  "Partnerships",
  "Community",
  "Customer Success",
  "Customer Marketing",
  "Marketing Operations",
  "Creator Ops",
  "Operations",
  "Other"
]);

const classifierDecisionSchema = z.object({
  qualified: z.boolean(),
  shouldPrepareConnection: z.boolean(),
  roleCategory: roleCategorySchema,
  companyCategory: z.string(),
  technicalRisk: z.enum(["low", "medium-low", "medium", "high"]),
  icpFitScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  redFlags: z.array(z.string())
});

export const classifierPrompt = `You classify LinkedIn profiles for Corivo early user prospecting.

Corivo ICP:
Non-technical knowledge workers at tech, AI, SaaS, or startup companies who spend significant time across browser, docs, messaging, calendar, Notion/Lark/Slack, research, writing, operations, GTM, customer workflows, product/marketing workflows. They may be AI-heavy users, but should not be engineering/R&D people.

Prioritize:
Growth, Product Marketing, Product Ops, BizOps, Strategy Ops, Chief of Staff, Founder Associate, User Research, Market Research, Content Strategy, GTM, Sales Ops, RevOps, Partnerships, Community, Customer Success, Customer Marketing, Marketing Ops, Creator Ops, Operations.

Avoid:
Software engineering, developer, ML, AI research, data science, data engineering, research science, CTO, VP Engineering, Head of Engineering, technical founder, academic researcher, infra/devtools engineering.

Return strict JSON only.`;

export function parseClassifierOutput(output: string): ClassifierDecision {
  const parsed = JSON.parse(output) as unknown;
  return classifierDecisionSchema.parse(parsed);
}

export function technicalRiskRank(risk: TechnicalRisk): number {
  return {
    low: 0,
    "medium-low": 1,
    medium: 2,
    high: 3
  }[risk];
}

export function shouldPrepareFromDecision(
  decision: ClassifierDecision,
  classifierConfig: AppConfig["classifier"]
): boolean {
  return (
    decision.qualified === true &&
    decision.shouldPrepareConnection === true &&
    decision.confidence >= classifierConfig.minConfidenceToPrepare &&
    technicalRiskRank(decision.technicalRisk) <= technicalRiskRank(classifierConfig.maxTechnicalRiskToPrepare)
  );
}

export function buildClassifierPayload(query: string, searchCard: SearchResultCard, profile: ProfileContext) {
  return {
    query,
    searchCard: {
      name: searchCard.name,
      headline: searchCard.headline,
      currentCompany: searchCard.currentCompany,
      location: searchCard.location,
      buttonState: searchCard.buttonState
    },
    profile: {
      about: profile.about,
      experience: profile.experience,
      skills: profile.skills,
      certifications: profile.certifications,
      recentActivity: profile.recentActivity
    }
  };
}

export class LLMClassifier {
  private readonly client: OpenAI;

  constructor(private readonly config: AppConfig["classifier"]) {
    this.client = new OpenAI();
  }

  async classify(query: string, searchCard: SearchResultCard, profile: ProfileContext): Promise<ClassifierDecision> {
    if (this.config.provider === "none") {
      return fallbackDecision(searchCard, profile);
    }

    const payload = buildClassifierPayload(query, searchCard, profile);
    const response = await this.client.responses.create({
      model: this.config.model,
      input: [
        { role: "system", content: classifierPrompt },
        { role: "user", content: JSON.stringify(payload, null, 2) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "corivo_linkedin_icp_classification",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "qualified",
              "shouldPrepareConnection",
              "roleCategory",
              "companyCategory",
              "technicalRisk",
              "icpFitScore",
              "confidence",
              "reason",
              "redFlags"
            ],
            properties: {
              qualified: { type: "boolean" },
              shouldPrepareConnection: { type: "boolean" },
              roleCategory: {
                type: "string",
                enum: roleCategorySchema.options
              },
              companyCategory: { type: "string" },
              technicalRisk: { type: "string", enum: ["low", "medium-low", "medium", "high"] },
              icpFitScore: { type: "number", minimum: 0, maximum: 1 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" },
              redFlags: { type: "array", items: { type: "string" } }
            }
          },
          strict: true
        }
      },
      temperature: this.config.temperature
    });

    return parseClassifierOutput(response.output_text);
  }
}

function fallbackDecision(searchCard: SearchResultCard, profile: ProfileContext): ClassifierDecision {
  const text = [searchCard.headline, searchCard.rawText, profile.about, profile.rawVisibleText].filter(Boolean).join(" ");
  const technical = /\b(engineer|developer|machine learning|data scientist|research scientist|cto)\b/i.test(text);
  const qualified = !technical && /\b(product marketing|growth|gtm|operations|customer success|partnerships)\b/i.test(text);
  return {
    qualified,
    shouldPrepareConnection: qualified,
    roleCategory: qualified ? "Other" : "Other",
    companyCategory: /saas/i.test(text) ? "SaaS" : "Other",
    technicalRisk: technical ? "high" : "medium-low",
    icpFitScore: qualified ? 0.8 : 0.25,
    confidence: 0.55,
    reason: "Local fallback heuristic used because classifier.provider is none.",
    redFlags: technical ? ["technical profile keywords"] : []
  };
}
