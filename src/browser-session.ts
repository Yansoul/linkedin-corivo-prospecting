import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { AppConfig, WarningSignal } from "./types.js";
import { buildPeopleSearchUrl } from "./result-extractor.js";
import { detectWarningOnPage } from "./warning-detector.js";

export interface BrowserSession {
  openSearchPage(query: string): Promise<Page>;
  openProfilePage(url: string): Promise<Page>;
  openNewCandidateContext(url: string): Promise<Page>;
  detectWarning(page: Page): Promise<WarningSignal | null>;
  close(): Promise<void>;
}

export class PlaywrightBrowserSession implements BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private windowCounter = 0;

  constructor(private readonly config: AppConfig["linkedin"]) {}

  async openSearchPage(query: string): Promise<Page> {
    const page = await this.openPage();
    await page.goto(buildPeopleSearchUrl(query, this.config.baseUrl), { waitUntil: "domcontentloaded" });
    return page;
  }

  async openProfilePage(url: string): Promise<Page> {
    return this.openNewCandidateContext(url);
  }

  async openNewCandidateContext(url: string): Promise<Page> {
    const page = await this.openPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return page;
  }

  async detectWarning(page: Page): Promise<WarningSignal | null> {
    return detectWarningOnPage(page);
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    else if (this.browser) await this.browser.close();
    this.context = null;
    this.browser = null;
  }

  private async openPage(): Promise<Page> {
    const context = await this.getContext();
    const page = await context.newPage();
    this.windowCounter += 1;
    await page.evaluate((windowLabel) => {
      window.name = windowLabel;
    }, `window-${this.windowCounter}`);
    return page;
  }

  private async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;

    if (this.config.openStrategy === "playwright-cdp") {
      this.browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
      this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());
      return this.context;
    }

    const userDataDir = this.config.chromeUserDataDir ?? `${process.env.HOME}/.local/share/corivo-linkedin-chrome`;
    this.context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      viewport: null,
      args: ["--start-maximized"]
    });
    return this.context;
  }
}
