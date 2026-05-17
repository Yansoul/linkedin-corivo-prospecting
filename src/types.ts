export const defaultQueries = [
  "growth marketing AI startup",
  "product marketing manager AI startup",
  "business operations SaaS startup",
  "chief of staff AI startup",
  "product operations SaaS",
  "revenue operations AI startup",
  "user researcher AI tools",
  "content strategist AI SaaS",
  "founder associate startup AI",
  "partnerships manager SaaS startup",
  "customer success manager AI startup",
  "GTM manager SaaS AI",
  "marketing operations AI startup",
  "community manager AI startup",
  "customer marketing SaaS AI"
] as const;

export type RunMode = "scan" | "prepare" | "debug_send";
export type ButtonState = "Connect" | "Pending" | "Connected" | "Message" | "Follow" | "Unknown";
export type TechnicalRisk = "low" | "medium-low" | "medium" | "high";
export type RoleCategory =
  | "Growth"
  | "Product Marketing"
  | "Product Operations"
  | "Business Operations"
  | "Strategy Operations"
  | "Chief of Staff"
  | "Founder Associate"
  | "User Research"
  | "Market Research"
  | "Content Strategy"
  | "GTM"
  | "Sales Ops"
  | "RevOps"
  | "Partnerships"
  | "Community"
  | "Customer Success"
  | "Customer Marketing"
  | "Marketing Operations"
  | "Creator Ops"
  | "Operations"
  | "Other";

export interface AppConfig {
  linkedin: {
    baseUrl: string;
    useExistingChromeProfile: boolean;
    chromeUserDataDir: string | null;
    openStrategy: "playwright-cdp" | "playwright-persistent";
    newCandidateContext: "new-window" | "new-tab";
  };
  run: {
    mode: RunMode;
    maxPreparedPerRun: number;
    maxProfilesReviewedPerQuery: number;
    maxQueriesPerRun: number;
    delayMsBetweenActions: [number, number];
    stopOnFirstWarning: boolean;
    resume: boolean;
    queries: string[];
  };
  actions: {
    clickConnect: boolean;
    stopAtFinalDialog: boolean;
    allowSendWithoutNote: boolean;
    allowSendWithoutNoteOnlyInDebugSendMode: boolean;
    requireOperatorVisibleBrowser: boolean;
  };
  classifier: {
    provider: "openai" | "none";
    apiKey: string | null;
    baseUrl: string | null;
    model: string;
    fastMode: boolean;
    temperature: number;
    minConfidenceToPrepare: number;
    maxTechnicalRiskToPrepare: TechnicalRisk;
  };
  filters: {
    skipButtonStates: ButtonState[];
    positiveKeywords: string[];
    negativeKeywords: string[];
  };
  storage: {
    sqlitePath: string;
    jsonlAuditPath: string;
    screenshotsDir: string;
  };
}

export interface SearchResultCard {
  name: string;
  profileUrl: string;
  headline: string | null;
  location: string | null;
  currentCompany: string | null;
  connectionDegree: string | null;
  buttonState: ButtonState;
  rawText: string;
  query: string;
  rank: number;
}

export interface ExperienceItem {
  title: string | null;
  company: string | null;
  dateRange: string | null;
  description: string | null;
}

export interface ProfileContext {
  name: string;
  profileUrl: string;
  headline: string | null;
  location: string | null;
  currentCompany: string | null;
  about: string | null;
  experience: ExperienceItem[];
  skills: string[];
  certifications: string[];
  recentActivity: string[];
  visibleConnectState: ButtonState;
  rawVisibleText: string;
}

export type RuleDecision =
  | "skip_unavailable_action"
  | "skip_obvious_technical"
  | "skip_low_relevance"
  | "needs_profile_review"
  | "likely_qualified";

export interface RuleFilterResult {
  decision: RuleDecision;
  positiveMatches: string[];
  negativeMatches: string[];
  reason: string;
}

export interface ClassifierDecision {
  qualified: boolean;
  shouldPrepareConnection: boolean;
  roleCategory: RoleCategory;
  companyCategory: string;
  technicalRisk: TechnicalRisk;
  icpFitScore: number;
  confidence: number;
  reason: string;
  redFlags: string[];
}

export interface WarningSignal {
  warningType: string;
  pageUrl: string | null;
  visibleText: string;
  matchedKeywords: string[];
}

export interface ActionResult {
  status:
    | "eligible_for_action"
    | "connect_clicked"
    | "final_dialog_open"
    | "prepared_dialog_open"
    | "send_without_note_clicked"
    | "sent_by_debug_config"
    | "action_failed_no_dialog"
    | "action_ambiguous"
    | "action_skipped_by_config";
  pageUrl: string;
  details: Record<string, unknown>;
}

export interface PageLike {
  url(): string;
  locator(selector: string): LocatorLike;
  waitForTimeout(ms: number): Promise<void>;
}

export interface LocatorLike {
  first(): LocatorLike;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  click(): Promise<void>;
}
