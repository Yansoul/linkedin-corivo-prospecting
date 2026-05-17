import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  it("keeps send without note disabled by default", () => {
    const config = resolveConfig();

    expect(config.run.mode).toBe("prepare");
    expect(config.actions.allowSendWithoutNote).toBe(false);
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
});
