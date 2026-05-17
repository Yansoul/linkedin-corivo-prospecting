import { describe, expect, it } from "vitest";
import { ActionRunner } from "../src/action-runner.js";
import { resolveConfig } from "../src/config.js";
import type { SearchResultCard } from "../src/types.js";

class FakeLocator {
  constructor(
    private readonly page: FakePage,
    private readonly selector: string
  ) {}

  first() {
    return this;
  }

  async count() {
    return this.page.hasSelector(this.selector) ? 1 : 0;
  }

  async isVisible() {
    return this.page.hasSelector(this.selector);
  }

  async click() {
    this.page.clicked.push(this.selector);
    if (this.selector.includes("Connect")) {
      this.page.dialogOpen = true;
    }
    if (this.selector.includes("Send without a note")) {
      this.page.sent = true;
    }
  }
}

class FakePage {
  clicked: string[] = [];
  dialogOpen = false;
  sent = false;

  url() {
    return "https://www.linkedin.com/in/mirandaschumes/";
  }

  locator(selector: string) {
    return new FakeLocator(this, selector);
  }

  async waitForTimeout() {
    return undefined;
  }

  hasSelector(selector: string) {
    if (selector.includes("Connect")) return true;
    if (selector.includes("Add a note to your invitation")) return this.dialogOpen;
    if (selector.includes("Send without a note")) return this.dialogOpen;
    if (selector.includes("Pending")) return this.sent;
    return false;
  }
}

const candidate: SearchResultCard = {
  name: "Miranda Schumes",
  profileUrl: "https://www.linkedin.com/in/mirandaschumes/",
  headline: "Product Marketing Manager",
  location: null,
  currentCompany: "Claravine",
  connectionDegree: "2nd",
  buttonState: "Connect",
  rawText: "Product Marketing Manager",
  query: "product marketing manager AI startup",
  rank: 1
};

describe("ActionRunner", () => {
  it("stops at the final dialog in prepare mode", async () => {
    const page = new FakePage();
    const result = await new ActionRunner(resolveConfig()).prepareConnection(candidate, page);

    expect(result.status).toBe("prepared_dialog_open");
    expect(page.clicked).toContain('button:has-text("Connect")');
    expect(page.sent).toBe(false);
  });

  it("only clicks send without a note under explicit debug_send config", async () => {
    const page = new FakePage();
    const result = await new ActionRunner(
      resolveConfig({
        run: { mode: "debug_send" },
        actions: { allowSendWithoutNote: true }
      })
    ).prepareConnection(candidate, page);

    expect(result.status).toBe("sent_by_debug_config");
    expect(page.clicked).toContain('button:has-text("Send without a note")');
  });
});
