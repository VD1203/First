# Meridian — AI wealth manager landing page

A single-page marketing site for a fictional AI wealth-management product, built
as plain HTML + ES modules. The product UI in the hero is live DOM, the scrubbed
"how it works" sequence is drawn on a canvas frame by frame, and the globe is
real Three.js points — there are no screenshots, videos or frame sequences
anywhere on the page.

```bash
cd threejs-hero && python3 -m http.server 8000
```

ES modules and the import map need `http://`, not `file://`.

## Layout

```
threejs-hero/
├── index.html              all markup
├── css/site.css            the whole design system
├── js/
│   ├── main.js             page choreography — Lenis, ScrollTrigger, reveals
│   ├── console.js          the hero product screen and its state machine
│   ├── sequence.js         the pinned scroll-scrubbed canvas renderer
│   ├── reveal.js           the cursor-spotlight reveal
│   └── globe.js            the particle globe (lazy, Three.js)
├── assets/exposure-map.svg the one image the reveal uses, twice
├── vendor/                 gsap, ScrollTrigger, lenis, three (committed)
└── legacy/hero.js          the earlier rotating-object hero study, unused here
```

Dependencies are installed with npm (`gsap`, `lenis`, `three`) and the four files
the page actually loads are copied into `vendor/`, so the page runs with no CDN
and no build step. `node_modules/` is gitignored; re-fetch with `npm i` and
re-copy if you upgrade.

## The design system

Editorial-tech: asymmetric grids, hairline rules, mono utility labels, one
restrained accent (`--accent: #2B49DE`). The product's own semantic colours
(`--pos`, `--neg`, `--warn`) are deliberately *not* the accent, so a green number
never reads as a UI state and the accent stays reserved for selection, progress
and approval.

Two shells: a warm paper light shell and a `.dark` night shell used by the
coverage, globe and CTA sections. Type is Inter + Instrument Serif (one italic
accent word per headline) + JetBrains Mono for labels, with system fallbacks if
the font request fails.

## The hero product screen — `js/console.js`

The proof is the interface, so it is real DOM rather than an image:

- Seven sleeves rendered from a data table, each with target, current, drift, a
  tolerance-band bar and an action tag.
- Click or arrow-key a row to change the selection; the rationale panel rewrites
  with that sleeve's mandate clause, lot selection and tax numbers.
- **Edit** opens a trade-size input. Changing it re-derives the order value, the
  post-trade weights, the panel's cash figures and the footer totals — the
  numbers stay internally consistent at any size.
- **Approve** / **Reject** move the state machine (`draft → editing → approved |
  rejected`), swap the table to the post-trade book and lock the controls.
  **Reset workflow** returns everything to draft.

Focus is preserved across re-renders, and the panel is `aria-live` so a screen
reader hears the rationale change.

Every figure is synthetic. The console carries a `Sample workflow · synthetic
data` chip, and the proof section carries a written disclosure.

## The scrubbed sequence — `js/sequence.js`

A canvas renderer driven by one normalised progress value, so the same scroll
position always reproduces the same frame in both directions.

`draw(p)` is a pure function of progress. Four acts share one composition rather
than cutting between scenes:

| range | act | what moves |
|---|---|---|
| 0.00–0.22 | Read | custody accounts land, drift bars grow from zero |
| 0.22–0.46 | Measure | tolerance bands fade in, breached sleeves turn amber |
| 0.46–0.74 | Draft | correction arrows, order tickets, the lot ladder |
| 0.74–1.00 | Approve | bars settle to post-trade, tickets stamp, ledger line |

Below ~820px the right-hand ticket panel becomes a two-column strip under the
rows. Device pixel ratio is capped at 2, and renders are coalesced into one
animation frame.

The same four states also exist as an ordered `<ol>` below the stage, which is
what a screen reader, a no-JS visitor and a reduced-motion visitor read.

## The reveal — `js/reveal.js` + `assets/exposure-map.svg`

One SVG, used twice. The base copy is CSS-filtered to greyscale; the second copy
sits on top at full colour behind a feathered radial `mask-image` that follows an
eased pointer. Position eases at `0.1`, radius at `0.14`, and the loop stops as
soon as both settle.

Coarse pointers never get a hover-only affordance: the mask is dropped and a
**Show performance** button toggles the colour layer instead.

## The globe — `js/globe.js`

A dense spherical point cloud plus a thinner tilted orbital ring, drawn with an
additive `ShaderMaterial`. Decorative — there is no dataset behind it.

`gl_PointSize` is in drawing-buffer pixels, so it is multiplied by the renderer's
pixel ratio on every resize; without that the globe dissolves into a faint
starfield on retina displays. Particle counts drop below 760px. The module is
dynamically imported only when the section is within 300px of the viewport, and
it pauses when offscreen or when the tab is hidden.

## Choreography

There is exactly one pinned scene. The rule the page follows is that the pinned
sequence and the sticky card stack must never hold the viewport at the same time:

```
hero → ticker → [PINNED sequence, +270vh] → text list → coverage (dark)
     → [STICKY card stack] → globe (dark) → proof → CTA → footer
```

The coverage section sits between them, so the pin is fully released before the
first card sticks.

## Mobile and reduced motion

- Below 1025px the stack cards lay out in normal flow. A sticky element taller
  than its scroll window hides its own bottom, so the effect is dropped rather
  than broken, and the GSAP triggers are gated behind `gsap.matchMedia()`.
- Below 1024px the console drops its nav rail; below 760px it becomes a single
  column and the table sheds its target and current columns.
- With `prefers-reduced-motion: reduce`: no preloader, no Lenis, no pin, no
  scrub, no marquee, no stack transforms. The sequence unpins, sizes to a 16:9
  box and renders the settled final frame; counters jump to their value.
- With JavaScript off the page is fully readable — only the canvas stage is
  hidden, and the text list of the four states takes its place.

## Content note

Meridian is not a real product. Every household, holding, price, quotation,
metric and outcome on the page is synthetic sample data standing in for real
measurements.
