import { describe, expect, it } from "vitest";

import { contrastRatio, resolveQuoteOgColors } from "./theme-colors.ts";

describe("resolveQuoteOgColors", () => {
  it("uses publication theme when contrast is sufficient", () => {
    const colors = resolveQuoteOgColors({
      themeBackground: "rgb(20, 20, 30)",
      themeForeground: "rgb(245, 245, 240)",
      themeAccent: "rgb(189, 86, 51)",
      themeAccentForeground: "rgb(255, 255, 255)",
    });

    expect(colors.background).toBe("#14141e");
    expect(colors.foreground).toBe("#f5f5f0");
    expect(colors.accent).toBe("#bd5633");
  });

  it("falls back to high-contrast foreground on low-contrast themes", () => {
    const colors = resolveQuoteOgColors({
      themeBackground: "rgb(255, 255, 255)",
      themeForeground: "rgb(240, 240, 240)",
      themeAccent: null,
      themeAccentForeground: null,
    });

    expect(colors.foreground).toBe("#000000");
    expect(
      contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to defaults when theme is absent", () => {
    const colors = resolveQuoteOgColors({
      themeBackground: null,
      themeForeground: null,
      themeAccent: null,
      themeAccentForeground: null,
    });

    expect(colors.background).toBe("#f9f7f2");
    expect(colors.foreground).toBe("#3e3934");
  });
});
