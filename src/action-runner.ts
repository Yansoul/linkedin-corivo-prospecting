import type { ActionResult, AppConfig, PageLike, SearchResultCard } from "./types.js";

export class ActionRunner {
  constructor(private readonly config: AppConfig) {}

  async prepareConnection(candidate: SearchResultCard, page: PageLike): Promise<ActionResult> {
    if (!this.config.actions.clickConnect || this.config.run.mode === "scan") {
      return {
        status: "action_skipped_by_config",
        pageUrl: page.url(),
        details: { mode: this.config.run.mode, clickConnect: this.config.actions.clickConnect }
      };
    }

    const connect = await this.firstVisible(page, [
      'button:has-text("Connect")',
      `[aria-label="Invite ${candidate.name} to connect"]`,
      '[aria-label^="Invite "][aria-label$=" to connect"]'
    ]);
    if (!connect) {
      return {
        status: "action_ambiguous",
        pageUrl: page.url(),
        details: { reason: "Connect button not visible before action." }
      };
    }

    await connect.click();
    await page.waitForTimeout(400);

    const finalDialog = await this.firstVisible(page, [
      'text="Add a note to your invitation?"',
      'button:has-text("Add a note")',
      'button:has-text("Send without a note")'
    ]);
    if (!finalDialog) {
      return {
        status: "action_failed_no_dialog",
        pageUrl: page.url(),
        details: { reason: "Final invitation dialog did not appear after Connect click." }
      };
    }

    if (this.config.run.mode === "debug_send" && this.config.actions.allowSendWithoutNote) {
      const sendButton = await this.firstVisible(page, ['button:has-text("Send without a note")']);
      if (!sendButton) {
        return {
          status: "action_ambiguous",
          pageUrl: page.url(),
          details: { reason: "Debug send was enabled but Send without a note was not visible." }
        };
      }
      await sendButton.click();
      await page.waitForTimeout(800);
      return {
        status: "sent_by_debug_config",
        pageUrl: page.url(),
        details: { sent_by_debug_config: true, allowSendWithoutNote: true }
      };
    }

    return {
      status: "prepared_dialog_open",
      pageUrl: page.url(),
      details: { mode: this.config.run.mode, stopAtFinalDialog: true }
    };
  }

  private async firstVisible(page: PageLike, selectors: string[]) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const count = await locator.count();
      if (count > 0 && (await locator.isVisible())) {
        return locator;
      }
    }
    return null;
  }
}
