import { describe, expect, it, vi } from "vitest";
import { waitForLoginIfRequired } from "../src/browser-session.js";
import type { PageLike, WarningSignal } from "../src/types.js";

class FakePage implements PageLike {
  checks = 0;

  url() {
    return "https://www.linkedin.com/login";
  }

  locator() {
    return {
      first: () => {
        throw new Error("not used");
      },
      count: async () => 0,
      isVisible: async () => false,
      click: async () => undefined
    };
  }

  async waitForTimeout() {
    return undefined;
  }
}

describe("waitForLoginIfRequired", () => {
  it("waits until login_required clears instead of treating it as a terminal warning", async () => {
    const page = new FakePage();
    const loginWarning: WarningSignal = {
      warningType: "login_required",
      pageUrl: page.url(),
      visibleText: "Sign in to LinkedIn",
      matchedKeywords: ["sign in to linkedin"]
    };
    const detectWarning = vi.fn(async () => {
      page.checks += 1;
      return page.checks < 3 ? loginWarning : null;
    });

    const result = await waitForLoginIfRequired(page, loginWarning, detectWarning, {
      timeoutMs: 1000,
      pollMs: 1
    });

    expect(result).toBeNull();
    expect(detectWarning).toHaveBeenCalledTimes(3);
  });

  it("returns the original login warning after timeout", async () => {
    const page = new FakePage();
    const loginWarning: WarningSignal = {
      warningType: "login_required",
      pageUrl: page.url(),
      visibleText: "Sign in to LinkedIn",
      matchedKeywords: ["sign in to linkedin"]
    };

    const result = await waitForLoginIfRequired(page, loginWarning, async () => loginWarning, {
      timeoutMs: 1,
      pollMs: 1
    });

    expect(result).toBe(loginWarning);
  });
});
