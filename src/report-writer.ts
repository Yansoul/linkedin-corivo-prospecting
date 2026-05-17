import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppConfig } from "./types.js";
import type { StateStore } from "./state-store.js";

export class ReportWriter {
  constructor(private readonly store: StateStore) {}

  buildMarkdownReport(runId: string): string {
    const run = this.store.getRun(runId);
    const rows = this.store.getReportRows(runId);
    const configJson = typeof run?.config_json === "string" ? JSON.parse(run.config_json) : null;

    return [
      `# LinkedIn Corivo Prospecting Report`,
      "",
      "## Run summary",
      "",
      `- Run ID: ${runId}`,
      `- Mode: ${run?.mode ?? "unknown"}`,
      `- Status: ${run?.status ?? "unknown"}`,
      `- Stop reason: ${run?.stop_reason ?? "none"}`,
      "",
      "## Config summary",
      "",
      `- Max prepared per run: ${configJson?.run?.maxPreparedPerRun ?? "unknown"}`,
      `- Allow send without note: ${configJson?.actions?.allowSendWithoutNote ?? "unknown"}`,
      `- Classifier: ${configJson?.classifier?.provider ?? "unknown"} / ${configJson?.classifier?.model ?? "unknown"}`,
      "",
      "## Prepared dialogs",
      "",
      "| Name | Title | Company | Query | Status | Window |",
      "| --- | --- | --- | --- | --- | --- |",
      ...emptyAwareRows(
        rows.prepared.map((row) =>
          tableRow([
            row.name,
            row.headline,
            row.current_company,
            row.query,
            "Prepared, final send dialog open",
            row.window_label ?? ""
          ])
        )
      ),
      "",
      "## Debug-sent requests",
      "",
      "| Name | Title | Company | Query | Status | Config |",
      "| --- | --- | --- | --- | --- | --- |",
      ...emptyAwareRows(
        rows.debugSent.map((row) =>
          tableRow([row.name, row.headline, row.current_company, row.query, "Sent by debug config", "allowSendWithoutNote=true"])
        )
      ),
      "",
      "## Qualified but not acted on",
      "",
      "_Not currently separated from scan-mode decisions; inspect SQLite for full decision history._",
      "",
      "## Skipped by rule filter",
      "",
      "| Name | Title | Company | Query | Decision | Reason |",
      "| --- | --- | --- | --- | --- | --- |",
      ...emptyAwareRows(
        rows.skipped.map((row) => tableRow([row.name, row.headline, row.current_company, row.query, row.decision, row.reason]))
      ),
      "",
      "## Rejected by LLM",
      "",
      "| Name | Title | Company | Query | Confidence | Reason |",
      "| --- | --- | --- | --- | --- | --- |",
      ...emptyAwareRows(
        rows.rejected.map((row) =>
          tableRow([row.name, row.headline, row.current_company, row.query, String(row.confidence ?? ""), row.reason])
        )
      ),
      "",
      "## Warnings/errors",
      "",
      "| Type | Page | Time | Screenshot |",
      "| --- | --- | --- | --- |",
      ...emptyAwareRows(rows.warnings.map((row) => tableRow([row.warning_type, row.page_url, row.occurred_at, row.screenshot_path]))),
      "",
      "## Query coverage",
      "",
      "| Query | Status | Started | Ended |",
      "| --- | --- | --- | --- |",
      ...emptyAwareRows(rows.queries.map((row) => tableRow([row.query, row.status, row.started_at, row.ended_at]))),
      ""
    ].join("\n");
  }

  writeReport(runId: string, reportsDir = "reports"): string {
    const path = join(reportsDir, `linkedin-corivo-prospecting-${runId}.md`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, this.buildMarkdownReport(runId));
    return path;
  }
}

export function writeLatestReportPointer(path: string, reportsDir = "reports"): void {
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "latest.txt"), `${path}\n`);
}

function tableRow(values: unknown[]): string {
  return `| ${values.map((value) => escapeCell(value)).join(" | ")} |`;
}

function escapeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function emptyAwareRows(rows: string[]): string[] {
  return rows.length > 0 ? rows : ["| _None_ |  |  |  |  |  |"];
}

export function summarizeConfig(config: AppConfig): string {
  return JSON.stringify(
    {
      mode: config.run.mode,
      maxPreparedPerRun: config.run.maxPreparedPerRun,
      maxProfilesReviewedPerQuery: config.run.maxProfilesReviewedPerQuery,
      maxQueriesPerRun: config.run.maxQueriesPerRun,
      allowSendWithoutNote: config.actions.allowSendWithoutNote,
      model: config.classifier.model
    },
    null,
    2
  );
}
