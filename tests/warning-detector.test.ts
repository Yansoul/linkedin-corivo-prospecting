import { describe, expect, it } from "vitest";
import { detectWarningFromText } from "../src/warning-detector.js";

describe("detectWarningFromText", () => {
  it("detects account safety and verification warnings", () => {
    const warning = detectWarningFromText(
      "We detected unusual activity. Please complete this security check to verify your account.",
      "https://www.linkedin.com/checkpoint/challenge"
    );

    expect(warning).toMatchObject({
      warningType: "checkpoint",
      pageUrl: "https://www.linkedin.com/checkpoint/challenge"
    });
    expect(warning?.matchedKeywords).toEqual(expect.arrayContaining(["security check", "verify", "unusual activity"]));
  });

  it("returns null when warning keywords are absent", () => {
    expect(detectWarningFromText("People results for product marketing manager AI startup")).toBeNull();
  });
});
