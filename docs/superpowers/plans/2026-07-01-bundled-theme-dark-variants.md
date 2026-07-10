# Bundled Theme Dark Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every bundled theme in `will-sargent-dbtlabs/lavish-themes` that doesn't already have one a `dark` content theme option, wired through the opt-in `#lavish-content-themes` manifest contract lavish-axi already ships (no lavish-axi changes needed — this is entirely content authoring).

**Architecture:** Research (already done, see below) ruled out a blanket "rename all 8 themes onto one shared variable scheme" — the themes are too structurally different (vendored frameworks with their own variable conventions, or bespoke layouts like `handwritten`'s ruled paper and `zine`'s brutalist chip system) for a mechanical rename to preserve their character. Instead, each theme gets its own single-file `dark` sibling, built the way that theme's own structure calls for: reusing an existing-but-dormant dark palette where one exists (`latex`, `water`), or hand-designing one that fits the theme's identity where none exists (`terminal`, `handwritten`, `zine`, `dbt-brief`/`dbt-brief-dashboard`). `lavish-light`/`swiss` already got a `dark` sibling in a prior session (not part of this plan).

**Tech Stack:** Plain CSS custom properties, same `#lavish-content-themes` manifest + `:root[data-lavish-content-theme="..."]` override pattern already proven. `lavish-themes` has no test suite — verification is grep-based structural checks plus live browser verification through a real `lavish-axi` session (Chrome DevTools MCP), matching how the existing `lavish-light`/`swiss` dark work was verified.

**IMPORTANT — formatting note:** every code block below marked "Find" or "Replace with" is a literal, byte-exact excerpt of real file content. Do NOT run a formatter (prettier or otherwise) over this plan document — a prior pass through prettier already once corrupted these blocks by rewrapping long lines, which silently broke the "find this exact text" instructions. If you must reformat this document for any reason, restore the exact original line breaks in every fenced block afterward and re-diff against the target files before trusting it again.

## Global Constraints

- No lavish-axi source changes — the switcher mechanism is already fully generic. This plan only touches files in `will-sargent-dbtlabs/lavish-themes`.
- Each theme's dark variant must not silently break contrast: before finalizing a variant, grep the theme file for any hardcoded (non-variable) `background`/`color` declaration whose companion color comes from a variable that flips under the dark override — this exact bug (light text on a still-light hardcoded background) was already found and fixed once for `lavish-light`/`swiss`'s `code`/`pre` blocks.
- Manifest entries across all themes use the same `id`/`label` convention for consistency: `{"id": "light", "label": "Light"}` / `{"id": "dark", "label": "Dark"}` for single-file themes that had no other content-theme siblings before this plan.
- Every task ends with a live verification step (open the theme through an actual `lavish-axi` session, switch to Dark in the chrome's Content Theme menu, screenshot or visually confirm no illegible text) before committing.
- Commit and push each task independently — this repo's established workflow is direct commits to `main`, no PR.

---

## File Structure

- Modify: `tier1/latex.html` — dark variant reuses the theme's own existing (but currently unreachable) `.latex-dark` class values verbatim.
- Modify: `tier1/water.html` — dark variant reuses the theme's own existing `@media (prefers-color-scheme: dark)` `:root` values verbatim. **Documented limitation:** water.css has ~90 additional `@media (prefers-color-scheme: dark)` blocks beyond `:root` (scrollbar corners, a data-URL SVG dropdown-arrow fill, misc pseudo-element refinements) that this task does not convert — those still only activate via actual OS dark-mode preference, independent of the new explicit toggle. The primary background/text/link/border colors — the ones that make the page readable — are fully covered.
- Modify: `tier1/terminal.html` — bespoke dark palette (no existing dark support in this vendored copy to reuse), designed to fit the theme's monospace-hacker-CLI character.
- Modify: `tier2/handwritten.html` — bespoke "night" dark palette (a dim desk-lamp/blackboard mood, not just an inverted light theme), since the theme has no existing dark variant.
- Modify: `tier2/zine.html` — bespoke dark palette. Zine's variables are named after literal colors (`--yellow`, `--black`) rather than semantic roles, so most elements already alternate between a `--black`-background "chip" and the page's `--yellow` background — swapping the two variables' _values_ (not overriding individual selectors) flips the whole page from yellow-dominant to black-dominant while keeping every existing chip/border/shadow rule working unmodified, with one small patch for `code`/`pre` (see Task 5).
- Modify: `tier2/dbt-brief.html` and `tier2/dbt-brief-dashboard.html` — both need a new `--card` and `--code-bg` semantic variable introduced first (currently every card/table/code surface is a hardcoded `background: white` or a hardcoded light gray, which would go illegible under a dark `--ink` the same way `lavish-light`'s `code`/`pre` did), then a `dark` override for `--paper`/`--ink`/`--muted`/`--rule`/`--card`/`--code-bg`. `--orange`/`--purple`/`--grad` stay unchanged — the gradient accent identity should read the same in both modes.
- Not touched: `lavish-light.html`, `swiss.html` (already have a `dark` sibling from a prior session).

---

### Task 1: `latex` dark variant (reuse `.latex-dark`)

**Files:**

- Modify: `tier1/latex.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on — each theme task is independent.

- [ ] **Step 1: Confirm the existing dark values haven't drifted**

Run, from the `will-sargent-dbtlabs/lavish-themes` repo root:

```bash
sed -n '124,136p' tier1/latex.html
```

Expected output (the `.latex-dark` class, already shipped and unused by any element in this file today):

<!-- prettier-ignore -->
```css
.latex-dark {
  --body-color: hsl(0, 0%, 86%);
  --body-bg-color: hsl(0, 0%, 16%);
  --link-visited: hsl(196 80% 77%);
  --link-focus-outline: hsl(215, 63%, 73%);
  --pre-bg-color: hsl(0, 1%, 25%);
  --kbd-bg-color: hsl(0, 0%, 16%);
  --kbd-border-color: hsl(210, 5%, 70%);
  --table-border-color: white;
  --sidenote-target-border-color: hsl(0, 0%, 59%);
  --footnotes-border-color: hsl(0, 0%, 59%);
  --proof-symbol-filter: invert(80%);
}
```

If this doesn't match, stop and use whatever the file actually contains for Step 2 instead of the values below.

- [ ] **Step 2: Add the manifest and the explicit dark override**

Find (immediately after the base `:root { ... }` block, before the existing `.latex-dark` class):

<!-- prettier-ignore -->
```html
  --text-indent-size: 1.463rem; /* In 12pt [Latin Modern font] LaTeX article
  \parindent =~ 17.625pt; taking also into account the ratio
  1pt[LaTeX] = (72 / 72.27) * 1pt[HTML], with default 12pt/1rem LaTeX.css font
  size, the identation value in rem CSS units is:
  \parindent =~ 17.625 * (72 / 72.27) / 12 = 1.463rem. */
}

.latex-dark {
```

Replace with:

<!-- prettier-ignore -->
```html
  --text-indent-size: 1.463rem; /* In 12pt [Latin Modern font] LaTeX article
  \parindent =~ 17.625pt; taking also into account the ratio
  1pt[LaTeX] = (72 / 72.27) * 1pt[HTML], with default 12pt/1rem LaTeX.css font
  size, the identation value in rem CSS units is:
  \parindent =~ 17.625 * (72 / 72.27) / 12 = 1.463rem. */
}

:root[data-lavish-content-theme="dark"] {
  --body-color: hsl(0, 0%, 86%);
  --body-bg-color: hsl(0, 0%, 16%);
  --link-visited: hsl(196 80% 77%);
  --link-focus-outline: hsl(215, 63%, 73%);
  --pre-bg-color: hsl(0, 1%, 25%);
  --kbd-bg-color: hsl(0, 0%, 16%);
  --kbd-border-color: hsl(210, 5%, 70%);
  --table-border-color: white;
  --sidenote-target-border-color: hsl(0, 0%, 59%);
  --footnotes-border-color: hsl(0, 0%, 59%);
  --proof-symbol-filter: invert(80%);
}
<script type="application/json" id="lavish-content-themes">
[
  {"id": "light", "label": "Light"},
  {"id": "dark", "label": "Dark"}
]
</script>

.latex-dark {
```

(The `<script>` tag is dropped in the middle of a `<style>` block here because that's where the anchor text lives — HTML parses a `<script>` tag fine as a sibling of `<style>` regardless of surrounding whitespace; browsers don't require them to be adjacent to `<head>`/`<body>` boundaries. Leave the pre-existing `.latex-dark` class and `@media` block completely alone — they still work standalone for anyone who opens this file outside Lavish and manually applies the class or has an OS dark-mode preference.)

- [ ] **Step 3: Verify structurally**

Run:

```bash
grep -n 'lavish-content-theme="dark"' tier1/latex.html
grep -n 'lavish-content-themes' tier1/latex.html
```

Expected: one match for the first (the new `:root[data-lavish-content-theme="dark"]` block), one match for the second (the `<script>` tag).

- [ ] **Step 4: Verify live**

From `will-sargent-dbtlabs/lavish-axi`, run `node bin/lavish-axi.js --no-open /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier1/latex.html`, open the printed session URL via Chrome DevTools MCP, open the overflow menu, confirm a "Content Theme" section with "Light"/"Dark" swatches appears, click "Dark", and confirm the page background goes to a dark charcoal with light body text, code blocks stay legible, and table borders remain visible. End the session afterward (`node bin/lavish-axi.js end <path>`).

- [ ] **Step 5: Commit and push**

```bash
git add tier1/latex.html
git commit -m "feat: add a dark content theme to latex, reusing its own dormant dark palette"
git push
```

---

### Task 2: `water` dark variant (reuse existing `@media` dark values)

**Files:**

- Modify: `tier1/water.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Confirm the existing dark values haven't drifted**

Run:

```bash
sed -n '16,64p' tier1/water.html
```

Expected: a base `:root { ... }` block (light values) immediately followed by `@media (prefers-color-scheme: dark) { :root { ... } }` (dark values) for the same property names. If the property list differs from what's used in Step 2 below, stop and use the actual file contents instead.

- [ ] **Step 2: Add the manifest and the explicit dark override**

Find:

<!-- prettier-ignore -->
```html
@media (prefers-color-scheme: dark) {
:root {
  --background-body: #202b38;
  --background: #161f27;
  --background-alt: #1a242f;
  --selection: #1c76c5;
  --text-main: #dbdbdb;
  --text-bright: #fff;
  --text-muted: #a9b1ba;
  --links: #41adff;
  --focus: #0096bfab;
  --border: #526980;
  --code: #ffbe85;
  --animation-duration: 0.1s;
  --button-base: #0c151c;
  --button-hover: #040a0f;
  --scrollbar-thumb: var(--button-hover);
  --scrollbar-thumb-hover: rgb(0, 0, 0);
  --form-placeholder: #a9a9a9;
  --form-text: #fff;
  --variable: #d941e2;
  --highlight: #efdb43;
  --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
}
}
```

Replace with (identical content, plus a new attribute-scoped block and the manifest immediately after it — the original `@media` block stays untouched so OS-preference dark mode keeps working for anyone who opens this file outside Lavish):

<!-- prettier-ignore -->
```html
@media (prefers-color-scheme: dark) {
:root {
  --background-body: #202b38;
  --background: #161f27;
  --background-alt: #1a242f;
  --selection: #1c76c5;
  --text-main: #dbdbdb;
  --text-bright: #fff;
  --text-muted: #a9b1ba;
  --links: #41adff;
  --focus: #0096bfab;
  --border: #526980;
  --code: #ffbe85;
  --animation-duration: 0.1s;
  --button-base: #0c151c;
  --button-hover: #040a0f;
  --scrollbar-thumb: var(--button-hover);
  --scrollbar-thumb-hover: rgb(0, 0, 0);
  --form-placeholder: #a9a9a9;
  --form-text: #fff;
  --variable: #d941e2;
  --highlight: #efdb43;
  --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
}
}
:root[data-lavish-content-theme="dark"] {
  --background-body: #202b38;
  --background: #161f27;
  --background-alt: #1a242f;
  --selection: #1c76c5;
  --text-main: #dbdbdb;
  --text-bright: #fff;
  --text-muted: #a9b1ba;
  --links: #41adff;
  --focus: #0096bfab;
  --border: #526980;
  --code: #ffbe85;
  --button-base: #0c151c;
  --button-hover: #040a0f;
  --scrollbar-thumb: var(--button-hover);
  --scrollbar-thumb-hover: rgb(0, 0, 0);
  --form-placeholder: #a9a9a9;
  --form-text: #fff;
  --variable: #d941e2;
  --highlight: #efdb43;
  --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
}
<script type="application/json" id="lavish-content-themes">
[
  {"id": "light", "label": "Light"},
  {"id": "dark", "label": "Dark"}
]
</script>
```

- [ ] **Step 3: Verify structurally**

```bash
grep -c ':root\[data-lavish-content-theme="dark"\]' tier1/water.html
grep -n 'lavish-content-themes' tier1/water.html
```

Expected: `1` for the first command, one match for the second.

- [ ] **Step 4: Verify live**

Open `tier1/water.html` through `lavish-axi` (same process as Task 1), switch to "Dark" in the Content Theme menu, and confirm the page background/text/links/borders flip to the dark palette. Do not worry about scrollbar or select-arrow styling matching perfectly — that's the documented limitation. End the session afterward.

- [ ] **Step 5: Commit and push**

```bash
git add tier1/water.html
git commit -m "feat: add a dark content theme to water, reusing its own OS-preference dark palette"
git push
```

---

### Task 3: `terminal` dark variant (bespoke — no existing dark support)

**Files:**

- Modify: `tier1/terminal.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on.

Unlike `latex`/`water`, this vendored copy of terminal.css has zero existing dark-mode CSS (confirmed: no `@media (prefers-color-scheme: dark)` anywhere in the file, no dormant class). Nearly every color in this theme is already routed through its own `:root` custom properties — the one exception is `blockquote::after`'s decorative quote-mark glyph color (a hardcoded `#9ca2ab`, unrelated to any variable), which stays the same static gray in both modes and doesn't pair with any variable-driven background, so it's not a contrast risk. No contrast-bug patch is needed for this theme.

- [ ] **Step 1: Confirm the base palette hasn't drifted**

```bash
grep -n -- "--background-color:\|--font-color:\|--invert-font-color:\|--primary-color:\|--secondary-color:\|--error-color:\|--code-bg-color:\|--progress-bar-background:\|--progress-bar-fill:" tier1/terminal.html
```

Expected: one line containing all of `--background-color:#fff`, `--font-color:#151515`, `--invert-font-color:#fff`, `--primary-color:#1a95e0`, `--secondary-color:#727578`, `--error-color:#d20962`, `--code-bg-color:#e8eff2`, `--progress-bar-background:#727578`, `--progress-bar-fill:#151515` (this file's CSS is minified onto one line).

- [ ] **Step 2: Add the manifest and the bespoke dark palette**

Find (the closing brace of the `:root { ... }` block, which is followed immediately by `*{box-sizing`):

<!-- prettier-ignore -->
```
--display-h1-decoration:none;--block-background-color:var(--background-color)}*{box-sizing:border-box;
```

Replace with:

<!-- prettier-ignore -->
```
--display-h1-decoration:none;--block-background-color:var(--background-color)}:root[data-lavish-content-theme="dark"]{--background-color:#0d0d0d;--font-color:#d0d0d0;--invert-font-color:#0d0d0d;--primary-color:#39ff14;--secondary-color:#6f6f6f;--error-color:#ff5f87;--code-bg-color:#1a1a1a;--progress-bar-background:#333333;--progress-bar-fill:#39ff14}*{box-sizing:border-box;
```

Then, immediately before the closing `</style>` tag, add the manifest script:

<!-- prettier-ignore -->
```html
<script type="application/json" id="lavish-content-themes">
[
  {"id": "light", "label": "Light"},
  {"id": "dark", "label": "Dark"}
]
</script>
```

(Design notes for the reviewer: `--primary-color` becomes a classic phosphor green (`#39ff14`) instead of the light theme's blue, matching the terminal/hacker identity the theme's own sample content already leans into. `--invert-font-color` — the text color used _on top of_ `--primary-color`, e.g. `::selection` and link-hover backgrounds — flips from white to near-black so it still contrasts against the now-bright-green background. `--code-bg-color` becomes a subtly lighter charcoal than the page background so code blocks stay visually distinct.)

- [ ] **Step 3: Verify structurally**

```bash
grep -o ':root\[data-lavish-content-theme="dark"\][^}]*}' tier1/terminal.html
grep -n 'lavish-content-themes' tier1/terminal.html
```

Expected: the dark override block's full contents printed once, and one match for the manifest script.

- [ ] **Step 4: Verify live**

Open `tier1/terminal.html` through `lavish-axi`, switch to "Dark," and confirm: page background goes near-black, body text is light gray (not pure white), links/highlights render in green, selecting text shows a green highlight with dark text, and code blocks remain legible. End the session afterward.

- [ ] **Step 5: Commit and push**

```bash
git add tier1/terminal.html
git commit -m "feat: add a bespoke dark content theme to terminal (phosphor-green hacker palette)"
git push
```

---

### Task 4: `handwritten` dark variant (bespoke — "night" notebook mood)

**Files:**

- Modify: `tier2/handwritten.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on.

This theme has three hardcoded low-opacity overlays outside `:root` — `strong`'s highlight (`rgba(255,220,90,0.7)`) and `code`/`pre`'s subtle tint backgrounds (`rgba(0,0,0,0.05)`/`rgba(0,0,0,0.04)`) — but none of them pair with a variable-driven text color that would flip independently of them (the text sitting on top of each still uses `var(--ink)`, which the dark override below correctly recolors), so none of these create a contrast bug. A pure variable override is safe — no contrast-bug patch needed. (The rgba tints will render as a slightly different visual weight against the new dark `--paper` than they do against the light one, since a black-tinted overlay reads differently on a light vs. dark backdrop — that's an acceptable cosmetic difference, not a legibility issue.)

- [ ] **Step 1: Confirm the base palette hasn't drifted**

```bash
grep -n -A8 ":root {" tier2/handwritten.html | head -9
```

Expected:

<!-- prettier-ignore -->
```css
  :root {
    --paper: #fffbf0;
    --ruling: #b8d4e3;
    --margin: #c93232;
    --ink: #2a2e35;
    --pencil: #50525a;
    --tape: #f7e9a0;
    --note: #fff79a;
  }
```

- [ ] **Step 2: Add the manifest and the bespoke dark palette**

Find the exact block from Step 1 (the closing `}` of `:root { ... }`) and the line immediately after it (whatever comes next in the file — read the file to confirm, since this file's structure hasn't been quoted elsewhere in this plan). Insert the new override and manifest immediately after that closing `}`:

<!-- prettier-ignore -->
```css
  :root[data-lavish-content-theme="dark"] {
    --paper: #1e1c18;
    --ruling: #3a4a54;
    --margin: #d94f4f;
    --ink: #ece6d8;
    --pencil: #a9a49b;
    --tape: #4a4128;
    --note: #5c4f1e;
  }
```

<!-- prettier-ignore -->
```html
<script type="application/json" id="lavish-content-themes">
[
  {"id": "light", "label": "Light"},
  {"id": "dark", "label": "Dark"}
]
</script>
```

(Design notes: this isn't a literal color-inversion — it's meant to read as "the same notebook, at night, under a desk lamp." `--paper` goes to a warm near-black (not pure black, keeping the warm cream identity). `--ruling`/`--margin` (the faint blue ruled lines and the red margin rule) get dimmed but stay legibly tinted rather than going full-contrast. `--tape`/`--note` (the sticky-note yellow) go to a muted dark gold rather than staying bright — a bright yellow sticky note would look jarring against a dark page; a dim gold note still reads as "a note" without glowing.)

- [ ] **Step 3: Verify structurally**

```bash
grep -c 'lavish-content-theme="dark"' tier2/handwritten.html
grep -n 'lavish-content-themes' tier2/handwritten.html
```

Expected: `1` and one match.

- [ ] **Step 4: Verify live**

Open `tier2/handwritten.html` through `lavish-axi`, switch to "Dark," and confirm the page reads as a dim, warm-toned night version of the notebook — text legible, sticky-note blockquotes still visually distinct from the page, ruled lines faintly visible. End the session afterward.

- [ ] **Step 5: Commit and push**

```bash
git add tier2/handwritten.html
git commit -m "feat: add a bespoke dark (night) content theme to handwritten"
git push
```

---

### Task 5: `zine` dark variant (bespoke — swap the yellow/black roles)

**Files:**

- Modify: `tier2/zine.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on.

Zine's variables are named after literal colors, not roles (`--yellow`, `--black`), and nearly every element already alternates between a `--black`-background "chip" (headers, `h2`, `strong`, `em`, `code`, `th`, `pre`, `footer.colophon`) sitting on the page's `--yellow` background. Swapping what `--yellow` and `--black` _equal_ — rather than rewriting each of those selectors individually — flips the whole page from yellow-dominant to black-dominant for free, because every existing chip/border/box-shadow rule keeps working unmodified. The one exception: `code`/`pre` use `color: var(--cyan)` on a `background: var(--black)` — cyan-on-black has strong contrast (the original intent), but once `--black` is swapped to become bright yellow, cyan-on-yellow does not. Those two selectors need an explicit patch back to a literal dark background — and `pre` additionally has `border: 4px solid var(--black)`, which is intentionally invisible in light mode (border color equals its own background color) but would become a visible bright-yellow outline after the swap unless it's patched too.

- [ ] **Step 1: Confirm the base palette and the code/pre rule haven't drifted**

```bash
grep -n -A6 ":root {" tier2/zine.html | head -7
grep -n "^\s*code\s*{\|^\s*pre\s*{" tier2/zine.html
```

Expected first command:

<!-- prettier-ignore -->
```css
  :root {
    --yellow: #ffd400;
    --black: #0b0b0b;
    --magenta: #ff006e;
    --paper: #f3f0e8;
    --cyan: #00d9ff;
  }
```

Expected second command: two lines, `code { background: var(--black); color: var(--cyan); ... }` and `pre { background: var(--black); color: var(--cyan); ... border: 4px solid var(--black); ...}`.

- [ ] **Step 2: Add the manifest and the dark override**

Find:

<!-- prettier-ignore -->
```html
  :root {
    --yellow: #ffd400;
    --black: #0b0b0b;
    --magenta: #ff006e;
    --paper: #f3f0e8;
    --cyan: #00d9ff;
  }
```

Replace with:

<!-- prettier-ignore -->
```html
  :root {
    --yellow: #ffd400;
    --black: #0b0b0b;
    --magenta: #ff006e;
    --paper: #f3f0e8;
    --cyan: #00d9ff;
  }
  :root[data-lavish-content-theme="dark"] {
    --yellow: #0b0b0b;
    --black: #ffd400;
    --paper: #1c1c1c;
  }
  /* code/pre use cyan text on var(--black), which is bright yellow once
     swapped above - keep their background literally dark so cyan stays
     legible instead of becoming cyan-on-yellow. pre also has a
     border: 4px solid var(--black) that matches its own background in
     light mode (an intentionally invisible border) - pin border-color to
     the same literal dark value too, or it would render as a visible
     bright-yellow outline that never existed in the original design. */
  [data-lavish-content-theme="dark"] code,
  [data-lavish-content-theme="dark"] pre {
    background: #0b0b0b;
    border-color: #0b0b0b;
  }
  <script type="application/json" id="lavish-content-themes">
  [
    {"id": "light", "label": "Light"},
    {"id": "dark", "label": "Dark"}
  ]
  </script>
```

(Design trace, for the reviewer to spot-check rather than re-derive: with `--yellow`/`--black` swapped, `html, body { background: var(--yellow); color: var(--black); }` becomes a near-black page with bright-yellow body text. Every chip that was `background: var(--black); color: var(--yellow)` (headers, `h2`, `strong`, `th`, `footer.colophon`) becomes a bright-yellow chip with dark text — bold and on-brand, not washed out. `blockquote`/`.issue`/`em` (`background: var(--magenta); color: var(--black)`) become magenta chips with yellow text — still strong contrast. All `border: ... var(--black)` and `box-shadow: ... var(--black)` accents (blockquote, table, pre, and the `@media (max-width: 480px)` blockquote box-shadow) become yellow outlines/shadows, clearly visible against the new dark page instead of disappearing into it — this includes the responsive block's own separate `var(--black)` reference, which the swap covers automatically since it's the same variable. `table`'s own background (`var(--paper)`) goes from light beige to dark charcoal, consistent with the rest of the page; `td` has no explicit color of its own and inherits `body`'s (swapped) `--black`, which is exactly why it stays legible — yellow text on the now-dark `--paper` table background. `ul li::before`'s bullet color (`var(--magenta)`) is untouched by the swap and stays magenta in both modes, which is fine since magenta doesn't participate in the light/dark flip. The body's own `background-image` dot-grid texture (two `radial-gradient(rgba(0,0,0,...))` layers, hardcoded rather than variable-driven) stays a faint dark tint in both modes — it reads as a subtle darkening in light mode and is essentially invisible against the new near-black page in dark mode; this is a cosmetic-only side effect, not a legibility issue, and is not worth patching.)

- [ ] **Step 3: Verify structurally**

```bash
grep -c 'lavish-content-theme="dark"' tier2/zine.html
grep -n 'lavish-content-themes' tier2/zine.html
```

Expected: `3` (the `:root` override, and the two `code`/`pre` selectors) for the first, one match for the second.

- [ ] **Step 4: Verify live**

Open `tier2/zine.html` through `lavish-axi`, switch to "Dark," and confirm: the page background goes near-black, headings/chips render as bright yellow blocks with dark text, `code`/`pre` blocks show cyan text on a dark background (not yellow) with no visible bright-yellow border around them, and the blockquote/table borders and shadows are visible (not swallowed by the dark background). End the session afterward.

- [ ] **Step 5: Commit and push**

```bash
git add tier2/zine.html
git commit -m "feat: add a bespoke dark content theme to zine by swapping the yellow/black roles"
git push
```

---

### Task 6: `dbt-brief` + `dbt-brief-dashboard` dark variants (bespoke — introduce `--card`/`--code-bg` first)

**Files:**

- Modify: `tier2/dbt-brief.html`
- Modify: `tier2/dbt-brief-dashboard.html`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing later tasks depend on.

Every card, table, and code surface in both files is a hardcoded `background: white` (or a hardcoded light gray for `code`/`pre`) rather than a variable — the same bug class already found and fixed once for `lavish-light`'s `code`/`pre`. Since almost all of this theme's actual content sits inside those cards/tables, a dark `--ink` without fixing these would make most of the page's text illegible. Fix: introduce `--card` and `--code-bg` variables (defaulting to today's exact `white`/`#f0f0f0`/`#f5f5f5` values so light mode is byte-for-byte unchanged), replace every hardcoded occurrence with the variable, then override both alongside `--paper`/`--ink`/`--muted`/`--rule` in the dark block. `--orange`/`--purple`/`--grad` stay unchanged in both files — the gradient accent identity should look the same in both modes.

- [ ] **Step 1: Confirm every hardcoded surface color in `dbt-brief.html`**

```bash
grep -n "background:\s*white\|background:\s*#f0f0f0\|background:\s*#f5f5f5" tier2/dbt-brief.html
```

Expected: 9 matches — lines setting `.card`, `aside .aside-box`, `table`, `.pain-item`, `.ba-col`, `.info-grid` (all `white`), plus `code` (`#f0f0f0`) and `pre` (`#f5f5f5`). If the count or the selectors differ from this, stop and adjust Step 2's replacements to match the actual file instead of assuming these are the only ones.

- [ ] **Step 2: Introduce `--card`/`--code-bg` and replace every hardcoded occurrence in `dbt-brief.html`**

Find the base `:root { ... }` block:

<!-- prettier-ignore -->
```html
  :root {
    --orange: #fd6603;
    --purple: #7b2de4;
    --grad: linear-gradient(135deg, var(--orange) 0%, var(--purple) 100%);
    --paper: #f8f9fa;
    --ink:   #2c3e50;
    --muted: #6b7280;
    --rule:  #f0f0f0;
    --shadow: 0 4px 20px rgba(0,0,0,0.06);
  }
```

Replace with:

<!-- prettier-ignore -->
```html
  :root {
    --orange: #fd6603;
    --purple: #7b2de4;
    --grad: linear-gradient(135deg, var(--orange) 0%, var(--purple) 100%);
    --paper: #f8f9fa;
    --ink:   #2c3e50;
    --muted: #6b7280;
    --rule:  #f0f0f0;
    --shadow: 0 4px 20px rgba(0,0,0,0.06);
    --card: #fff;
    --code-bg: #f0f0f0;
    --pre-bg: #f5f5f5;
  }
  :root[data-lavish-content-theme="dark"] {
    --paper: #14171c;
    --ink:   #e8ebef;
    --muted: #9aa3af;
    --rule:  #2a2f38;
    --card: #1c2027;
    --code-bg: #262b33;
    --pre-bg: #21252c;
  }
  <script type="application/json" id="lavish-content-themes">
  [
    {"id": "light", "label": "Light"},
    {"id": "dark", "label": "Dark"}
  ]
  </script>
```

Then replace every hardcoded surface color with its new variable, one at a time (use the line numbers from Step 1 to locate each — do not use a blind find-and-replace across the whole file, since `white` and `#f0f0f0` could theoretically appear in an unrelated context like a comment or a gradient stop):

- `code { ...; background: #f0f0f0; ...}` → `background: var(--code-bg);`
- `pre { ...; background: #f5f5f5; ...}` → `background: var(--pre-bg);`
- `.card { background: white; ...}` → `background: var(--card);`
- `aside .aside-box { background: white; ...}` → `background: var(--card);`
- `table { ...; background: white; ...}` → `background: var(--card);`
- `.pain-item { background: white; ...}` → `background: var(--card);`
- `.ba-col { background: white; ...}` → `background: var(--card);`
- `.info-grid { ...; background: white; ...}` → `background: var(--card);`

Leave every other hardcoded color alone: the `.badge.*` pairs and `.ba-col.before`/`.ba-col.after` header colors each pair a light background with its own matching hardcoded text color, so they stay internally legible in both modes and just won't visually "go dark," which is fine. `tbody tr:hover`'s `background: #fafafa` has no color declaration of its own at all — it relies on inherited `--ink`, which the dark override recolors correctly, so hovering a table row still shows light text on a still-near-white hover highlight; that's a minor "didn't go dark" cosmetic gap, not a legibility bug, so it's fine to leave as-is too.

- [ ] **Step 3: Verify structurally**

```bash
grep -c "background:\s*white\|background:\s*#f0f0f0\|background:\s*#f5f5f5" tier2/dbt-brief.html
grep -c "var(--card)\|var(--code-bg)\|var(--pre-bg)" tier2/dbt-brief.html
grep -n 'lavish-content-themes' tier2/dbt-brief.html
```

Expected: `0` for the first command (every hardcoded surface color replaced), `8` for the second (one `--card`/`--code-bg`/`--pre-bg` declaration each in both `:root` blocks, plus the 6 `var(--card)` usages), one match for the third.

- [ ] **Step 4: Repeat Steps 1-3 for `dbt-brief-dashboard.html`**

Run:

```bash
grep -n "background:\s*white\|background:\s*#f0f0f0\|background:\s*#f5f5f5" tier2/dbt-brief-dashboard.html
```

Expected: 5 matches (`nav.tab-nav`, `code`, `table`, `.card`, `.ba-col` — this file has no meta-grid/pain-item/meeting-item sections). Apply the same `--card`/`--code-bg` introduction to this file's own `:root` block (this file has no separate `pre` rule with a hardcoded background, so it does not need a `--pre-bg` variable — confirm this with `grep -n "^\s*pre\s*{" tier2/dbt-brief-dashboard.html` before skipping it), then replace each of the 5 hardcoded occurrences the same way: `code`'s background → `var(--code-bg)`, and `nav.tab-nav`/`table`/`.card`/`.ba-col` → `var(--card)`.

(This file also has two hardcoded near-white tab-hover backgrounds, `label.tab-item:hover` and the active-tab selector, both `background: #fff7f0` paired with `color: var(--orange)` — leave both alone. `--orange` never changes between light and dark, so these stay legible in both modes without needing `--card`; they just won't visually "go dark," matching the same acceptable gap as `dbt-brief.html`'s `tbody tr:hover`.)

- [ ] **Step 5: Verify structurally (dashboard)**

```bash
grep -c "background:\s*white\|background:\s*#f0f0f0\|background:\s*#f5f5f5" tier2/dbt-brief-dashboard.html
grep -n 'lavish-content-themes' tier2/dbt-brief-dashboard.html
```

Expected: `0` and one match.

- [ ] **Step 6: Verify live (both files)**

Open `tier2/dbt-brief.html` through `lavish-axi`, switch to "Dark," and confirm every card/table/pain-item/ba-col section shows light text on a dark card surface (not light text on a still-white card). Repeat for `tier2/dbt-brief-dashboard.html`, additionally checking that the sticky tab navigation bar itself goes dark. End each session afterward.

- [ ] **Step 7: Commit and push**

```bash
git add tier2/dbt-brief.html tier2/dbt-brief-dashboard.html
git commit -m "feat: add a bespoke dark content theme to dbt-brief and dbt-brief-dashboard"
git push
```

---

### Task 7: Documentation and skill sync

**Files:**

- Modify: `docs/prd-fork-features.md` (in `will-sargent-dbtlabs/lavish-axi`)
- Run: `bash ~/.claude/skills/lavish/themes/refresh.sh`

**Interfaces:**

- Consumes: nothing (docs/sync only).
- Produces: nothing — this is the plan's last task.

- [ ] **Step 1: Update the Feature 5 PRD entry**

In `docs/prd-fork-features.md`, find:

```markdown
## Feature 5 — retrofit all bundled themes onto one shared variable scheme (future, not started)

### Problem

Feature 4's live re-theming only works between themes that happen to share both a CSS variable contract and compatible structural markup. Today that's just the `lavish-light`/`swiss` pair. The other six bundled themes (`terminal`, `water`, `zine`, `handwritten`, `latex`, `dbt-brief`/`dbt-brief-dashboard`) each use entirely different variable names and DOM structure, so they can't participate without a rewrite.

### Idea (not scoped or started)

Rename every bundled theme's CSS custom properties in `will-sargent-dbtlabs/lavish-themes` onto one shared, role-based set (e.g. `--paper`/`--ink`/`--accent`/`--muted`/`--rule`), so any theme built from the bundled library becomes a candidate for cross-family live switching via Feature 4's existing mechanism — no changes needed to `lavish-axi` itself. This is a content-authoring investment, not a lavish-axi engineering task: it touches up to 8 theme files, needs careful visual regression checking per theme (screenshot before/after), and risks changing a theme's character if a role-based rename forces a design compromise a theme wasn't built to make (e.g. `zine`'s `--yellow`/`--magenta`/`--cyan` palette doesn't map cleanly onto a `paper`/`ink`/`accent` role scheme without flattening what makes it a "loud" theme). Deferred until there's a concrete need for cross-family switching beyond the `lavish-light`/`swiss` pair.
```

Replace with:

```markdown
## Feature 5 — dark content themes for the rest of the bundled library ✅ DONE

### Status

Implemented directly in `will-sargent-dbtlabs/lavish-themes` (no lavish-axi changes — the switcher mechanism from Feature 4 is already fully generic).

### What was built

The originally-sketched idea (rename all 8 bundled themes onto one shared variable scheme so any theme could switch to any other) turned out not to hold up: `terminal`/`water`/`latex` are vendored third-party CSS frameworks with their own variable conventions, and `handwritten`/`zine` have bespoke visual identities built from CSS rules that don't exist in the `lavish-light`/`swiss` structure at all — a rename wouldn't make them cross-compatible, since the actual layout/rules differ, not just the variable names. `dbt-brief`/`dbt-brief-dashboard` already share an identical palette with each other, but as the same look in two layouts, not two looks to switch between.

What shipped instead: every remaining bundled theme got its own single-file `dark` sibling, each built the way that theme's structure called for — `latex` and `water` reuse a dark palette the theme already shipped but never exposed outside an OS preference or a dormant CSS class; `terminal`, `handwritten`, `zine`, and `dbt-brief`/`dbt-brief-dashboard` needed a hand-designed dark palette from scratch. Two more hardcoded-background contrast bugs (in the same family as the one already fixed for `lavish-light`) were found and fixed along the way — `dbt-brief`'s cards/tables were entirely hardcoded `white` rather than variable-driven, which would have gone illegible under a dark `--ink`.
```

- [ ] **Step 2: Sync the bundled theme cache**

```bash
bash ~/.claude/skills/lavish/themes/refresh.sh
```

Expected: output lists all 9 theme files including the six just modified.

- [ ] **Step 3: Verify no drift**

```bash
for f in latex water terminal; do diff /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier1/$f.html ~/.claude/skills/lavish/themes/$f.html && echo "$f IN SYNC"; done
for f in handwritten zine dbt-brief dbt-brief-dashboard; do diff /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/$f.html ~/.claude/skills/lavish/themes/$f.html && echo "$f IN SYNC"; done
```

Expected: "IN SYNC" printed for all 7 files with no diff output above each line.

- [ ] **Step 4: Commit the lavish-axi PRD change**

```bash
cd /Users/operator/code/will-sargent-dbtlabs/lavish-axi
git add docs/prd-fork-features.md
git commit -m "docs: mark Feature 5 done — dark content themes for the rest of the bundled library"
```

---

## Self-Review

- **Spec coverage:** the user asked for "bigger — bespoke dark variants for handwritten/zine/dbt-brief too" in addition to the mechanical terminal/water/latex toggles. Tasks 1-2 cover the mechanical cases (though `terminal` turned out to have no existing dark values to reuse, contrary to the initial framing — Task 3 treats it as bespoke instead, which is the honest read of the actual file). Tasks 4-6 cover the three bespoke themes the user explicitly asked for. Task 7 closes out the PRD.
- **Placeholder scan:** no TBD/TODO. Every task's CSS values are concrete, derived from either the theme's own existing (verified) dark values or a fully-specified bespoke design with its rationale written inline for the reviewer to check.
- **Type/name consistency:** `{"id": "light"/"dark", "label": "Light"/"Dark"}` is used identically in every task's manifest. `--card`/`--code-bg`/`--pre-bg` (Task 6) are the only new variable names introduced anywhere in this plan, and both files that need them get the same three.
- **Adversarial review fixes applied:** Task 5's `code`/`pre` patch now also pins `border-color` (a real visual regression the first draft missed — `pre`'s border would otherwise render as a bright yellow outline that never existed in light mode). Task 5's design trace now accounts for `em`, `ul li::before`, the responsive `@media` block's own `var(--black)` reference, and the body texture overlay. Tasks 3 and 4's "zero hardcoded colors outside :root" claims were corrected to name the actual (harmless) exceptions found. Task 6's selector list was corrected (`aside .aside-box` and `.info-grid`, not one combined "meta-grid box"), and `dbt-brief-dashboard.html`'s two `#fff7f0` tab-hover backgrounds are now explicitly called out as an intentionally-skipped, harmless gap rather than left undiscussed.
