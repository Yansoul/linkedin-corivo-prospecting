import { readFileSync } from "node:fs";
import { z } from "zod";
import { defaultQueries, type AppConfig } from "./types.js";

const technicalRiskSchema = z.enum(["low", "medium-low", "medium", "high"]);
const buttonStateSchema = z.enum(["Connect", "Pending", "Connected", "Message", "Follow", "Unknown"]);

const partialConfigSchema = z
  .object({
    linkedin: z
      .object({
        baseUrl: z.string().url().optional(),
        useExistingChromeProfile: z.boolean().optional(),
        chromeUserDataDir: z.string().nullable().optional(),
        openStrategy: z.enum(["playwright-cdp", "playwright-persistent"]).optional(),
        newCandidateContext: z.enum(["new-window", "new-tab"]).optional()
      })
      .partial()
      .optional(),
    run: z
      .object({
        mode: z.enum(["scan", "prepare", "debug_send"]).optional(),
        maxPreparedPerRun: z.number().int().positive().optional(),
        maxProfilesReviewedPerQuery: z.number().int().positive().optional(),
        maxQueriesPerRun: z.number().int().positive().optional(),
        delayMsBetweenActions: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).optional(),
        stopOnFirstWarning: z.boolean().optional(),
        resume: z.boolean().optional(),
        queries: z.array(z.string().min(1)).optional()
      })
      .partial()
      .optional(),
    actions: z
      .object({
        clickConnect: z.boolean().optional(),
        stopAtFinalDialog: z.boolean().optional(),
        allowSendWithoutNote: z.boolean().optional(),
        allowSendWithoutNoteOnlyInDebugSendMode: z.boolean().optional(),
        requireOperatorVisibleBrowser: z.boolean().optional()
      })
      .partial()
      .optional(),
    classifier: z
      .object({
        provider: z.enum(["openai", "none"]).optional(),
        apiKey: z.string().min(1).nullable().optional(),
        baseUrl: z.string().url().nullable().optional(),
        model: z.string().min(1).optional(),
        fastMode: z.boolean().optional(),
        temperature: z.number().min(0).max(2).optional(),
        minConfidenceToPrepare: z.number().min(0).max(1).optional(),
        maxTechnicalRiskToPrepare: technicalRiskSchema.optional()
      })
      .partial()
      .optional(),
    filters: z
      .object({
        skipButtonStates: z.array(buttonStateSchema).optional(),
        positiveKeywords: z.array(z.string().min(1)).optional(),
        negativeKeywords: z.array(z.string().min(1)).optional()
      })
      .partial()
      .optional(),
    storage: z
      .object({
        sqlitePath: z.string().min(1).optional(),
        jsonlAuditPath: z.string().min(1).optional(),
        screenshotsDir: z.string().min(1).optional()
      })
      .partial()
      .optional()
  })
  .partial();

export type PartialAppConfig = z.input<typeof partialConfigSchema>;

export const defaultConfig: AppConfig = {
  linkedin: {
    baseUrl: "https://www.linkedin.com",
    useExistingChromeProfile: true,
    chromeUserDataDir: null,
    openStrategy: "playwright-cdp",
    newCandidateContext: "new-window"
  },
  run: {
    mode: "prepare",
    maxPreparedPerRun: 5,
    maxProfilesReviewedPerQuery: 10,
    maxQueriesPerRun: 15,
    delayMsBetweenActions: [1500, 4500],
    stopOnFirstWarning: true,
    resume: true,
    queries: [...defaultQueries]
  },
  actions: {
    clickConnect: true,
    stopAtFinalDialog: true,
    allowSendWithoutNote: false,
    allowSendWithoutNoteOnlyInDebugSendMode: true,
    requireOperatorVisibleBrowser: true
  },
  classifier: {
    provider: "openai",
    apiKey: null,
    baseUrl: null,
    model: "gpt-5.4-mini",
    fastMode: false,
    temperature: 0,
    minConfidenceToPrepare: 0.78,
    maxTechnicalRiskToPrepare: "medium-low"
  },
  filters: {
    skipButtonStates: ["Pending", "Connected", "Message", "Follow"],
    positiveKeywords: [
      "growth",
      "product marketing",
      "pmm",
      "gtm",
      "go-to-market",
      "business operations",
      "bizops",
      "strategy operations",
      "product operations",
      "revops",
      "revenue operations",
      "sales operations",
      "customer success",
      "customer marketing",
      "marketing operations",
      "partnerships",
      "community",
      "content strategist",
      "user researcher",
      "market research",
      "founder associate",
      "chief of staff",
      "operations manager"
    ],
    negativeKeywords: [
      "software engineer",
      "developer",
      "frontend",
      "backend",
      "full-stack",
      "fullstack",
      "ml engineer",
      "machine learning engineer",
      "ai researcher",
      "research scientist",
      "data scientist",
      "data engineer",
      "cto",
      "vp engineering",
      "head of engineering",
      "technical founder",
      "infrastructure",
      "devops",
      "platform engineer",
      "prompt engineer",
      "solutions engineer"
    ]
  },
  storage: {
    sqlitePath: "data/linkedin-corivo-prospecting.sqlite",
    jsonlAuditPath: "data/linkedin-corivo-prospecting.audit.jsonl",
    screenshotsDir: "data/screenshots"
  }
};

export function loadConfigFile(path: string): AppConfig {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return resolveConfigFromEnv(process.env, raw);
}

export function resolveConfig(overrides: unknown = {}): AppConfig {
  const parsed = partialConfigSchema.parse(overrides);
  const config: AppConfig = {
    linkedin: { ...defaultConfig.linkedin, ...parsed.linkedin },
    run: { ...defaultConfig.run, ...parsed.run },
    actions: { ...defaultConfig.actions, ...parsed.actions },
    classifier: { ...defaultConfig.classifier, ...parsed.classifier },
    filters: { ...defaultConfig.filters, ...parsed.filters },
    storage: { ...defaultConfig.storage, ...parsed.storage }
  };

  validateConfig(config);
  return config;
}

export function resolveConfigFromEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, overrides: unknown = {}): AppConfig {
  const envConfig: PartialAppConfig = {
    classifier: {
      apiKey: env.OPENAI_API_KEY || undefined,
      baseUrl: env.OPENAI_BASE_URL || undefined,
      model: env.OPENAI_MODEL || undefined,
      fastMode: parseBooleanEnv(env.OPENAI_FAST_MODE)
    }
  };
  return resolveConfig(mergePartialConfig(envConfig, overrides));
}

export function validateConfig(config: AppConfig): void {
  if (config.run.mode === "debug_send" && !config.actions.clickConnect) {
    throw new Error("debug_send requires actions.clickConnect=true");
  }

  if (
    config.actions.allowSendWithoutNote &&
    config.actions.allowSendWithoutNoteOnlyInDebugSendMode &&
    config.run.mode !== "debug_send"
  ) {
    throw new Error('allowSendWithoutNote=true requires run.mode="debug_send"');
  }

  const [minDelay, maxDelay] = config.run.delayMsBetweenActions;
  if (minDelay > maxDelay) {
    throw new Error("delayMsBetweenActions must be an ascending two-number tuple");
  }
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes|fast)$/i.test(value)) return true;
  if (/^(0|false|no|normal|no-fast)$/i.test(value)) return false;
  throw new Error(`Invalid OPENAI_FAST_MODE value: ${value}`);
}

function mergePartialConfig(base: PartialAppConfig, overrides: unknown): PartialAppConfig {
  const parsed = partialConfigSchema.parse(overrides);
  return {
    linkedin: { ...base.linkedin, ...parsed.linkedin },
    run: { ...base.run, ...parsed.run },
    actions: { ...base.actions, ...parsed.actions },
    classifier: { ...base.classifier, ...parsed.classifier },
    filters: { ...base.filters, ...parsed.filters },
    storage: { ...base.storage, ...parsed.storage }
  };
}
