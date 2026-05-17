import type { BrowserSession } from "./browser-session.js";
import { ActionRunner } from "./action-runner.js";
import { buildClassifierPayload, LLMClassifier, shouldPrepareFromDecision } from "./llm-classifier.js";
import { extractProfileContext } from "./profile-extractor.js";
import { extractSearchResultCards } from "./result-extractor.js";
import { RuleFilter } from "./rule-filter.js";
import type { AppConfig, SearchResultCard, WarningSignal } from "./types.js";
import type { StateStore } from "./state-store.js";

export interface RunWorkflowResult {
  runId: string;
  status: "completed" | "stopped";
  stopReason: string | null;
  preparedCount: number;
  sentCount: number;
}

export class QueryRunner {
  private readonly ruleFilter: RuleFilter;
  private readonly classifier: LLMClassifier;
  private readonly actionRunner: ActionRunner;

  constructor(
    private readonly config: AppConfig,
    private readonly store: StateStore,
    private readonly browser: BrowserSession
  ) {
    this.ruleFilter = new RuleFilter(config.filters);
    this.classifier = new LLMClassifier(config.classifier);
    this.actionRunner = new ActionRunner(config);
  }

  async run(runId: string): Promise<RunWorkflowResult> {
    let preparedCount = 0;
    let sentCount = 0;

    try {
      for (const query of this.config.run.queries.slice(0, this.config.run.maxQueriesPerRun)) {
        const queryId = this.store.startQuery(runId, query);
        const searchPage = await this.browser.openSearchPage(query);
        let warning = await this.browser.detectWarning(searchPage);
        if (warning) {
          warning = await this.browser.waitForOperatorResolvableWarning(searchPage, warning);
          if (!warning) {
            await searchPage.goto(searchPage.url(), { waitUntil: "domcontentloaded" });
          }
        }
        if (warning) {
          this.store.recordWarning(runId, warning);
          this.store.endQuery(queryId, "stopped_by_warning");
          this.store.endRun(runId, "stopped", warning.warningType);
          return { runId, status: "stopped", stopReason: warning.warningType, preparedCount, sentCount };
        }

        const cards = await extractSearchResultCards(searchPage, query);
        let reviewedForQuery = 0;

        for (const card of cards) {
          if (this.config.run.resume && this.store.hasTerminalCandidate(card.profileUrl)) continue;
          const candidateId = this.store.upsertCandidate(runId, queryId, card);
          const ruleDecision = this.ruleFilter.decide(card);
          this.store.recordRuleDecision(candidateId, ruleDecision);

          if (ruleDecision.decision.startsWith("skip_")) continue;
          if (reviewedForQuery >= this.config.run.maxProfilesReviewedPerQuery) break;

          reviewedForQuery += 1;
          const profilePage = await this.browser.openProfilePage(card.profileUrl);
          let profileWarning = await this.browser.detectWarning(profilePage);
          if (profileWarning) {
            profileWarning = await this.browser.waitForOperatorResolvableWarning(profilePage, profileWarning);
            if (!profileWarning) {
              await profilePage.goto(profilePage.url(), { waitUntil: "domcontentloaded" });
            }
          }
          if (profileWarning) {
            this.store.recordWarning(runId, profileWarning);
            this.store.recordActionEvent(runId, candidateId, {
              eventType: "warning_stopped",
              pageUrl: profilePage.url(),
              windowLabel: await windowLabel(profilePage),
              details: { ...profileWarning }
            });
            if (this.config.run.stopOnFirstWarning) {
              this.store.endQuery(queryId, "stopped_by_warning");
              this.store.endRun(runId, "stopped", profileWarning.warningType);
              return { runId, status: "stopped", stopReason: profileWarning.warningType, preparedCount, sentCount };
            }
          }

          const profile = await extractProfileContext(profilePage, card.profileUrl);
          this.store.recordProfileSnapshot(candidateId, profile);
          const decision = await this.classifier.classify(query, card, profile);
          const payload = buildClassifierPayload(query, card, profile);
          this.store.recordLlmDecision(candidateId, this.config.classifier.model, decision, payload, decision);

          if (!shouldPrepareFromDecision(decision, this.config.classifier)) {
            this.store.recordActionEvent(runId, candidateId, {
              eventType: "llm_rejected",
              pageUrl: profilePage.url(),
              windowLabel: await windowLabel(profilePage),
              details: { confidence: decision.confidence, reason: decision.reason, technicalRisk: decision.technicalRisk }
            });
            continue;
          }

          const action = await this.actionRunner.prepareConnection(cardWithProfileState(card, profile.visibleConnectState), profilePage);
          this.store.recordActionEvent(runId, candidateId, {
            eventType: action.status,
            pageUrl: action.pageUrl,
            windowLabel: await windowLabel(profilePage),
            details: action.details
          });
          if (action.status === "prepared_dialog_open") preparedCount += 1;
          if (action.status === "sent_by_debug_config") sentCount += 1;
          if (preparedCount + sentCount >= this.config.run.maxPreparedPerRun) {
            this.store.endQuery(queryId, "completed");
            this.store.endRun(runId, "completed", "maxPreparedPerRun reached");
            return { runId, status: "completed", stopReason: "maxPreparedPerRun reached", preparedCount, sentCount };
          }

          await delayBetweenActions(this.config.run.delayMsBetweenActions);
        }

        this.store.endQuery(queryId, "completed");
      }

      this.store.endRun(runId, "completed");
      return { runId, status: "completed", stopReason: null, preparedCount, sentCount };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.store.endRun(runId, "stopped", reason);
      return { runId, status: "stopped", stopReason: reason, preparedCount, sentCount };
    }
  }
}

async function delayBetweenActions([min, max]: [number, number]): Promise<void> {
  const delay = Math.floor(min + Math.random() * (max - min));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function cardWithProfileState(card: SearchResultCard, visibleConnectState: SearchResultCard["buttonState"]): SearchResultCard {
  return { ...card, buttonState: visibleConnectState };
}

async function windowLabel(page: { evaluate<T>(expression: string): Promise<T> }): Promise<string | null> {
  try {
    return await page.evaluate("window.name || null");
  } catch {
    return null;
  }
}

export function warningToStopReason(warning: WarningSignal): string {
  return `${warning.warningType}: ${warning.matchedKeywords.join(", ")}`;
}
