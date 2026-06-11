import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { LoadMeasurement } from "./measure.ts";

const RESULTS_DIR = path.join(process.cwd(), "perf", "results");

export function writePerfReport(
  measurements: Array<LoadMeasurement>,
  meta: Record<string, string | number | boolean>,
): string {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outfile = path.join(RESULTS_DIR, `load-regression-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    ...meta,
    measurements,
    slowest: [...measurements].toSorted((a, b) => b.ms - a.ms).slice(0, 10),
    failures: measurements.filter((row) => row.overBudget),
  };

  writeFileSync(outfile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const latest = path.join(RESULTS_DIR, "latest.json");
  writeFileSync(latest, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return outfile;
}

export function formatMeasurementLine(row: LoadMeasurement): string {
  const flag = row.overBudget ? "SLOW" : "ok";
  return `[${flag}] ${row.name}: ${row.ms}ms (budget ${row.budgetMs}ms) — ${row.path}`;
}
