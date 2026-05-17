import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AppConfig,
  ClassifierDecision,
  ProfileContext,
  RuleFilterResult,
  SearchResultCard,
  WarningSignal
} from "./types.js";

export interface ActionEventInput {
  eventType: string;
  pageUrl: string;
  windowLabel: string | null;
  details: Record<string, unknown>;
}

export class StateStore {
  private readonly db: DatabaseSync;

  constructor(private readonly storage: AppConfig["storage"]) {
    mkdirSync(dirname(storage.sqlitePath), { recursive: true });
    mkdirSync(dirname(storage.jsonlAuditPath), { recursive: true });
    mkdirSync(storage.screenshotsDir, { recursive: true });
    this.db = new DatabaseSync(storage.sqlitePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  startRun(config: AppConfig): string {
    const id = idWithPrefix("run");
    this.db
      .prepare("INSERT INTO runs (id, started_at, mode, config_json, status) VALUES (?, ?, ?, ?, ?)")
      .run(id, nowIso(), config.run.mode, JSON.stringify(config), "running");
    this.writeAudit({ runId: id, event: "run_started", details: { mode: config.run.mode } });
    return id;
  }

  endRun(runId: string, status: string, stopReason: string | null = null): void {
    this.db
      .prepare("UPDATE runs SET ended_at = ?, status = ?, stop_reason = ? WHERE id = ?")
      .run(nowIso(), status, stopReason, runId);
    this.writeAudit({ runId, event: "run_ended", details: { status, stopReason } });
  }

  startQuery(runId: string, query: string): string {
    const id = idWithPrefix("query");
    this.db
      .prepare("INSERT INTO queries (id, run_id, query, status, started_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, runId, query, "running", nowIso());
    this.writeAudit({ runId, event: "query_started", query, details: {} });
    return id;
  }

  endQuery(queryId: string, status: string): void {
    this.db.prepare("UPDATE queries SET status = ?, ended_at = ? WHERE id = ?").run(status, nowIso(), queryId);
  }

  upsertCandidate(runId: string, queryId: string, card: SearchResultCard): string {
    const existing = this.db.prepare("SELECT id FROM candidates WHERE profile_url = ?").get(card.profileUrl) as
      | { id: string }
      | undefined;
    const timestamp = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE candidates
           SET run_id = ?, query_id = ?, name = ?, headline = ?, current_company = ?, location = ?,
               connection_degree = ?, button_state = ?, search_rank = ?, raw_card_text = ?, last_seen_at = ?
           WHERE id = ?`
        )
        .run(
          runId,
          queryId,
          card.name,
          card.headline,
          card.currentCompany,
          card.location,
          card.connectionDegree,
          card.buttonState,
          card.rank,
          card.rawText,
          timestamp,
          existing.id
        );
      return existing.id;
    }

    const id = idWithPrefix("cand");
    this.db
      .prepare(
        `INSERT INTO candidates (
          id, run_id, query_id, profile_url, name, headline, current_company, location,
          connection_degree, button_state, search_rank, raw_card_text, first_seen_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        runId,
        queryId,
        card.profileUrl,
        card.name,
        card.headline,
        card.currentCompany,
        card.location,
        card.connectionDegree,
        card.buttonState,
        card.rank,
        card.rawText,
        timestamp,
        timestamp
      );
    return id;
  }

  recordRuleDecision(candidateId: string, result: RuleFilterResult): string {
    const id = idWithPrefix("rule");
    this.db
      .prepare(
        `INSERT INTO rule_decisions (
          id, candidate_id, decided_at, decision, positive_matches_json, negative_matches_json, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        candidateId,
        nowIso(),
        result.decision,
        JSON.stringify(result.positiveMatches),
        JSON.stringify(result.negativeMatches),
        result.reason
      );
    return id;
  }

  recordProfileSnapshot(candidateId: string, profile: ProfileContext): string {
    const id = idWithPrefix("profile");
    this.db
      .prepare(
        `INSERT INTO profile_snapshots (
          id, candidate_id, captured_at, headline, current_company, about, experience_json,
          skills_json, certifications_json, recent_activity_json, raw_visible_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        candidateId,
        nowIso(),
        profile.headline,
        profile.currentCompany,
        profile.about,
        JSON.stringify(profile.experience),
        JSON.stringify(profile.skills),
        JSON.stringify(profile.certifications),
        JSON.stringify(profile.recentActivity),
        profile.rawVisibleText
      );
    return id;
  }

  recordLlmDecision(
    candidateId: string,
    model: string,
    decision: ClassifierDecision,
    rawRequest: unknown,
    rawResponse: unknown
  ): string {
    const id = idWithPrefix("llm");
    this.db
      .prepare(
        `INSERT INTO llm_decisions (
          id, candidate_id, decided_at, model, qualified, should_prepare_connection, role_category,
          company_category, technical_risk, icp_fit_score, confidence, reason, red_flags_json,
          raw_request_json, raw_response_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        candidateId,
        nowIso(),
        model,
        decision.qualified ? 1 : 0,
        decision.shouldPrepareConnection ? 1 : 0,
        decision.roleCategory,
        decision.companyCategory,
        decision.technicalRisk,
        decision.icpFitScore,
        decision.confidence,
        decision.reason,
        JSON.stringify(decision.redFlags),
        JSON.stringify(rawRequest),
        JSON.stringify(rawResponse)
      );
    return id;
  }

  recordActionEvent(runId: string, candidateId: string, input: ActionEventInput): string {
    const id = idWithPrefix("action");
    this.db
      .prepare(
        `INSERT INTO action_events (
          id, run_id, candidate_id, occurred_at, event_type, page_url, window_label, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, runId, candidateId, nowIso(), input.eventType, input.pageUrl, input.windowLabel, JSON.stringify(input.details));

    const candidate = this.getCandidate(candidateId);
    this.writeAudit({
      runId,
      event: input.eventType,
      candidate: candidate
        ? {
            name: candidate.name,
            profileUrl: candidate.profile_url
          }
        : undefined,
      query: candidate?.query,
      details: input.details
    });
    return id;
  }

  recordWarning(runId: string, warning: WarningSignal, screenshotPath: string | null = null): string {
    const id = idWithPrefix("warning");
    this.db
      .prepare(
        "INSERT INTO warnings (id, run_id, occurred_at, page_url, warning_type, visible_text, screenshot_path) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, runId, nowIso(), warning.pageUrl, warning.warningType, warning.visibleText, screenshotPath);
    this.writeAudit({ runId, event: "warning_detected", details: { ...warning, screenshotPath } });
    return id;
  }

  hasTerminalCandidate(profileUrl: string): boolean {
    const row = this.db
      .prepare(
        `SELECT ae.event_type AS event_type, rd.decision AS rule_decision, ld.qualified AS qualified
         FROM candidates c
         LEFT JOIN action_events ae ON ae.candidate_id = c.id
         LEFT JOIN rule_decisions rd ON rd.candidate_id = c.id
         LEFT JOIN llm_decisions ld ON ld.candidate_id = c.id
         WHERE c.profile_url = ?
         ORDER BY ae.occurred_at DESC, rd.decided_at DESC, ld.decided_at DESC
         LIMIT 1`
      )
      .get(profileUrl) as { event_type?: string; rule_decision?: string; qualified?: number } | undefined;
    if (!row) return false;
    return (
      ["prepared_dialog_open", "sent_by_debug_config"].includes(row.event_type ?? "") ||
      ["skip_obvious_technical", "skip_unavailable_action", "skip_low_relevance"].includes(row.rule_decision ?? "") ||
      row.qualified === 0
    );
  }

  getRun(runId: string): Record<string, unknown> | undefined {
    return this.db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as Record<string, unknown> | undefined;
  }

  getReportRows(runId: string): {
    prepared: ReportRow[];
    debugSent: ReportRow[];
    warnings: WarningRow[];
    queries: QueryRow[];
    skipped: DecisionRow[];
    rejected: DecisionRow[];
  } {
    const prepared = this.db
      .prepare(
        `SELECT c.name, c.headline, c.current_company, q.query, ae.event_type AS status, ae.window_label
         FROM action_events ae
         JOIN candidates c ON c.id = ae.candidate_id
         JOIN queries q ON q.id = c.query_id
         WHERE ae.run_id = ? AND ae.event_type = 'prepared_dialog_open'
         ORDER BY ae.occurred_at`
      )
      .all(runId) as unknown as ReportRow[];
    const debugSent = this.db
      .prepare(
        `SELECT c.name, c.headline, c.current_company, q.query, ae.event_type AS status, ae.details_json
         FROM action_events ae
         JOIN candidates c ON c.id = ae.candidate_id
         JOIN queries q ON q.id = c.query_id
         WHERE ae.run_id = ? AND ae.event_type = 'sent_by_debug_config'
         ORDER BY ae.occurred_at`
      )
      .all(runId) as unknown as ReportRow[];
    const warnings = this.db.prepare("SELECT * FROM warnings WHERE run_id = ? ORDER BY occurred_at").all(runId) as unknown as WarningRow[];
    const queries = this.db.prepare("SELECT * FROM queries WHERE run_id = ? ORDER BY started_at").all(runId) as unknown as QueryRow[];
    const skipped = this.db
      .prepare(
        `SELECT c.name, c.headline, c.current_company, q.query, rd.decision, rd.reason
         FROM rule_decisions rd
         JOIN candidates c ON c.id = rd.candidate_id
         JOIN queries q ON q.id = c.query_id
         WHERE c.run_id = ? AND rd.decision LIKE 'skip_%'
         ORDER BY rd.decided_at`
      )
      .all(runId) as unknown as DecisionRow[];
    const rejected = this.db
      .prepare(
        `SELECT c.name, c.headline, c.current_company, q.query, ld.reason, ld.confidence
         FROM llm_decisions ld
         JOIN candidates c ON c.id = ld.candidate_id
         JOIN queries q ON q.id = c.query_id
         WHERE c.run_id = ? AND ld.qualified = 0
         ORDER BY ld.decided_at`
      )
      .all(runId) as unknown as DecisionRow[];
    return { prepared, debugSent, warnings, queries, skipped, rejected };
  }

  close(): void {
    this.db.close();
  }

  private getCandidate(candidateId: string): { name: string; profile_url: string; query: string } | undefined {
    return this.db
      .prepare(
        `SELECT c.name, c.profile_url, q.query
         FROM candidates c
         JOIN queries q ON q.id = c.query_id
         WHERE c.id = ?`
      )
      .get(candidateId) as { name: string; profile_url: string; query: string } | undefined;
  }

  private writeAudit(event: Record<string, unknown>): void {
    appendFileSync(this.storage.jsonlAuditPath, `${JSON.stringify({ ts: nowIso(), ...event })}\n`);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        mode TEXT NOT NULL,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL,
        stop_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS queries (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        query TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        profile_url TEXT NOT NULL,
        name TEXT NOT NULL,
        headline TEXT,
        current_company TEXT,
        location TEXT,
        connection_degree TEXT,
        button_state TEXT,
        search_rank INTEGER,
        raw_card_text TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(profile_url),
        FOREIGN KEY (run_id) REFERENCES runs(id),
        FOREIGN KEY (query_id) REFERENCES queries(id)
      );

      CREATE TABLE IF NOT EXISTS profile_snapshots (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        headline TEXT,
        current_company TEXT,
        about TEXT,
        experience_json TEXT,
        skills_json TEXT,
        certifications_json TEXT,
        recent_activity_json TEXT,
        raw_visible_text TEXT,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE IF NOT EXISTS rule_decisions (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        decided_at TEXT NOT NULL,
        decision TEXT NOT NULL,
        positive_matches_json TEXT NOT NULL,
        negative_matches_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE IF NOT EXISTS llm_decisions (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        decided_at TEXT NOT NULL,
        model TEXT NOT NULL,
        qualified INTEGER NOT NULL,
        should_prepare_connection INTEGER NOT NULL,
        role_category TEXT,
        company_category TEXT,
        technical_risk TEXT,
        icp_fit_score REAL,
        confidence REAL,
        reason TEXT,
        red_flags_json TEXT NOT NULL,
        raw_request_json TEXT NOT NULL,
        raw_response_json TEXT NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE IF NOT EXISTS action_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        page_url TEXT NOT NULL,
        window_label TEXT,
        details_json TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES runs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
      );

      CREATE TABLE IF NOT EXISTS warnings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        page_url TEXT,
        warning_type TEXT NOT NULL,
        visible_text TEXT NOT NULL,
        screenshot_path TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );
    `);
  }
}

interface ReportRow {
  name: string;
  headline: string | null;
  current_company: string | null;
  query: string;
  status: string;
  window_label?: string | null;
  details_json?: string;
}

interface WarningRow {
  warning_type: string;
  page_url: string | null;
  occurred_at: string;
  screenshot_path: string | null;
}

interface QueryRow {
  query: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
}

interface DecisionRow {
  name: string;
  headline: string | null;
  current_company: string | null;
  query: string;
  decision?: string;
  reason?: string;
  confidence?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function idWithPrefix(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
