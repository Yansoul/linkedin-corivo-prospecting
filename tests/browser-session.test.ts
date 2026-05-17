import { describe, expect, it, vi } from "vitest";
import { PlaywrightBrowserSession, waitForLoginIfRequired } from "../src/browser-session.js";
import type { AppConfig, PageLike, WarningSignal } from "../src/types.js";

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

describe("PlaywrightBrowserSession.close", () => {
  it("disconnects from a Chrome instance attached over CDP without closing its default context first", async () => {
    const session = new PlaywrightBrowserSession({
      baseUrl: "https://www.linkedin.com",
      useExistingChromeProfile: true,
      chromeUserDataDir: null,
      cdpPort: 9223,
      openStrategy: "playwright-cdp",
      newCandidateContext: "new-window"
    } satisfies AppConfig["linkedin"]);
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
    } satisfies AppConfig["linkedin"]);
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
