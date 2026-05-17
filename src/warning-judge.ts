import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { z } from "zod";
import type { AppConfig, WarningSignal } from "./types.js";
import { createOpenAIClient } from "./llm-classifier.js";

const warningJudgeSchema = z.object({
  isBlockingWarning: z.boolean(),
  warningType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

export type WarningJudgeDecision = z.infer<typeof warningJudgeSchema>;
type WarningJudgeClient = {
  responses: {
    create(params: ResponseCreateParamsNonStreaming): PromiseLike<{ output_text: string }>;
  };
};

export const warningJudgePrompt = `You decide whether a LinkedIn page is blocking automation because it requires operator action.

Blocking pages include login, captcha, checkpoint, security check, account verification, unusual activity, rate limit, or restricted account flows.

Normal LinkedIn profile/search/feed text is not blocking, even if it mentions verified accounts, profile verification, certifications, subscriptions, notifications, or login in navigation/help copy.

Return strict JSON only.`;

export function parseWarningJudgeOutput(output: string): WarningJudgeDecision {
  return warningJudgeSchema.parse(JSON.parse(output) as unknown);
}

export function buildWarningJudgeParams(
  config: AppConfig["classifier"],
  candidate: WarningSignal
): ResponseCreateParamsNonStreaming {
  return {
    model: config.model,
    input: [
      { role: "system", content: warningJudgePrompt },
      {
        role: "user",
        content: JSON.stringify(
          {
            pageUrl: candidate.pageUrl,
            matchedKeywords: candidate.matchedKeywords,
            visibleText: candidate.visibleText.slice(0, 6000)
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "linkedin_blocking_warning_judgment",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["isBlockingWarning", "warningType", "confidence", "reason"],
          properties: {
            isBlockingWarning: { type: "boolean" },
            warningType: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" }
          }
        },
        strict: true
      }
    },
    temperature: 0,
    ...(config.fastMode ? { reasoning: { effort: "minimal" as const } } : {})
  };
}

export class WarningJudge {
  constructor(
    private readonly config: AppConfig["classifier"],
    private readonly client: WarningJudgeClient | null = null
  ) {}

  async judge(candidate: WarningSignal): Promise<WarningSignal | null> {
    if (this.config.provider === "none") return null;

    let decision: WarningJudgeDecision;
    try {
      const client = this.client ?? (createOpenAIClient(this.config) as WarningJudgeClient);
      const response = await client.responses.create(buildWarningJudgeParams(this.config, candidate));
      decision = parseWarningJudgeOutput(response.output_text);
    } catch (error) {
      console.error(`Soft warning model judge failed; treating candidate as non-blocking: ${formatError(error)}`);
      return null;
    }

    if (!decision.isBlockingWarning || decision.confidence < 0.7) return null;

    return {
      ...candidate,
      warningType: decision.warningType,
      matchedKeywords: [...candidate.matchedKeywords, "model_confirmed"],
      visibleText: `${candidate.visibleText}\n\nModel warning judgment: ${decision.reason}`
    };
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
