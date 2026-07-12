# Product

## Register

product

## Platform

web

## Users

Readers who want a calm, text-first home for long-form writing — and a way to keep
discovering new voices. They arrive to read, not to operate a tool: someone who would
otherwise keep an RSS reader open, but who also wants to find publications they aren't
following yet. Their context is unhurried, often longer reading sessions on desktop (with a
persistent left sidebar) or a quick catch-up on mobile (top bar + bottom tab nav). The same
readers may also use the browser extension (WXT / MV3) to save or follow a publication while
browsing the wider web, then return to Standard Reader to actually read.

The product speaks to one audience — the reader. Authors benefit (their work is discoverable
and stays in their own repo), but they are not the surface's primary user; nothing here is a
publishing or authoring console.

## Product Purpose

Standard Reader is an editorial reader for [standard.site](https://standard.site) publications
distributed over the AT Protocol. A "publication" is a set of signed records in an
author-controlled repository described by a shared lexicon, so the directory of every known
publication is just a query rather than a walled garden. A tap instance backfills the whole
`standard.site` network into a Postgres read-model, which powers feeds, search, trending, and
network-wide recommendations; a reader's personal state (follows, likes, read/unread,
publication lists) is written back to their own repo as records — owned by them, cached by us.

Success is a reader who opens the app to catch up on the writers they follow and reliably
leaves having found at least one new publication worth following — calm to read in, and
trustworthy about whose data is whose.

## Positioning

The directory is just a query: because every publication speaks the same protocol, Standard
Reader can show and rank the entire known network, making discovery of the voices you don't
follow yet a first-class experience rather than a buried tab — without asking authors to trade
ownership for reach.

## Brand Personality

Warm, calm, editorial. The voice is that of a good magazine, not a utility: human and
inviting, quiet and unhurried, letting the writing lead while the interface recedes. Warmth is
carried by typography, rhythm, and the reading experience — not by loud color or decoration.
Confident and text-first; never busy, never shouting for attention or engagement.

## Anti-references

- **Algorithmic social feed** — no engagement-bait, doomscroll mechanics, or dark patterns
  optimizing for time-on-site. Reading is the goal, not retention.
- **Cold SaaS dashboard** — no generic gray-and-blue analytics chrome, hero-metric card
  templates, or console density. This is a place to read, not a control panel.
- **Cluttered RSS reader** — not the busy, utilitarian panels, tiny type, and toolbar-heavy
  density of old Google Reader / Feedly clones.
- **Trendy AI-startup landing** — no gradient-drenched, glassmorphic, eyebrow-tagged
  marketing-site aesthetics.

## Design Principles

- **The reading leads; the UI recedes.** Every screen is judged by whether it makes the writing
  easier to fall into. Chrome, controls, and color earn their place or are removed.
- **Discovery is the product, not a tab.** Surfacing voices the reader doesn't follow yet is the
  core differentiator; treat it as a first-class experience with real editorial care, not an
  afterthought list.
- **Ownership is legible without preaching.** Make it quietly felt that records live in the
  reader's own repo (owned by you, cached by us) — through trustworthy, durable design, not
  slogans.
- **Editorial warmth over utilitarian density.** When a magazine move and a feed-reader move
  both work, take the magazine one. Rhythm and restraint beat cramming.
- **Earned familiarity.** Use standard, accessible affordances (the app is built on react-aria)
  so the tool disappears into the task; save surprise for small, deliberate moments.

## Accessibility & Inclusion

Target WCAG 2.1 AA: AA-level contrast for body and UI text, full keyboard navigation, visible
focus states, and screen-reader-friendly labeling (the vendored hip-ui / react-aria design
system supports this). Honor `prefers-reduced-motion` with a non-animated alternative for every
transition. As a reading product, treat comfortable defaults — legible type size, sane line
length, adequate contrast in both themes — as part of the baseline, not an add-on.
