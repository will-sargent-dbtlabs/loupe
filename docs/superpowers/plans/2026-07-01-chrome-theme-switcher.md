# Chrome Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lavish-light` the default visual theme for the Lavish Editor chrome (the surrounding UI: top bar, overflow menu, conversation sidebar), and let the user switch between bundled chrome themes from the overflow menu without re-running the agent.

**Architecture:** The chrome's entire visual palette already routes through ~20 semantic CSS custom properties declared once in `src/chrome.css`'s `:root { ... }` block (`--bg`, `--fg`, `--accent`, `--border`, etc.) — nothing in the chrome's markup hardcodes colors directly except three `var(--steel-700)` hover states and one intentionally theme-invariant warning banner. This makes theming additive: define two more `:root[data-lavish-theme="..."]` attribute-selector blocks that override those same custom properties with palettes captured from the bundled `lavish-light` and `swiss` artifact themes (`will-sargent-dbtlabs/lavish-themes`), leave the current dark palette as the un-attributed `:root` fallback (renamed conceptually to "midnight"), and set `data-lavish-theme` on `<html>` server-side (resolved from a `--theme` flag / `LAVISH_AXI_THEME` env var, mirroring the existing `--annotate` / `LAVISH_AXI_ANNOTATE` pattern in `src/server.js`). The overflow menu gains a row of theme swatch buttons; clicking one updates `document.documentElement.dataset.lavishTheme` directly in the browser and remembers the choice in `sessionStorage` (never `~/.lavish-axi/state.json`), so it's restored on a same-tab reload but never persists across sessions or machines.

**Tech Stack:** Plain CSS custom properties (no new libraries), the existing Express server (`src/server.js`), the existing vanilla-JS chrome client (`src/chrome-client.js`). No changes to the artifact iframe or its sandboxing.

## Global Constraints

- The artifact stays completely untouched by this feature — theming applies only to the chrome (masthead/bar, overflow menu, conversation sidebar), never to the sandboxed `<iframe>` or the HTML file the agent authored. This is the resolved design tension recorded in `docs/prd-fork-features.md`'s Feature 1 section.
- Bundled theme palettes live as literal CSS in `src/chrome.css` (inline in the repo's source, not fetched from `dist/themes/` or the `lavish-themes` fork at runtime) — confirmed design choice.
- Theme choice is session-only: a per-tab `sessionStorage` entry, never written to `~/.lavish-axi/state.json` and never sent back to the server after the initial page load — confirmed design choice.
- No new npm dependencies.
- `pnpm run check` (build, lint, format, typecheck, tests, skill-freshness) must pass after every task.
- Existing chrome behavior (annotate switch, overflow menu items, print route, layout gate) must be unchanged — this feature is fully additive.

---

## File Structure

- Create: `src/chrome-themes.js` — the theme registry (`CHROME_THEMES`, `DEFAULT_CHROME_THEME`) and the resolver (`resolveChromeTheme`, `isValidChromeTheme`), mirroring the shape of `shouldEnableAnnotate` in `src/server.js`.
- Create: `test/chrome-themes.test.js` — TDD for the registry and resolver.
- Modify: `src/chrome.css` — add a `--hover-bg` semantic variable (replacing three raw `var(--steel-700)` references so hover states are themeable), and two new `:root[data-lavish-theme="..."]` override blocks (`lavish-light`, `swiss`) plus `.menu-themes`/`.theme-swatch`/`.swatch-dot` styles for the new menu UI.
- Modify: `src/server.js` — `createChromeHtml()` accepts and renders a `theme` option (bootstrap JSON, `<html data-lavish-theme>`, and the new theme-swatch buttons in the overflow menu); `/session/:key` resolves the theme via `resolveChromeTheme`; `/api/sessions` accepts an optional `theme` field and appends it to the returned session URL, mirroring the existing `annotate` handling.
- Modify: `src/cli.js` — `resolveThemeFlag(args)` (mirrors `resolveAnnotateFlag`), wired into `openCommand`'s POST body; a short mention of `--theme <id>` / `LAVISH_AXI_THEME` in `TOP_LEVEL_HELP`.
- Modify: `src/chrome-client.js` — apply the bootstrap theme (or a stored `sessionStorage` override) to `document.documentElement`, and wire click handlers on the new theme-swatch buttons.
- Modify: `test/server.test.js` — TDD for the CSS overrides, `createChromeHtml`'s new option, the two routes, and the chrome-client wiring.
- Modify: `test/cli-output.test.js` — TDD for `resolveThemeFlag`.
- Modify: `docs/prd-fork-features.md` — mark Feature 1 done (and, since it was missed at the time, also mark the already-shipped-and-merged Feature 3 done, and prune the now-stale "Pending before any feature merge" checklist).

---

### Task 1: Theme registry and resolver

**Files:**

- Create: `src/chrome-themes.js`
- Test: `test/chrome-themes.test.js`

**Interfaces:**

- Consumes: nothing new.
- Produces: `CHROME_THEMES: { id: string, label: string }[]`, `DEFAULT_CHROME_THEME: string`, `isValidChromeTheme(id: string): boolean`, `resolveChromeTheme(query = {}, env = process.env): string`. Task 3 imports all four into `src/server.js`; Task 5's chrome-client tests reference the same theme ids as string literals (no import — the client is loaded directly by the browser, not bundled).

- [ ] **Step 1: Write the failing tests**

Create `test/chrome-themes.test.js`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { CHROME_THEMES, DEFAULT_CHROME_THEME, isValidChromeTheme, resolveChromeTheme } from "../src/chrome-themes.js";

test("DEFAULT_CHROME_THEME is lavish-light", () => {
  assert.equal(DEFAULT_CHROME_THEME, "lavish-light");
});

test("CHROME_THEMES lists lavish-light, midnight, and swiss in that order", () => {
  assert.deepEqual(
    CHROME_THEMES.map((theme) => theme.id),
    ["lavish-light", "midnight", "swiss"],
  );
});

test("isValidChromeTheme accepts only known theme ids", () => {
  assert.equal(isValidChromeTheme("lavish-light"), true);
  assert.equal(isValidChromeTheme("midnight"), true);
  assert.equal(isValidChromeTheme("swiss"), true);
  assert.equal(isValidChromeTheme("nonexistent"), false);
  assert.equal(isValidChromeTheme(""), false);
});

test("resolveChromeTheme defaults to lavish-light with no query or env", () => {
  assert.equal(resolveChromeTheme({}, {}), "lavish-light");
});

test("resolveChromeTheme reads a valid ?theme= query param", () => {
  assert.equal(resolveChromeTheme({ theme: "midnight" }, {}), "midnight");
});

test("resolveChromeTheme ignores an invalid ?theme= query param and falls back to default", () => {
  assert.equal(resolveChromeTheme({ theme: "not-a-theme" }, {}), "lavish-light");
});

test("resolveChromeTheme reads LAVISH_AXI_THEME when no query param is present", () => {
  assert.equal(resolveChromeTheme({}, { LAVISH_AXI_THEME: "swiss" }), "swiss");
});

test("a valid query param wins over LAVISH_AXI_THEME", () => {
  assert.equal(resolveChromeTheme({ theme: "midnight" }, { LAVISH_AXI_THEME: "swiss" }), "midnight");
});

test("resolveChromeTheme ignores an invalid LAVISH_AXI_THEME and falls back to default", () => {
  assert.equal(resolveChromeTheme({}, { LAVISH_AXI_THEME: "nope" }), "lavish-light");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/chrome-themes.test.js`
Expected: FAIL with "Cannot find module '../src/chrome-themes.js'" (the file does not exist yet).

- [ ] **Step 3: Implement the registry and resolver**

Create `src/chrome-themes.js`:

```javascript
export const CHROME_THEMES = [
  { id: "lavish-light", label: "Lavish Light" },
  { id: "midnight", label: "Midnight" },
  { id: "swiss", label: "Swiss" },
];

export const DEFAULT_CHROME_THEME = "lavish-light";

const THEME_IDS = new Set(CHROME_THEMES.map((theme) => theme.id));

export function isValidChromeTheme(id) {
  return THEME_IDS.has(id);
}

export function resolveChromeTheme(query = {}, env = process.env) {
  const flag = Array.isArray(query.theme) ? query.theme[0] : query.theme;
  if (typeof flag === "string" && isValidChromeTheme(flag)) return flag;

  const envFlag = env?.LAVISH_AXI_THEME;
  if (typeof envFlag === "string" && isValidChromeTheme(envFlag)) return envFlag;

  return DEFAULT_CHROME_THEME;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/chrome-themes.test.js`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/chrome-themes.js test/chrome-themes.test.js
git commit -m "feat: add chrome theme registry and resolver"
```

---

### Task 2: Themeable CSS palettes

**Files:**

- Modify: `src/chrome.css`
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: nothing new (pure CSS).
- Produces: `:root[data-lavish-theme="lavish-light"]` and `:root[data-lavish-theme="swiss"]` override blocks; a `--hover-bg` custom property; `.menu-themes`, `.theme-swatch`, `.swatch-dot` classes. Task 3's markup references `.theme-swatch`/`.swatch-dot`/`data-theme-value` by these exact names.

This task changes CSS only. `test/server.test.js` already has a `chromeCssSource()` helper (reads `src/chrome.css` from disk and normalizes whitespace around `{ } : ; ,`) and a `normalizeCssForAssertions` helper used by an existing test ("annotate switch shows a brass track...") — reuse both, don't redefine them.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js` (near the existing "annotate switch shows a brass track and ink knob when enabled" test, which already uses `chromeCssSource()`):

```javascript
test("chrome.css defines a lavish-light theme override with a near-white background", async () => {
  const css = await chromeCssSource();
  assert.match(css, /:root\[data-lavish-theme="lavish-light"\]\{[^}]*--bg:#fcfcfa/);
});

test("chrome.css defines a swiss theme override with near-black ink and hairlines", async () => {
  const css = await chromeCssSource();
  assert.match(css, /:root\[data-lavish-theme="swiss"\]\{[^}]*--fg:#0a0a0a/);
  assert.match(css, /:root\[data-lavish-theme="swiss"\]\{[^}]*--border:#0a0a0a/);
});

test("menu hover states use the themeable --hover-bg variable, not a raw palette color", async () => {
  const css = await chromeCssSource();
  assert.doesNotMatch(css, /\.menu-item:hover:not\(:disabled\)\{background:var\(--steel-700\)/);
  assert.match(css, /\.menu-item:hover:not\(:disabled\)\{background:var\(--hover-bg\)/);
  assert.doesNotMatch(css, /\.menu-file:hover\{background:var\(--steel-700\)/);
  assert.match(css, /\.menu-file:hover\{background:var\(--hover-bg\)/);
});

test("theme swatch buttons get an accent border when pressed", async () => {
  const css = await chromeCssSource();
  assert.match(css, /\.theme-swatch\[aria-pressed="true"\]\{[^}]*border-color:var\(--accent\)/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "theme|hover-bg" test/server.test.js`
Expected: FAIL — none of these selectors/values exist in `chrome.css` yet.

- [ ] **Step 3: Add the `--hover-bg` variable and replace the three raw hover refs**

In `src/chrome.css`, inside the existing `:root { ... }` block, add one line right before the closing `}` (after the existing `--annotate-offset: 2px;` line):

```css
--hover-bg: var(--steel-700);
```

Then replace these three existing declarations (search for `background: var(--steel-700);` — it occurs exactly three times, inside `:hover` rules for `.more-button`, `.menu-file`, and `.menu-item`; leave the fourth, unrelated `var(--steel-700)` reference inside the base `:root` token definitions untouched):

```css
background: var(--steel-700);
```

with:

```css
background: var(--hover-bg);
```

(Do this three times — once each for `.more-button:hover:not(:disabled), .more-button[aria-expanded="true"]`, `.menu-file:hover`, and `.menu-item:hover:not(:disabled)`. Leave every other CSS rule in the file untouched, including the `.layout-issue-banner`'s hardcoded `rgba(37, 35, 15, 0.92)` background and `var(--brass-400)` text — that banner is an intentionally theme-invariant warning overlay, not part of the chrome's themeable palette.)

- [ ] **Step 4: Add the two theme override blocks**

Immediately after the closing `}` of the base `:root { ... }` block (right before the `* { box-sizing: border-box; }` rule), add:

```css
/* The base :root block above is the "midnight" theme (the original dark
   palette) and stays the fallback if data-lavish-theme is ever absent.
   These two blocks override the same semantic variables — never the raw
   palette tokens (--ink-900, --steel-700, etc.) — with values captured
   from the matching bundled artifact theme in the lavish-themes fork. */
:root[data-lavish-theme="lavish-light"] {
  --bg: #fcfcfa;
  --bg-panel: #f5f4ef;
  --bg-bar: #f7f6f2;
  --bg-elevated: #efeee7;
  --fg: #2b2b2b;
  --fg-muted: #45443f;
  --fg-dim: #6b6b66;
  --fg-faint: #8a8980;
  --fg-label: #9a9990;
  --border: #d6d6d0;
  --border-subtle: #e6e5df;
  --border-strong: #b9b8b0;
  --accent: #e30613;
  --accent-hover: #c40510;
  --accent-ink: #fcfcfa;
  --danger: #b3211c;
  --hover-bg: #efeee7;
}
:root[data-lavish-theme="swiss"] {
  --bg: #fafaf7;
  --bg-panel: #f0f0ec;
  --bg-bar: #f3f3ef;
  --bg-elevated: #e8e8e2;
  --fg: #0a0a0a;
  --fg-muted: #1a1a1a;
  --fg-dim: #5a5a55;
  --fg-faint: #7a7a72;
  --fg-label: #8a8a80;
  --border: #0a0a0a;
  --border-subtle: #d4d4cc;
  --border-strong: #0a0a0a;
  --accent: #e30613;
  --accent-hover: #c40510;
  --accent-ink: #fafaf7;
  --danger: #b3211c;
  --hover-bg: #e8e8e2;
}
```

- [ ] **Step 5: Add the theme-swatch menu styles**

Append after the existing `.menu-item.danger { color: var(--danger); }` rule:

```css
.menu-themes {
  display: flex;
  gap: 6px;
  padding: 0 4px 4px;
}
.theme-swatch {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  color: var(--fg-muted);
}
.theme-swatch:hover {
  background: var(--hover-bg);
}
.theme-swatch[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--fg);
}
.swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--border);
}
.swatch-dot[data-swatch="lavish-light"] {
  background: #fcfcfa;
}
.swatch-dot[data-swatch="midnight"] {
  background: #11141a;
}
.swatch-dot[data-swatch="swiss"] {
  background: #fafaf7;
  border-color: #0a0a0a;
}
```

(The swatch dot colors are a fixed preview of each option — like a color picker — so they deliberately do not use themed variables.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --test-name-pattern "theme|hover-bg" test/server.test.js`
Expected: all 4 new tests pass, plus the pre-existing "annotate switch shows a brass track..." test still passes unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/chrome.css test/server.test.js
git commit -m "feat: add lavish-light and swiss chrome theme palettes"
```

---

### Task 3: Wire theme resolution and markup into the server

**Files:**

- Modify: `src/server.js`
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: `CHROME_THEMES`, `DEFAULT_CHROME_THEME`, `isValidChromeTheme`, `resolveChromeTheme` from Task 1 (`src/chrome-themes.js`); `.theme-swatch`/`.swatch-dot` classes from Task 2 (`src/chrome.css`).
- Produces: `createChromeHtml(session, { layoutGateEnabled, annotate, theme })` — `theme` defaults to `DEFAULT_CHROME_THEME`. The rendered HTML has `<html data-lavish-theme="${theme}">`, a `"theme":"..."` field in the bootstrap JSON, and one `<button class="theme-swatch" id="theme-<id>" type="button" data-theme-value="<id>" aria-pressed="true|false">` per entry in `CHROME_THEMES`. `POST /api/sessions` accepts an optional `theme` field in the body and appends `?theme=<id>` to the returned session URL when it's a valid theme id. Task 4's `openCommand` sends this field; Task 5's chrome-client reads `data-theme-value` off these exact buttons.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js`:

```javascript
test("createChromeHtml defaults to the lavish-light theme", () => {
  const html = createChromeHtml({ key: "abc", file: "/tmp/artifact.html" });
  assert.match(html, /<html data-lavish-theme="lavish-light">/);
  assert.match(html, /"theme":"lavish-light"/);
});

test("createChromeHtml renders the requested theme", () => {
  const html = createChromeHtml({ key: "abc", file: "/tmp/artifact.html" }, { theme: "midnight" });
  assert.match(html, /<html data-lavish-theme="midnight">/);
  assert.match(html, /"theme":"midnight"/);
});

test("the overflow menu lists all three bundled themes with only the active one pressed", () => {
  const html = createChromeHtml({ key: "abc", file: "/tmp/artifact.html" }, { theme: "swiss" });
  assert.match(html, /id="theme-lavish-light" type="button" data-theme-value="lavish-light" aria-pressed="false"/);
  assert.match(html, /id="theme-midnight" type="button" data-theme-value="midnight" aria-pressed="false"/);
  assert.match(html, /id="theme-swiss" type="button" data-theme-value="swiss" aria-pressed="true"/);
});

test("a session defaults to the lavish-light theme end-to-end", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const artifact = path.join(dir, "artifact.html");
  await writeFile(artifact, "<!doctype html><html><body></body></html>");
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact }),
    });
    const body = await res.json();
    const chrome = await (await fetch(body.url)).text();
    assert.match(chrome, /<html data-lavish-theme="lavish-light">/);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("--theme opens a session with the requested theme for one open", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const artifact = path.join(dir, "artifact.html");
  await writeFile(artifact, "<!doctype html><html><body></body></html>");
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact, theme: "midnight" }),
    });
    const body = await res.json();
    assert.match(body.url, /[?&]theme=midnight/);
    const chrome = await (await fetch(body.url)).text();
    assert.match(chrome, /<html data-lavish-theme="midnight">/);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("an invalid theme in the session request is ignored, falling back to the default", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const artifact = path.join(dir, "artifact.html");
  await writeFile(artifact, "<!doctype html><html><body></body></html>");
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact, theme: "not-a-real-theme" }),
    });
    const body = await res.json();
    assert.doesNotMatch(body.url, /[?&]theme=/);
    const chrome = await (await fetch(body.url)).text();
    assert.match(chrome, /<html data-lavish-theme="lavish-light">/);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("LAVISH_AXI_THEME flips the default theme for new sessions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const artifact = path.join(dir, "artifact.html");
  await writeFile(artifact, "<!doctype html><html><body></body></html>");
  const previous = process.env.LAVISH_AXI_THEME;
  process.env.LAVISH_AXI_THEME = "swiss";
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact }),
    });
    const body = await res.json();
    const chrome = await (await fetch(body.url)).text();
    assert.match(chrome, /<html data-lavish-theme="swiss">/);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.LAVISH_AXI_THEME;
    else process.env.LAVISH_AXI_THEME = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "theme" test/server.test.js`
Expected: FAIL — `createChromeHtml` doesn't accept or render `theme` yet, and the routes don't resolve or forward it.

- [ ] **Step 3: Import the theme module**

In `src/server.js`, add this import alongside the existing local imports (after the `artifact-sdk.js` import, before `html-transform.js`, keeping the block alphabetical):

```javascript
import { CHROME_THEMES, DEFAULT_CHROME_THEME, isValidChromeTheme, resolveChromeTheme } from "./chrome-themes.js";
```

- [ ] **Step 4: Wire `POST /api/sessions`**

Find this existing block inside the `/api/sessions` handler:

```javascript
const annotateFlag = (req.body || {}).annotate;
if (isTruthyFlag(annotateFlag)) url = appendAnnotateParam(url, "1");
else if (isFalseyFlag(annotateFlag)) url = appendAnnotateParam(url, "0");
```

Add immediately after it:

```javascript
const themeFlag = (req.body || {}).theme;
if (typeof themeFlag === "string" && isValidChromeTheme(themeFlag)) url = appendThemeParam(url, themeFlag);
```

Then add a new helper function next to the existing `appendAnnotateParam`:

```javascript
function appendThemeParam(url, value) {
  const parsed = new URL(url);
  parsed.searchParams.set("theme", value);
  return parsed.toString();
}
```

- [ ] **Step 5: Wire `GET /session/:key`**

Find:

```javascript
res.type("html").send(
  createChromeHtml(session, {
    layoutGateEnabled: shouldEnableLayoutGate(req.query || {}),
    annotate: shouldEnableAnnotate(req.query || {}),
  }),
);
```

Replace with:

```javascript
res.type("html").send(
  createChromeHtml(session, {
    layoutGateEnabled: shouldEnableLayoutGate(req.query || {}),
    annotate: shouldEnableAnnotate(req.query || {}),
    theme: resolveChromeTheme(req.query || {}),
  }),
);
```

- [ ] **Step 6: Update `createChromeHtml`**

Change the function signature from:

```javascript
export function createChromeHtml(session, { layoutGateEnabled = true, annotate = false } = {}) {
```

to:

```javascript
export function createChromeHtml(session, { layoutGateEnabled = true, annotate = false, theme = DEFAULT_CHROME_THEME } = {}) {
```

In the same function, find:

```javascript
const sessionJson = jsonScript({
  key: session.key,
  file: session.file,
  initialChat: session.chat || [],
  layoutGateEnabled,
  annotate,
});
```

Add `theme,` after `annotate,`:

```javascript
const sessionJson = jsonScript({
  key: session.key,
  file: session.file,
  initialChat: session.chat || [],
  layoutGateEnabled,
  annotate,
  theme,
});
```

Immediately before the function's `return` statement, add the swatch markup builder:

```javascript
const themeSwatchesHtml = CHROME_THEMES.map(
  (t) =>
    `<button class="theme-swatch" id="theme-${t.id}" type="button" data-theme-value="${t.id}" aria-pressed="${t.id === theme ? "true" : "false"}"><span class="swatch-dot" data-swatch="${t.id}"></span><span>${escapeHtml(t.label)}</span></button>`,
).join("");
```

Then two edits to the returned template literal itself:

1. Change `<html>` to `<html data-lavish-theme="${theme}">` in the `<!doctype html>` line.
2. Find this substring inside the big single-line chrome markup (right after the Print / Save PDF button, before the final rule and End session button):

```
<button class="menu-item" id="printArtifact" type="button">${chromeIcons.printer}<span>Print / Save PDF</span></button><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">
```

Replace it with:

```
<button class="menu-item" id="printArtifact" type="button">${chromeIcons.printer}<span>Print / Save PDF</span></button><div class="menu-rule"></div><div class="menu-head"><div class="menu-label">Theme</div></div><div class="menu-themes" id="themeSwitcher" role="group" aria-label="Theme">${themeSwatchesHtml}</div><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">
```

(This brackets the new Theme section with the same two-rule pattern already used around the "Editing" header earlier in the menu — no other part of the template changes.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/server.test.js`
Expected: all tests pass, including the 7 new ones and every pre-existing test in the file (this route file has broad coverage — a passing full run is the real signal, not just the theme-scoped subset).

- [ ] **Step 8: Commit**

```bash
git add src/server.js test/server.test.js
git commit -m "feat: resolve and render the chrome theme server-side"
```

---

### Task 4: `--theme` CLI flag

**Files:**

- Modify: `src/cli.js`
- Test: `test/cli-output.test.js`

**Interfaces:**

- Consumes: the existing `flagValue(args, flag)` helper already defined in `src/cli.js` (used by `--timeout-ms`, `--port`).
- Produces: `resolveThemeFlag(args): string | undefined`, exported alongside `resolveAnnotateFlag`. `openCommand` sends `theme` in its POST body to `/api/sessions` (consumed by Task 3's server route).

- [ ] **Step 1: Write the failing tests**

Open `test/cli-output.test.js`. Find the import block that already includes `resolveAnnotateFlag` (around line 30) and add `resolveThemeFlag` to it:

```javascript
  resolveAnnotateFlag,
  resolveThemeFlag,
```

Append near the existing `resolveAnnotateFlag` tests (around line 941):

```javascript
test("resolveThemeFlag is undefined when no --theme flag is present", () => {
  assert.equal(resolveThemeFlag(["report.html"]), undefined);
});

test("resolveThemeFlag reads the value after --theme", () => {
  assert.equal(resolveThemeFlag(["--theme", "swiss", "report.html"]), "swiss");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "resolveThemeFlag" test/cli-output.test.js`
Expected: FAIL — `resolveThemeFlag` is not exported yet.

- [ ] **Step 3: Implement `resolveThemeFlag` and wire it into `openCommand`**

In `src/cli.js`, find:

```javascript
export function resolveAnnotateFlag(args) {
  if (args.includes("--no-annotate")) return false;
  if (args.includes("--annotate")) return true;
  return undefined;
}
```

Add immediately after it:

```javascript
export function resolveThemeFlag(args) {
  return flagValue(args, "--theme") || undefined;
}
```

In `openCommand`, find:

```javascript
const annotate = resolveAnnotateFlag(args);
const baseUrl = await ensureServer({ forceRestart: shouldForceRestartForLocalBuild(process.argv[1] || "") });
const response = await postJson(`${baseUrl}/api/sessions`, { file: absolute, noGate, annotate });
```

Replace with:

```javascript
const annotate = resolveAnnotateFlag(args);
const theme = resolveThemeFlag(args);
const baseUrl = await ensureServer({ forceRestart: shouldForceRestartForLocalBuild(process.argv[1] || "") });
const response = await postJson(`${baseUrl}/api/sessions`, { file: absolute, noGate, annotate, theme });
```

Finally, update the usage line inside `TOP_LEVEL_HELP` — find:

```
lavish-axi <html-file> [--no-open] [--no-gate]
```

Replace with:

```
lavish-axi <html-file> [--no-open] [--no-gate] [--theme <id>]
```

`TOP_LEVEL_HELP` has no existing per-flag explanation of `--no-gate` to append next to (that prose only lives in `CLAUDE.md`, not in this string) — add the new sentence as its own standalone addition immediately before the closing `\n\n${DESIGN_SYSTEM_HINT}`:

```
`--theme <id>` (or LAVISH_AXI_THEME) sets the chrome's visual theme for this open; valid ids are lavish-light (default), midnight, and swiss.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/cli-output.test.js`
Expected: all tests pass, including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/cli.js test/cli-output.test.js
git commit -m "feat: add --theme CLI flag"
```

---

### Task 5: Client-side switcher

**Files:**

- Modify: `src/chrome-client.js`
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: `sessionData.theme` (from Task 3's bootstrap JSON), `.theme-swatch` buttons with `data-theme-value` (from Task 3's markup).
- Produces: `document.documentElement.dataset.lavishTheme` kept in sync with the user's live selection; `sessionStorage` key `"lavish-axi:theme:" + key` remembers the choice for same-tab reloads.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js`:

```javascript
test("chrome-client applies the bootstrap theme and wires the theme switcher", async () => {
  const client = await chromeClientSource();
  assert.match(client, /const themeStorageKey = "lavish-axi:theme:" \+ key;/);
  assert.match(client, /document\.documentElement\.dataset\.lavishTheme = themeId;/);
  assert.match(client, /sessionStorage\.getItem\(themeStorageKey\)/);
  assert.match(client, /sessionStorage\.setItem\(themeStorageKey, value\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern "theme-client|theme switcher" test/server.test.js`
Expected: FAIL — none of this exists in `chrome-client.js` yet.

- [ ] **Step 3: Implement the switcher**

In `src/chrome-client.js`, find the line declaring `annotation`:

```javascript
let annotation = sessionData.annotate === true;
```

Add immediately after it:

```javascript
const themeStorageKey = "lavish-axi:theme:" + key;

function applyTheme(themeId) {
  document.documentElement.dataset.lavishTheme = themeId;
  document.querySelectorAll(".theme-swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeValue === themeId));
  });
}

function initTheme() {
  let themeId = typeof sessionData.theme === "string" ? sessionData.theme : "lavish-light";
  try {
    const stored = sessionStorage.getItem(themeStorageKey);
    if (stored) themeId = stored;
  } catch {
    // sessionStorage can be unavailable (e.g. private browsing); the
    // server-resolved theme from the bootstrap JSON still applies.
  }
  applyTheme(themeId);
}

initTheme();
```

Then, near the other button-wiring lines at the bottom of the file (next to `printArtifactButton.onclick = ...`), add:

```javascript
document.querySelectorAll(".theme-swatch").forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.themeValue;
    if (!value) return;
    applyTheme(value);
    try {
      sessionStorage.setItem(themeStorageKey, value);
    } catch {
      // Best-effort only; the theme still applies for the current page view.
    }
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.test.js`
Expected: all tests pass, including the new one and every pre-existing test in the file.

- [ ] **Step 5: Verify with a manual check**

Open a test artifact through the running dev CLI (`node bin/lavish-axi.js --no-open <some-artifact>.html`), navigate to the printed session URL in a real browser via Chrome DevTools MCP, open the overflow menu, and confirm: three swatches appear under a "Theme" label, "Lavish Light" starts pressed, clicking "Midnight" or "Swiss" instantly recolors the bar/menu/sidebar (not the artifact iframe), and reloading the tab (not a fresh `lavish-axi <file>` open) keeps the last-clicked theme.

- [ ] **Step 6: Commit**

```bash
git add src/chrome-client.js test/server.test.js
git commit -m "feat: wire the chrome theme switcher UI"
```

---

### Task 6: Close out the PRD entries

**Files:**

- Modify: `docs/prd-fork-features.md`

**Interfaces:**

- Consumes: nothing (docs only).
- Produces: nothing later tasks depend on. This is the plan's last task.

- [ ] **Step 1: Get the real commit range for this branch**

Run: `git log --oneline main..HEAD` (or `main..feat/chrome-theme-switcher` if not currently checked out on the branch) and note the branch name and the short hash of the last commit from Task 5 — you'll use both in Step 2.

- [ ] **Step 2: Mark Feature 1 done**

In `docs/prd-fork-features.md`, change the heading:

```
## Feature 1 — lavish-light as default theme + UI theme switcher
```

to:

```
## Feature 1 — lavish-light as default theme + UI theme switcher ✅ DONE
```

Immediately after that heading (before the existing `### Problem` section, which can stay as historical context), insert:

```markdown
### Status

Implemented on branch `feat/chrome-theme-switcher` (commit `<short-hash-from-step-1>`).

### What was built

- Three chrome themes — `lavish-light` (default), `midnight` (the original dark palette), `swiss` — as `:root[data-lavish-theme="..."]` CSS custom-property overrides in `src/chrome.css`, captured from the matching bundled artifact themes in `will-sargent-dbtlabs/lavish-themes`.
- Theming applies only to the chrome (bar, overflow menu, sidebar), never the artifact iframe, resolving the design tension recorded below.
- `CHROME_THEMES` / `resolveChromeTheme(query, env)` in a new `src/chrome-themes.js` (flag → env → `lavish-light` default).
- `--theme <id>` CLI flag and `LAVISH_AXI_THEME` env var, mirroring `--annotate`/`LAVISH_AXI_ANNOTATE`.
- A "Theme" row of swatch buttons in the overflow menu; clicking one updates `document.documentElement.dataset.lavishTheme` and a `sessionStorage` entry (never `~/.lavish-axi/state.json`) — session-only by design, so it resets on a fresh open but survives a same-tab reload.
```

- [ ] **Step 3: Mark Feature 3 done (missed when it actually shipped)**

Feature 3 (multi-page PDF / print) was implemented and merged via PR #4 before this feature, but its PRD entry was never updated. In the same file, change:

```
## Feature 3 — multi-page PDF / print
```

to:

```
## Feature 3 — multi-page PDF / print ✅ DONE
```

Immediately after that heading, insert:

```markdown
### Status

Implemented and merged to `main` via PR #4.

### What was built

Built close to the original proposal below, with two deliberate deviations found better during implementation:

- A `/print/:key` route family mirrors the existing `/artifact/:key` URL shape (`/print/:key`, `/print/:key/index.html`, `/print/:key/<path>`) instead of rewriting relative asset URLs to absolute — sibling assets resolve for free through the same `resolveArtifactAsset` helper the artifact route already uses.
- A new `injectPrintScript(html)` in `src/html-transform.js`, separate from `injectLavishSdk` (rather than a `{ sdk: false }` option on it) — the print route never calls `injectLavishSdk` at all, so there's no SDK/annotation/layout-audit machinery to strip.
- CSS-only-tabs dashboard artifacts needed a second, independent fix: printing doesn't change which tab's radio is checked, so an `@media print` override is now required in each such artifact (documented in the `dashboard` playbook's `design_rules` in `src/playbooks.js`).
```

- [ ] **Step 4: Prune the stale "Pending before any feature merge" checklist**

Find the section:

```markdown
## Pending before any feature merge

- [ ] Push `feat/annotate-off-by-default` to `origin` and open PR
- [ ] Decide: repoint lavish skill from `npx -y lavish-axi@0.1.31` to fork via `npm link` (do after all three features land, or sooner for annotate-off)
- [ ] Periodic upstream sync: `git fetch upstream && git log upstream/main ^HEAD --oneline` to review new commits
```

Replace the first line item (already done — annotate-off merged via PR #3) with a checked box, and leave the other two as open follow-ups since they're still genuinely unresolved:

```markdown
## Pending before any feature merge

- [x] Push `feat/annotate-off-by-default` to `origin` and open PR (merged via PR #3)
- [ ] Decide: repoint lavish skill from `npx -y lavish-axi@0.1.31` to fork via `npm link` (all three planned features have now landed)
- [ ] Periodic upstream sync: `git fetch upstream && git log upstream/main ^HEAD --oneline` to review new commits
```

Also update the `_Last updated:_` line at the bottom of the file to today's date.

- [ ] **Step 5: Commit**

```bash
git add docs/prd-fork-features.md
git commit -m "docs: mark the theme switcher and print features done in the PRD"
```

---

## Self-Review

- **Spec coverage:** PRD Goal 1 (lavish-light as default) → Tasks 2 & 3. PRD Goal 2 (switch from the overflow menu without re-running the agent) → Tasks 3 & 5. The confirmed design choices (inline CSS not `dist/themes/`, session-only not `state.json`) → Task 2 (inline in `chrome.css`) and Task 5 (`sessionStorage`, no new POST endpoint for switching). The PRD's "Where do bundled theme shells live" open question is resolved by Task 2 (inline CSS custom properties, not full HTML shell reuse — the chrome's existing layout stays; only its palette is themed, per the PRD's own recorded design-tension resolution).
- **Placeholder scan:** no TBD/TODO; the one deferred value (a commit hash in Task 6) is filled by a concrete `git log` command in that task's own Step 1, not left blank.
- **Type/name consistency:** `theme` flows as a plain string end to end — CLI flag value → POST body field → query param → `resolveChromeTheme` return value → `createChromeHtml` option → bootstrap JSON field → `data-lavish-theme` attribute → `sessionData.theme` → `document.documentElement.dataset.lavishTheme`. Same three ids (`lavish-light`, `midnight`, `swiss`) are used verbatim in `CHROME_THEMES`, the CSS attribute selectors, the swatch button ids/`data-theme-value`, and every test.
