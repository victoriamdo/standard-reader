import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Minimal markdown for magazine editorial intros and per-piece notes. Renders
 * plain HTML elements that inherit the magazine surface (`--serif`, `--ink`, …)
 * via `magazine.css`, avoiding the heavier article-body renderer and its
 * reading-typography context.
 */
export function MagMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
