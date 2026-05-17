import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { ReportWriter } from "../src/report-writer.js";
import { StateStore } from "../src/state-store.js";

describe("StateStore and ReportWriter", () => {
  it("persists candidates, action events, JSONL audit, and report rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "linkedin-corivo-"));
    mkdirSync(join(dir, "data"));
    const config = resolveConfig({
      storage: {
        sqlitePath: join(dir, "data/state.sqlite"),
        jsonlAuditPath: join(dir, "data/audit.jsonl"),
        screenshotsDir: join(dir, "data/screenshots")
      }
    });
    const store = new StateStore(config.storage);
    const runId = store.startRun(config);
    const queryId = store.startQuery(runId, "product marketing manager AI startup");
    const candidateId = store.upsertCandidate(runId, queryId, {
      name: "Miranda Schumes",
      profileUrl: "https://www.linkedin.com/in/mirandaschumes/",
      headline: "Sr. Product Marketing Manager",
      location: "Boca Raton",
      currentCompany: "Claravine",
      connectionDegree: "2nd",
      buttonState: "Connect",
      rawText: "Sr. Product Marketing Manager at Claravine",
      query: "product marketing manager AI startup",
      rank: 1
    });

    store.recordActionEvent(runId, candidateId, {
      eventType: "prepared_dialog_open",
      pageUrl: "https://www.linkedin.com/in/mirandaschumes/",
      windowLabel: "window-2",
      details: { mode: "prepare" }
    });
    store.endRun(runId, "completed");

    const audit = readFileSync(config.storage.jsonlAuditPath, "utf8");
    expect(audit).toContain("prepared_dialog_open");

    const report = new ReportWriter(store).buildMarkdownReport(runId);
    expect(report).toContain("Prepared dialogs");
    expect(report).toContain("| Miranda Schumes | Sr. Product Marketing Manager | Claravine |");
  });
});
