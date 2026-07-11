/**
 * WeeklyDigestEmail — the Standard Digest weekly reading email.
 *
 * Built with React Email (@react-email/components). Renders to
 * email-client-safe, table-based HTML with inline styles. Single column,
 * ~600px, mobile-first, light + dark aware. All images use absolute URLs with
 * alt text.
 *
 * Render:  import { render } from '@react-email/render';
 *          const html = await render(<WeeklyDigestEmail {...props} />);
 *
 * Colors + fonts mirror the reader's editorial theme
 * (src/components/reader/theme.ts): warm paper + warm ink, muted terracotta
 * accent; Newsreader (serif/display), Atkinson Hyperlegible Next (sans/UI),
 * Spline Sans Mono (mono, counts/dates only). Email can't use the theme's
 * oklch/StyleX tokens, so the light values are inlined in the `c` palette below
 * and the dark values live in the `<style>` block, applied via the `d-*`
 * classes on each element (light + dark are the single place to retune).
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface DigestArticle {
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  authorDisplayName: string | null;
  authorHandle: string | null;
  publicationName: string | null;
  publicationIconUrl: string | null;
  recommendCount: number;
  url: string;
}

interface DigestPublication {
  name: string;
  iconUrl: string | null;
  description: string | null;
  subscriberCount: number;
  url: string;
}

interface DigestEmailProps {
  weekLabel: string; // e.g. "Jul 3–10, 2026"
  articles: Array<DigestArticle>;
  recommendations: Array<DigestPublication>;
  unsubscribeUrl: string;
  logoUrl: string;
}

/* ------------------------------------------------------------------ */
/* Light palette (theme.ts, converted to hex — oklch is unsafe here). */
/* Dark values live in the <style> block, keyed to each element's d-* */
/* class.                                                             */
/* ------------------------------------------------------------------ */

const c = {
  page: "#f2ece1", // warm paper (outer background)
  card: "#fefdfc", // near-white warm (card surface) — primary.bg
  ink: "#3e332e", // primary.text2 — dark warm ink
  inkSoft: "#726b64", // ui.text1 — warm-gray secondary text
  muted: "#9a928a", // lighter warm gray — meta/counts/dates
  faint: "#b3aca2", // faint footer text
  line: "#e4ddd1", // warm hairline / card border
  accent: "#ad7f58", // primary.solid1 — solid accent
  accentInk: "#8a5f43", // accent text / links on paper
  solid2: "#a07553", // primary.solid2 — "Digest" wordmark accent
  white: "#ffffff",
};

const serif = "'Newsreader', Georgia, 'Times New Roman', serif";
const sans =
  "'Atkinson Hyperlegible Next', system-ui, -apple-system, Helvetica, Arial, sans-serif";
const mono = "'Spline Sans Mono', 'SFMono-Regular', Menlo, monospace";

// Deterministic warm/cool tone for a monogram fallback tile.
const MONO_COLORS = [
  "#c1603f",
  "#8a5170",
  "#4a4a55",
  "#3d7f8a",
  "#6f8348",
  "#b58a3e",
  "#a8455a",
  "#50525e",
];
function monoTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + (seed.codePointAt(i) ?? 0)) % 2_147_483_647;
  }
  return MONO_COLORS[h % MONO_COLORS.length];
}
function initials(name: string | null): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  const first = parts[0].charAt(0);
  const last = parts.at(-1)?.charAt(0) ?? "";
  return (first + last).toUpperCase();
}
function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

/** Rounded-square publication icon. Uses the real icon image when present, else
 *  a colored initials tile (works everywhere, incl. Outlook). */
function PubIcon({
  name,
  iconUrl,
  size,
}: {
  name: string | null;
  iconUrl: string | null;
  size: number;
}) {
  const fontSize = Math.round(size * 0.42);
  const radius = `${Math.round(size * 0.22)}px`;
  if (iconUrl) {
    return (
      <Img
        src={iconUrl}
        width={size}
        height={size}
        alt={name ? `${name} icon` : "Publication icon"}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          display: "block",
        }}
      />
    );
  }
  return (
    <table
      role="presentation"
      width={String(size)}
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{
        width: size,
        height: size,
        background: monoTone(name || "x"),
        borderRadius: radius,
      }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              height: size,
              fontFamily: serif,
              fontWeight: 600,
              fontSize,
              color: c.white,
            }}
          >
            {initials(name)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="d-muted"
      style={{
        fontFamily: sans,
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: c.muted,
        margin: "0",
      }}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Article card                                                       */
/* ------------------------------------------------------------------ */

function ArticleCard({
  article,
  lead,
}: {
  article: DigestArticle;
  lead?: boolean;
}) {
  const titleSize = lead ? "25px" : "20px";
  return (
    <Section
      className="d-card"
      style={{
        background: c.card,
        border: `1px solid ${c.line}`,
        borderRadius: "6px",
        margin: "12px 0 0",
        overflow: "hidden",
      }}
    >
      {article.coverImageUrl && (
        <Link href={article.url} style={{ textDecoration: "none" }}>
          <Img
            src={article.coverImageUrl}
            alt={article.title}
            width="100%"
            style={{
              width: "100%",
              borderRadius: "6px 6px 0 0",
              display: "block",
            }}
          />
        </Link>
      )}

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={{ padding: lead ? "22px 24px 24px" : "20px 24px 22px" }}>
              {/* meta: publication + recommend count */}
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                border={0}
              >
                <tbody>
                  <tr>
                    <td align="left" style={{ verticalAlign: "middle" }}>
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                      >
                        <tbody>
                          <tr>
                            <td style={{ verticalAlign: "middle" }}>
                              <PubIcon
                                name={article.publicationName}
                                iconUrl={article.publicationIconUrl}
                                size={26}
                              />
                            </td>
                            <td
                              style={{
                                verticalAlign: "middle",
                                paddingLeft: "9px",
                              }}
                            >
                              <span
                                className="d-soft"
                                style={{
                                  fontFamily: serif,
                                  fontSize: "14px",
                                  color: c.inkSoft,
                                }}
                              >
                                {article.publicationName || "A publication"}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td align="right" style={{ verticalAlign: "middle" }}>
                      <span
                        className="d-muted"
                        style={{
                          fontFamily: mono,
                          fontSize: "12px",
                          color: c.muted,
                        }}
                      >
                        ★&nbsp;{fmtCount(article.recommendCount)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* title */}
              <Link
                href={article.url}
                className="d-ink"
                style={{
                  display: "block",
                  fontFamily: serif,
                  fontWeight: 500,
                  fontSize: titleSize,
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  color: c.ink,
                  padding: "13px 0 0",
                }}
              >
                {article.title}
              </Link>

              {/* excerpt */}
              {article.description && (
                <Text
                  className="d-soft"
                  style={{
                    fontFamily: serif,
                    fontSize: lead ? "16px" : "15px",
                    lineHeight: 1.5,
                    color: c.inkSoft,
                    margin: "8px 0 0",
                  }}
                >
                  {article.description}
                </Text>
              )}

              {/* byline + CTA */}
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={{ marginTop: "15px" }}
              >
                <tbody>
                  <tr>
                    <td align="left" style={{ verticalAlign: "middle" }}>
                      <span
                        className="d-muted"
                        style={{
                          fontFamily: sans,
                          fontSize: "12.5px",
                          color: c.muted,
                        }}
                      >
                        {article.authorDisplayName
                          ? `By ${article.authorDisplayName}`
                          : "Anonymous"}
                        {article.authorHandle
                          ? ` · ${article.authorHandle}`
                          : ""}
                      </span>
                    </td>
                    <td align="right" style={{ verticalAlign: "middle" }}>
                      <Link
                        href={article.url}
                        className="d-accent"
                        style={{
                          fontFamily: sans,
                          fontWeight: 700,
                          fontSize: "13px",
                          color: c.accentInk,
                        }}
                      >
                        Read →
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Recommendation card                                                */
/* ------------------------------------------------------------------ */

function RecommendationCard({ pub }: { pub: DigestPublication }) {
  return (
    <Section
      className="d-card"
      style={{
        background: c.card,
        border: `1px solid ${c.line}`,
        borderRadius: "6px",
        margin: "12px 0 0",
      }}
    >
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={{ padding: "18px 22px" }}>
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                border={0}
              >
                <tbody>
                  <tr>
                    <td
                      width={46}
                      style={{ verticalAlign: "top", width: "46px" }}
                    >
                      <PubIcon
                        name={pub.name}
                        iconUrl={pub.iconUrl}
                        size={42}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", paddingLeft: "14px" }}>
                      <Text
                        className="d-ink"
                        style={{
                          fontFamily: serif,
                          fontWeight: 600,
                          fontSize: "18px",
                          letterSpacing: "-0.01em",
                          color: c.ink,
                          margin: 0,
                        }}
                      >
                        {pub.name}
                      </Text>
                      {pub.description && (
                        <Text
                          className="d-soft"
                          style={{
                            fontFamily: serif,
                            fontSize: "14.5px",
                            lineHeight: 1.45,
                            color: c.inkSoft,
                            margin: "3px 0 0",
                          }}
                        >
                          {pub.description}
                        </Text>
                      )}
                      <table
                        role="presentation"
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        style={{ marginTop: "11px" }}
                      >
                        <tbody>
                          <tr>
                            <td
                              align="left"
                              style={{ verticalAlign: "middle" }}
                            >
                              <span
                                className="d-muted"
                                style={{
                                  fontFamily: mono,
                                  fontSize: "11.5px",
                                  color: c.muted,
                                }}
                              >
                                {fmtCount(pub.subscriberCount)} readers
                              </span>
                            </td>
                            <td
                              align="right"
                              style={{ verticalAlign: "middle" }}
                            >
                              <Link
                                href={pub.url}
                                className="d-accent"
                                style={{
                                  fontFamily: sans,
                                  fontWeight: 700,
                                  fontSize: "12.5px",
                                  color: c.accentInk,
                                }}
                              >
                                Discover →
                              </Link>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Email                                                              */
/* ------------------------------------------------------------------ */

export default function WeeklyDigestEmail({
  weekLabel,
  articles,
  recommendations,
  unsubscribeUrl,
  logoUrl,
}: DigestEmailProps) {
  const px = { paddingLeft: "34px", paddingRight: "34px" };

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap');

          /* Dark mode — theme.ts editorial dark values. Each rule targets the
             property the element actually uses (Hr colors via border-color). */
          @media (prefers-color-scheme: dark) {
            .d-bg      { background:#17120e !important; }
            .d-card    { background:#27201c !important; border-color:#443a30 !important; }
            .d-ink     { color:#f2e1ca !important; }
            .d-soft    { color:#a49b90 !important; }
            .d-muted   { color:#8b8279 !important; }
            .d-accent  { color:#dbb594 !important; }
            .d-accent2 { color:#b88c67 !important; }
            .d-divider { border-color:#443a30 !important; }
            .d-rule    { border-color:#f2e1ca !important; }
          }
          /* Outlook.com dark mode */
          [data-ogsc] .d-bg      { background:#17120e !important; }
          [data-ogsc] .d-card    { background:#27201c !important; border-color:#443a30 !important; }
          [data-ogsc] .d-ink     { color:#f2e1ca !important; }
          [data-ogsc] .d-soft    { color:#a49b90 !important; }
          [data-ogsc] .d-muted   { color:#8b8279 !important; }
          [data-ogsc] .d-accent  { color:#dbb594 !important; }
          [data-ogsc] .d-accent2 { color:#b88c67 !important; }
          [data-ogsc] .d-divider { border-color:#443a30 !important; }
          [data-ogsc] .d-rule    { border-color:#f2e1ca !important; }

          @media only screen and (max-width:620px) {
            .container { width:100% !important; }
            .lead-title { font-size:26px !important; }
          }
        `}</style>
      </Head>
      <Preview>The best of what you follow this week.</Preview>

      <Body
        className="d-bg"
        style={{ margin: 0, padding: 0, background: c.page }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          className="d-bg"
          style={{ background: c.page }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "28px 12px 40px" }}>
                <Container
                  className="container"
                  style={{ width: "600px", maxWidth: "600px" }}
                >
                  {/* ---- Header ---- */}
                  <Section style={{ padding: "4px 34px 0" }}>
                    <table
                      role="presentation"
                      width="100%"
                      cellPadding={0}
                      cellSpacing={0}
                      border={0}
                    >
                      <tbody>
                        <tr>
                          <td align="left" style={{ verticalAlign: "middle" }}>
                            <table
                              role="presentation"
                              cellPadding={0}
                              cellSpacing={0}
                              border={0}
                            >
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: "middle" }}>
                                    <Img
                                      src={logoUrl}
                                      width={34}
                                      height={34}
                                      alt="Standard Digest"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: "8px",
                                        display: "block",
                                      }}
                                    />
                                  </td>
                                  <td
                                    style={{
                                      verticalAlign: "middle",
                                      paddingLeft: "11px",
                                    }}
                                  >
                                    <span
                                      className="d-ink"
                                      style={{
                                        fontFamily: serif,
                                        fontWeight: 500,
                                        fontSize: "23px",
                                        letterSpacing: "-0.02em",
                                        color: c.ink,
                                      }}
                                    >
                                      Standard{" "}
                                      <span
                                        className="d-accent2"
                                        style={{ color: c.solid2 }}
                                      >
                                        Digest
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                          <td align="right" style={{ verticalAlign: "middle" }}>
                            <span
                              className="d-muted"
                              style={{
                                fontFamily: mono,
                                fontSize: "11px",
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: c.muted,
                              }}
                            >
                              {weekLabel}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  {/* ---- Header rule ---- */}
                  <Section style={{ padding: "18px 34px 0" }}>
                    <Hr
                      className="d-rule"
                      style={{
                        borderColor: c.ink,
                        borderWidth: "1px 0 0",
                        margin: 0,
                        height: 0,
                      }}
                    />
                  </Section>

                  {/* ---- Best of your follows ---- */}
                  <Section style={{ ...px, paddingTop: "22px" }}>
                    <SectionLabel>Best of your follows</SectionLabel>
                  </Section>
                  <Section style={px}>
                    {articles.map((a, i) => (
                      <ArticleCard key={a.url + i} article={a} lead={i === 0} />
                    ))}
                  </Section>

                  {/* ---- Publications to explore ---- */}
                  {recommendations.length > 0 && (
                    <>
                      <Section style={{ ...px, paddingTop: "30px" }}>
                        <Hr
                          className="d-divider"
                          style={{
                            borderColor: c.line,
                            borderWidth: "1px 0 0",
                            margin: "0 0 20px",
                            height: 0,
                          }}
                        />
                        <SectionLabel>Publications to explore</SectionLabel>
                      </Section>
                      <Section style={px}>
                        {recommendations.map((p, i) => (
                          <RecommendationCard key={p.url + i} pub={p} />
                        ))}
                      </Section>
                    </>
                  )}

                  {/* ---- Footer ---- */}
                  <Section style={{ padding: "36px 34px 8px" }}>
                    <Hr
                      className="d-rule"
                      style={{
                        borderColor: c.ink,
                        borderWidth: "1px 0 0",
                        margin: 0,
                        height: 0,
                      }}
                    />
                  </Section>
                  <Section
                    style={{ padding: "20px 34px 4px", textAlign: "center" }}
                  >
                    <table
                      role="presentation"
                      cellPadding={0}
                      cellSpacing={0}
                      border={0}
                      align="center"
                    >
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: "middle" }}>
                            <Img
                              src={logoUrl}
                              width={22}
                              height={22}
                              alt="Standard Digest"
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "5px",
                                display: "block",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              verticalAlign: "middle",
                              paddingLeft: "9px",
                            }}
                          >
                            <span
                              className="d-ink"
                              style={{
                                fontFamily: serif,
                                fontWeight: 500,
                                fontSize: "16px",
                                letterSpacing: "-0.01em",
                                color: c.ink,
                              }}
                            >
                              Standard Digest
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>
                  <Section
                    style={{ padding: "14px 40px 4px", textAlign: "center" }}
                  >
                    <Link
                      href={unsubscribeUrl}
                      className="d-soft"
                      style={{
                        fontFamily: sans,
                        fontWeight: 600,
                        fontSize: "12.5px",
                        color: c.inkSoft,
                      }}
                    >
                      Unsubscribe
                    </Link>
                  </Section>
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

export type { DigestArticle, DigestPublication, DigestEmailProps };
