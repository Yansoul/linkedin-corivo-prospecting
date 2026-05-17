import { describe, expect, it, vi } from "vitest";
import { PlaywrightBrowserSession, waitForOperatorResolvableWarning } from "../src/browser-session.js";
import type { AppConfig, PageLike, WarningSignal } from "../src/types.js";

const classifierConfig: AppConfig["classifier"] = {
  provider: "none",
  apiKey: null,
  baseUrl: null,
  model: "test-model",
  fastMode: true,
  temperature: 0,
  minConfidenceToPrepare: 0.78,
  maxTechnicalRiskToPrepare: "medium-low"
};

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

describe("waitForOperatorResolvableWarning", () => {
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

    const result = await waitForOperatorResolvableWarning(page, loginWarning, detectWarning, {
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

    const result = await waitForOperatorResolvableWarning(page, loginWarning, async () => loginWarning, {
      timeoutMs: 1,
      pollMs: 1
    });

    expect(result).toBe(loginWarning);
  });

  it("waits for captcha to clear so the operator can complete it in Chrome", async () => {
    const page = new FakePage();
    const captchaWarning: WarningSignal = {
      warningType: "captcha",
      pageUrl: "https://www.linkedin.com/search/results/people/",
      visibleText: "Complete this captcha verification",
      matchedKeywords: ["captcha", "verification"]
    };
    const detectWarning = vi.fn(async () => {
      page.checks += 1;
      return page.checks < 2 ? captchaWarning : null;
    });

    const result = await waitForOperatorResolvableWarning(page, captchaWarning, detectWarning, {
      timeoutMs: 1000,
      pollMs: 1
    });

    expect(result).toBeNull();
    expect(detectWarning).toHaveBeenCalledTimes(2);
  });

  it("waits for LinkedIn verification text to clear", async () => {
    const page = new FakePage();
    const verifyWarning: WarningSignal = {
      warningType: "verify",
      pageUrl: "https://www.linkedin.com/search/results/people/",
      visibleText: "Please verify your account",
      matchedKeywords: ["verify"]
    };

    const result = await waitForOperatorResolvableWarning(page, verifyWarning, async () => null, {
      timeoutMs: 1000,
      pollMs: 1
    });

    expect(result).toBeNull();
  });
});

describe("PlaywrightBrowserSession.close", () => {
  it("does not report soft verification copy as a warning when the model judge is disabled", async () => {
    const session = new PlaywrightBrowserSession({
      baseUrl: "https://www.linkedin.com",
      useExistingChromeProfile: true,
      chromeUserDataDir: null,
      cdpPort: 9223,
      openStrategy: "playwright-cdp",
      newCandidateContext: "new-window"
    } satisfies AppConfig["linkedin"], classifierConfig);
    const page = {
      url: () => "https://www.linkedin.com/in/amber-hanzi-shen/",
      textContent: async () => "View profile verification details and featured posts."
    };

    await expect(session.detectWarning(page as never)).resolves.toBeNull();
  });

  it("disconnects from a Chrome instance attached over CDP without closing its default context first", async () => {
    const session = new PlaywrightBrowserSession({
      baseUrl: "https://www.linkedin.com",
      useExistingChromeProfile: true,
      chromeUserDataDir: null,
      cdpPort: 9223,
      openStrategy: "playwright-cdp",
      newCandidateContext: "new-window"
    } satisfies AppConfig["linkedin"], classifierConfig);
    const closeContext = vi.fn();
    const closeBrowser = vi.fn();

    Object.assign(session as unknown as { context: unknown; browser: unknown }, {
      context: { close: closeContext },
      browser: { close: closeBrowser }
    });

    await session.close();

    expect(closeContext).not.toHaveBeenCalled();
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("closes the persistent Playwright context that it launched itself", async () => {
    const session = new PlaywrightBrowserSession({
      baseUrl: "https://www.linkedin.com",
      useExistingChromeProfile: false,
      chromeUserDataDir: null,
      cdpPort: 9223,
      openStrategy: "playwright-persistent",
      newCandidateContext: "new-window"
    } satisfies AppConfig["linkedin"], classifierConfig);
    const closeContext = vi.fn();
    const closeBrowser = vi.fn();

    Object.assign(session as unknown as { context: unknown; browser: unknown }, {
      context: { close: closeContext },
      browser: { close: closeBrowser }
    });

    await session.close();

    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).not.toHaveBeenCalled();
  });
});

describe("PlaywrightBrowserSession page labeling", () => {
  it("sets window.name without passing a bundled function into page.evaluate", async () => {
    const session = new PlaywrightBrowserSession({
      baseUrl: "https://www.linkedin.com",
      useExistingChromeProfile: true,
      chromeUserDataDir: null,
      cdpPort: 9223,
      openStrategy: "playwright-cdp",
      newCandidateContext: "new-window"
    } satisfies AppConfig["linkedin"], classifierConfig);
    const evaluate = vi.fn();
    const context = {
      newPage: vi.fn(async () => ({
        evaluate,
        goto: vi.fn()
      }))
    };

    Object.assign(session as unknown as { context: unknown }, { context });

    await session.openSearchPage("growth marketing AI startup");

    expect(evaluate).toHaveBeenCalledWith("window.name = \"window-1\"");
  });
});
