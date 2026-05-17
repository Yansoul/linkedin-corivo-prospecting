import { describe, expect, it } from "vitest";
import { resolveConfig, resolveConfigFromEnv } from "../src/config.js";

describe("resolveConfig", () => {
  it("sends without a note by default with explicit operator permission", () => {
    const config = resolveConfig();

    expect(config.run.mode).toBe("debug_send");
    expect(config.linkedin.openStrategy).toBe("playwright-persistent");
    expect(config.actions.allowSendWithoutNote).toBe(true);
    expect(config.actions.stopAtFinalDialog).toBe(true);
  });

  it("rejects allowSendWithoutNote outside debug_send mode", () => {
    expect(() =>
      resolveConfig({
        run: { mode: "prepare" },
        actions: { allowSendWithoutNote: true }
      })
    ).toThrow(/allowSendWithoutNote=true requires run\.mode="debug_send"/);
  });

  it("rejects debug_send when connect clicks are disabled", () => {
    expect(() =>
      resolveConfig({
        run: { mode: "debug_send" },
        actions: { clickConnect: false }
      })
    ).toThrow(/debug_send requires actions\.clickConnect=true/);
  });

  it("requires a two-number delay tuple", () => {
    expect(() =>
      resolveConfig({
        run: { delayMsBetweenActions: [1000] as unknown as [number, number] }
      })
    ).toThrow(/delayMsBetweenActions/);
  });

  it("loads OpenAI API settings from environment variables", () => {
    const config = resolveConfigFromEnv({
      OPENAI_API_KEY: "env-key",
      OPENAI_BASE_URL: "https://api.example.com/v1",
      OPENAI_MODEL: "gpt-5.4-mini",
      OPENAI_FAST_MODE: "true"
    });

    expect(config.classifier.apiKey).toBe("env-key");
    expect(config.classifier.baseUrl).toBe("https://api.example.com/v1");
    expect(config.classifier.model).toBe("gpt-5.4-mini");
    expect(config.classifier.fastMode).toBe(true);
  });

  it("lets explicit config override environment variables", () => {
    const config = resolveConfigFromEnv(
      {
        OPENAI_API_KEY: "env-key",
        OPENAI_BASE_URL: "https://api.example.com/v1",
        OPENAI_MODEL: "env-model",
        OPENAI_FAST_MODE: "true"
      },
      {
        classifier: {
          apiKey: "json-key",
          baseUrl: "https://custom.example.com/v1",
          model: "json-model",
          fastMode: false
        }
      }
    );

    expect(config.classifier.apiKey).toBe("json-key");
    expect(config.classifier.baseUrl).toBe("https://custom.example.com/v1");
    expect(config.classifier.model).toBe("json-model");
    expect(config.classifier.fastMode).toBe(false);
  });
});
