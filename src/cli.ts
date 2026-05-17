#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { PlaywrightBrowserSession } from "./browser-session.js";
import { envConfigFromEnv, loadConfigFile, mergePartialConfig, resolveConfig, type PartialAppConfig } from "./config.js";
import { loadDotenvFile } from "./env-loader.js";
import { QueryRunner } from "./query-runner.js";
import { ReportWriter, summarizeConfig, writeLatestReportPointer } from "./report-writer.js";
import { StateStore } from "./state-store.js";

const program = new Command();
loadDotenvFile();

program
  .name("linkedin-corivo")
  .description("Local operator-assisted LinkedIn prospecting automation for Corivo.")
  .version("0.1.0");

program
  .command("run")
  .description("Run the LinkedIn prospecting workflow.")
  .option("-c, --config <path>", "config JSON path", "config/linkedin-corivo-prospecting.example.json")
  .option("--mode <mode>", "scan, prepare, or debug_send")
  .option("--max-prepared <count>", "maximum prepared/sent candidates per run")
  .option("--allow-send-without-note", "allow clicking Send without a note, only valid in debug_send")
  .option("--no-allow-send-without-note", "disable clicking Send without a note")
  .option("--classifier-provider <provider>", "openai or none")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openai-base-url <url>", "OpenAI-compatible API base URL")
  .option("--openai-model <model>", "OpenAI model name")
  .option("--fast", "enable fast OpenAI mode using minimal reasoning")
  .option("--no-fast", "disable fast OpenAI mode")
  .action(async (options) => {
    const configFile = options.config as string;
    const fileConfig = existsSync(configFile) ? loadConfigFile(configFile) : {};
    const cliOverrides: PartialAppConfig = {
      run: {
        mode: options.mode,
        maxPreparedPerRun: options.maxPrepared ? Number(options.maxPrepared) : undefined
      },
      actions: {
        allowSendWithoutNote: typeof options.allowSendWithoutNote === "boolean" ? options.allowSendWithoutNote : undefined
      },
      classifier: {
        provider: options.classifierProvider,
        apiKey: options.openaiApiKey,
        baseUrl: options.openaiBaseUrl,
        model: options.openaiModel,
        fastMode: options.fast
      }
    };
    const config = resolveConfig(mergePartialConfig(mergePartialConfig(fileConfig, envConfigFromEnv(process.env)), cliOverrides));

    if (config.run.mode === "debug_send" && config.actions.allowSendWithoutNote) {
      console.error('DEBUG SEND ENABLED: this run may click "Send without a note" when a candidate passes classification.');
    }

    console.error("Resolved config:");
    console.error(summarizeConfig(config));

    const store = new StateStore(config.storage);
    const runId = store.startRun(config);
    const browser = new PlaywrightBrowserSession(config.linkedin, config.classifier);
    try {
      const result = await new QueryRunner(config, store, browser).run(runId);
      const reportPath = new ReportWriter(store).writeReport(runId);
      writeLatestReportPointer(reportPath);
      console.log(JSON.stringify({ ...result, reportPath }, null, 2));
    } finally {
      await browser.close();
      store.close();
    }
  });

program
  .command("report")
  .description("Print a report path or the latest report content.")
  .option("--latest", "print latest report")
  .action((options) => {
    if (!options.latest) {
      throw new Error("Only --latest is currently supported.");
    }
    const latestPath = readFileSync(join("reports", "latest.txt"), "utf8").trim();
    console.log(readFileSync(latestPath, "utf8"));
  });

program
  .command("inspect-candidate")
  .description("Show where candidate inspection data is stored.")
  .argument("<profile-url>")
  .action((profileUrl) => {
    console.log(`Inspect ${profileUrl} in data/linkedin-corivo-prospecting.sqlite candidates/profile_snapshots/decisions tables.`);
  });

await program.parseAsync(process.argv);
