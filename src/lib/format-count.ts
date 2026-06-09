/** Fixed locale so SSR and client render the same string (no hydration mismatch). */
const countFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Compact count with a lowercase "k" for thousands (e.g. 12.3k). */
export function formatCount(count: number): string {
  return countFormatter.format(count).replace("K", "k");
}
