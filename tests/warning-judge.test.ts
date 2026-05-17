import { describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config.js";
import { buildWarningJudgeParams, parseWarningJudgeOutput, WarningJudge } from "../src/warning-judge.js";
import type { WarningSignal } from "../src/types.js";

describe("warning judge helpers", () => {
  const candidate: WarningSignal = {
    warningType: "verify",
    pageUrl: "https://www.linkedin.com/in/amber-hanzi-shen/",
    visibleText: "Please verify your identity before continuing.",
    matchedKeywords: ["verify"]
  };

  it("parses strict JSON model output", () => {
    expect(
      parseWarningJudgeOutput(
        JSON.stringify({
          isBlockingWarning: true,
          warningType: "verification",
          confidence: 0.9,
          reason: "The page asks the user to verify identity before continuing."
        })
      )
    ).toEqual({
      isBlockingWarning: true,
      warningType: "verification",
      confidence: 0.9,
      reason: "The page asks the user to verify identity before continuing."
    });
  });

  it("builds a fast OpenAI JSON-schema request for soft warning checks", () => {
    const params = buildWarningJudgeParams({ ...resolveConfig().classifier, fastMode: true }, candidate);

    expect(params.model).toBe(resolveConfig().classifier.model);
    expect(params.reasoning).toEqual({ effort: "minimal" });
    expect(params.text?.format?.type).toBe("json_schema");
    expect(JSON.stringify(params.input)).toContain("Please verify your identity");
  });

  it("treats model API failures as non-blocking for soft warning checks", async () => {
    const judge = new WarningJudge(resolveConfig().classifier, {
      responses: {
        create: vi.fn(async () => {
          throw new Error("403 Your request was blocked.");
        })
      }
    });

    await expect(judge.judge(candidate)).resolves.toBeNull();
  });
});
