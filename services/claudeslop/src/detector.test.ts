import { afterEach, describe, expect, it, vi } from "vitest";

import { score } from "./detector.ts";

// The detector is now a thin HTTP client over the detector sidecar (see
// detector/). These tests mock `fetch` to exercise the client's
// mapping logic — thresholds, the short-text shortcut, and the `scored: false`
// (non-English / too short) path — without needing the model running.

afterEach(() => {
  vi.restoreAllMocks();
});

function mockScore(body: {
  score: number;
  language?: string;
  scored?: boolean;
  wordCount?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        score: body.score,
        language: body.language ?? "en",
        scored: body.scored ?? true,
        wordCount: body.wordCount ?? 200,
      }),
    ),
  );
}

const LONG = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");

describe("score", () => {
  it("classifies a high service score as likely AI", async () => {
    mockScore({ score: 0.97 });
    const result = await score(LONG);
    expect(result.classification).toBe("likely-ai");
    expect(result.score).toBeCloseTo(0.97);
    expect(result.scored).toBe(true);
  });

  it("classifies a low service score as human", async () => {
    mockScore({ score: 0.04 });
    const result = await score(LONG);
    expect(result.classification).toBe("human");
  });

  it("does not call the service for short text", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await score("Too short to tell.");
    expect(result.score).toBe(0);
    expect(result.scored).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats an unscored (e.g. non-English) response as human/neutral", async () => {
    mockScore({ score: 0, language: "de", scored: false });
    const result = await score(LONG);
    expect(result.score).toBe(0);
    expect(result.classification).toBe("human");
    expect(result.scored).toBe(false);
  });
});
