import { describe, expect, it } from "vitest";

import { hasBotSelfLabel } from "./bot.ts";

describe("hasBotSelfLabel", () => {
  it("detects a bot self-label", () => {
    expect(
      hasBotSelfLabel({
        labels: {
          $type: "com.atproto.label.defs#selfLabels",
          values: [{ val: "bot" }],
        },
      } as never),
    ).toBe(true);
  });

  it("ignores other self-labels", () => {
    expect(
      hasBotSelfLabel({
        labels: { values: [{ val: "porn" }, { val: "nudity" }] },
      } as never),
    ).toBe(false);
  });

  it("handles profiles with no labels", () => {
    expect(hasBotSelfLabel({})).toBe(false);
    expect(hasBotSelfLabel(null)).toBe(false);
    expect(hasBotSelfLabel({ labels: {} } as never)).toBe(false);
  });
});
