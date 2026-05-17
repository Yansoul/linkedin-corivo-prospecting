import { describe, expect, it, vi } from "vitest";
import { detectWarningFromText, detectWarningOnPage } from "../src/warning-detector.js";

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

  it("does not hard-stop on profile verification copy without a model judgment", () => {
    expect(
      detectWarningFromText(
        "Amber is a Premium member. View profile verification details and featured posts.",
        "https://www.linkedin.com/in/amber-hanzi-shen/"
      )
    ).toBeNull();
  });

  it("uses a model judge for soft verification text before returning a warning", async () => {
    const page = {
      url: () => "https://www.linkedin.com/in/amber-hanzi-shen/",
      textContent: async () => "Please verify your identity before continuing to LinkedIn.",
      locator: () => {
        throw new Error("not used");
      },
      waitForTimeout: async () => undefined
    };
    const judge = vi.fn(async (candidate) => ({
      ...candidate,
      warningType: "verification",
      matchedKeywords: [...candidate.matchedKeywords, "model_confirmed"]
    }));

    const warning = await detectWarningOnPage(page, judge);

    expect(judge).toHaveBeenCalledTimes(1);
    expect(warning).toMatchObject({
      warningType: "verification",
      matchedKeywords: ["verify", "model_confirmed"]
    });
  });

  it("hard-stops on LinkedIn login pages", () => {
    const warning = detectWarningFromText(
      "Sign in to LinkedIn Email or phone Password Show Forgot password? Sign in New to LinkedIn? Join now",
      "https://www.linkedin.com/login?fromSignIn=true"
    );

    expect(warning).toMatchObject({
      warningType: "login_required",
      pageUrl: "https://www.linkedin.com/login?fromSignIn=true"
    });
    expect(warning?.matchedKeywords).toContain("sign in to linkedin");
  });

  it("hard-stops on LinkedIn authwall URLs even with sparse visible text", () => {
    const warning = detectWarningFromText(
      "LinkedIn",
      "https://www.linkedin.com/authwall?trk=qf&original_referer=&sessionRedirect=https%3A%2F%2Fwww.linkedin.com%2Fsearch%2Fresults%2Fpeople%2F"
    );

    expect(warning).toMatchObject({
      warningType: "login_required"
    });
  });
});
