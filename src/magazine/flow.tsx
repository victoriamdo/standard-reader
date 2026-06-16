import { ArticleContent } from "#/components/reader/content/article-content";
import { forwardRef } from "react";

import type { MagFeature, MagIssue, MagMeta } from "./types";

function Kick({ meta, muted }: { meta: MagMeta; muted?: boolean }) {
  return (
    <div className={`kick ${muted ? "muted" : ""}`}>
      <span>{meta.pubName}</span>
      <span className="sep" />
      <span>{meta.topic}</span>
    </div>
  );
}

function Byline({ meta }: { meta: MagMeta }) {
  return (
    <div className="byline">
      <span className="by">{meta.author}</span>
      {meta.date ? <span className="mono">{meta.date}</span> : null}
      <span className="mono">{meta.minutes} min read</span>
    </div>
  );
}

export function CoverFlow({
  issue,
  onJump,
}: {
  issue: MagIssue;
  onJump: (featureIndex: number) => void;
}) {
  return (
    <>
      <section className="flow-col cover-left">
        <div aria-hidden />
        <h1 className="cover-masthead">{issue.name}</h1>
        <div className="cover-sub">
          {issue.sub}
          {issue.ownerHandle ? ` · @${issue.ownerHandle}` : ""}
          {` · ${issue.features.length} features`}
        </div>
      </section>
      <section className="flow-col cover-right">
        <div className="cover-toc-title">In this issue</div>
        <div className="cover-toc-list">
          {issue.features.map((f, i) => (
            <button
              type="button"
              className="cover-toc-row"
              key={f.meta.id}
              onClick={() => onJump(i)}
            >
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">{f.meta.title}</span>
              <span className="p">{f.meta.pubName}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/** A feature: art-directed opener (image or text) followed by the real body. */
export const FeatureFlow = forwardRef<
  HTMLElement,
  { feature: MagFeature; coverImageUrl: string | null }
>(function FeatureFlow({ feature, coverImageUrl }, ref) {
  const { meta, detail } = feature;
  const hasImage = Boolean(coverImageUrl);

  return (
    <>
      {hasImage ? (
        <section className="flow-col img-page" ref={ref}>
          <img className="img-bg" src={coverImageUrl ?? ""} alt="" />
          <div className="img-caption">
            <span className="dot" />
            <span>{meta.topic}</span>
          </div>
          <div className="img-overlay">
            <Kick meta={meta} />
            <h1 className="headline xl">{meta.title}</h1>
            {meta.dek ? <p className="dek">{meta.dek}</p> : null}
            <Byline meta={meta} />
          </div>
        </section>
      ) : null}

      <div className="feature-body">
        <header
          className="opener"
          ref={hasImage ? undefined : (ref as React.Ref<HTMLDivElement>)}
        >
          {hasImage ? (
            <Kick meta={meta} muted />
          ) : (
            <>
              <Kick meta={meta} />
              <h1 className="headline lg">{meta.title}</h1>
              {meta.dek ? <p className="dek">{meta.dek}</p> : null}
            </>
          )}
          <Byline meta={meta} />
          <hr className="opener-rule" />
        </header>
        <ArticleContent article={detail} hasHero />
      </div>
    </>
  );
});

export function EndCardFlow({ issue }: { issue: MagIssue }) {
  return (
    <section className="flow-col endcard">
      <div className="kick">
        <span>{issue.name}</span>
        <span className="sep" />
        <span>Colophon</span>
      </div>
      <h1 className="headline md">The End.</h1>
      <div className="colophon">
        {issue.name} · {issue.no}
        <br />
        {issue.features.length} features
        {issue.ownerHandle ? ` · edited by @${issue.ownerHandle}` : ""}
        <br />
        {issue.sub}
      </div>
    </section>
  );
}
