# Content Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reviewer live-switch the _artifact's own_ visual theme (not just the chrome around it) when the artifact opts in, and export the currently-displayed look as a standalone, fully portable HTML file.

**Architecture:** Unlike the chrome (one codebase, one CSS variable scheme — see the already-shipped chrome theme switcher), artifact content is arbitrary agent-authored HTML with no shared scheme across the bundled theme library (confirmed by inspection: `terminal`, `water`, `zine`, `handwritten`, `latex`, `dbt-brief`, and `lavish-light`/`swiss` all use different custom-property names and structural markup). So this feature is an **opt-in contract**, not a lavish-axi-side registry: an artifact that wants live re-theming declares its own swappable palettes as a small JSON manifest plus `:root[data-lavish-content-theme="..."]` CSS override blocks — the exact same technique already proven for the chrome in `src/chrome.css`. The Lavish artifact SDK (`src/artifact-sdk.js`, runs inside the sandboxed iframe) detects that manifest, reports it to the chrome over `postMessage`, and applies theme switches by setting a `data-lavish-content-theme` attribute on the iframe's own `<html>` — a same-document DOM mutation, not a same-origin violation. The chrome (`src/chrome-client.js`) renders a menu section only when an artifact reports themes, and offers a client-side "Export standalone copy" action that asks the SDK for a full `outerHTML` snapshot and downloads it as a `Blob` — no new server route, no filesystem writes from the tool itself.

**Tech Stack:** Plain `postMessage`, CSS custom properties, `Blob`/`URL.createObjectURL` for the download. No new npm dependencies.

## Global Constraints

- The mechanism must be fully generic: lavish-axi must not hardcode theme ids, palettes, or the `lavish-light`/`swiss` pair anywhere in `src/`. It only knows how to read a manifest an artifact provides and relay `postMessage`s.
- The sandboxed iframe (`sandbox="allow-scripts allow-forms allow-popups allow-downloads"`, no `allow-same-origin`) means the chrome can never read or write the iframe's DOM directly — every interaction is `postMessage` request/reply, mirroring the existing `lavish:requestSnapshot`/`lavish:snapshot` pattern in `src/artifact-sdk.js` and `src/chrome-client.js`.
- Content theme choice is session-only, exactly like the chrome theme: a `sessionStorage` entry, never written to `~/.lavish-axi/state.json`.
- Export must work with zero server involvement: a client-side `Blob` download triggered from the chrome's top-level page (which is not sandboxed), per the confirmed design choice.
- No new npm dependencies.
- `pnpm run check` (build, lint, format, typecheck, tests, skill-freshness) must pass after every lavish-axi task.
- Existing chrome/SDK behavior (annotate switch, chrome theme switcher, print route, layout gate, DOM snapshot, layout audit) must be unchanged — this feature is fully additive.
- A theme that never declares a `#lavish-content-themes` manifest sees no new UI at all — the menu section stays hidden.

---

## File Structure

- Modify: `src/artifact-sdk.js` (in `will-sargent-dbtlabs/lavish-axi`) — read an optional `#lavish-content-themes` JSON manifest, report it (and the current selection) to the chrome on load, apply `lavish:setContentTheme` by setting `document.documentElement.dataset.lavishContentTheme`, and reply to `lavish:requestContentExport` with a full `outerHTML` snapshot.
- Modify: `src/server.js` — one-line addition: a hidden placeholder `<div id="contentThemeSection" hidden></div>` in the overflow menu markup for the chrome to populate dynamically. No new `createChromeHtml` option.
- Modify: `src/chrome-client.js` — listen for `lavish:contentThemes`/`lavish:contentExport`, render the content-theme swatches and the "Export standalone copy" button into the placeholder, wire clicks to `postToFrame`, remember the pick in `sessionStorage`, and trigger the `Blob` download.
- Modify: `test/server.test.js` — TDD for all of the above (this file already covers both `createChromeHtml` and `chromeClientSource()`/`createSdkJs()` text-regex assertions, matching the existing pattern for the chrome theme switcher and the annotate switch).
- Modify (different repo): `will-sargent-dbtlabs/lavish-themes`'s `tier2/lavish-light.html` and `tier2/swiss.html` — the first reference implementation of the opt-in contract, since these two already share a compatible variable scheme (`--paper`/`--ink`/`--red`/`--rule`/`--muted`).
- Modify (different repo): `docs/prd-fork-features.md` (in `lavish-axi`) — a new "Feature 4" entry for this work, plus a lightweight "Feature 5 (future, not started)" stub capturing the deferred idea of retrofitting all 8 bundled themes onto one shared variable scheme (from this session's design discussion — not being built now).
- Modify (user-level config, not a repo): `~/.claude/skills/lavish/SKILL.md` — a short addition to the existing `## Themes` section telling future agents how to make a theme they build opt into live content re-theming.

---

### Task 1: Artifact SDK — detect, apply, and export content themes

**Files:**

- Modify: `src/artifact-sdk.js`
- Test: `test/server.test.js` (uses the existing `createSdkJs` import already present in this file)

**Interfaces:**

- Consumes: nothing new from other tasks.
- Produces: three `postMessage` contracts the chrome (Task 2) relies on by exact string:
  - SDK → chrome, sent once on load, only if a manifest exists: `{ type: "lavish:contentThemes", themes: [{id, label}, ...], current: string }` (`current` is `""` when no override has been applied yet).
  - chrome → SDK: `{ type: "lavish:setContentTheme", id: string }` — SDK sets `document.documentElement.dataset.lavishContentTheme = id`.
  - chrome → SDK: `{ type: "lavish:requestContentExport" }` → SDK replies `{ type: "lavish:contentExport", html: string }` where `html` is `"<!doctype html>\n" + document.documentElement.outerHTML`.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js` (near the existing "artifact SDK ..." tests, which already import and call `createSdkJs` from `../src/server.js`):

```javascript
test("artifact SDK posts its declared content themes and current selection to the chrome", () => {
  const js = createSdkJs("abc");
  assert.match(js, /getElementById\("lavish-content-themes"\)/);
  assert.match(js, /parent\.postMessage\(\{ type: "lavish:contentThemes", themes, current \}, "\*"\)/);
});

test("artifact SDK does not post content themes when no manifest is declared", () => {
  const js = createSdkJs("abc");
  assert.match(js, /if \(!themes\.length\) return;/);
});

test("artifact SDK applies a requested content theme by setting the root data attribute", () => {
  const js = createSdkJs("abc");
  assert.match(js, /msg\.type === "lavish:setContentTheme" && typeof msg\.id === "string"/);
  assert.match(js, /document\.documentElement\.dataset\.lavishContentTheme = msg\.id;/);
});

test("artifact SDK exports a full standalone HTML snapshot on request", () => {
  const js = createSdkJs("abc");
  assert.match(js, /msg\.type === "lavish:requestContentExport"/);
  assert.match(js, /const html = "<!doctype html>\\n" \+ document\.documentElement\.outerHTML;/);
  assert.match(js, /parent\.postMessage\(\{ type: "lavish:contentExport", html \}, "\*"\)/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "content theme" test/server.test.js`
Expected: FAIL — none of this exists in `artifact-sdk.js` yet.

- [ ] **Step 3: Implement detection and reporting**

In `src/artifact-sdk.js`, find the `snapshot()` function (search for `function snapshot() {`). Add these two new functions directly above it:

```javascript
function readContentThemes() {
  const script = document.getElementById("lavish-content-themes");
  if (!script) return [];
  try {
    const parsed = JSON.parse(script.textContent || "[]");
    return Array.isArray(parsed) ? parsed.filter((theme) => theme && typeof theme.id === "string") : [];
  } catch {
    return [];
  }
}

function reportContentThemes() {
  const themes = readContentThemes();
  if (!themes.length) return;
  const current = document.documentElement.dataset.lavishContentTheme || "";
  parent.postMessage({ type: "lavish:contentThemes", themes, current }, "*");
}
```

- [ ] **Step 4: Wire the message handler and the initial report**

Find the existing message listener (search for `window.addEventListener("message", (event) => {`):

```javascript
window.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "lavish:setAnnotationMode") setAnnotationMode(msg.enabled);
  if (msg.type === "lavish:requestSnapshot") {
    parent.postMessage({ type: "lavish:snapshot", snapshot: snapshot() }, "*");
  }
  if (msg.type === "lavish:restoreScroll") {
    window.scrollTo(Number(msg.x) || 0, Number(msg.y) || 0);
  }
});
```

Replace with:

```javascript
window.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "lavish:setAnnotationMode") setAnnotationMode(msg.enabled);
  if (msg.type === "lavish:requestSnapshot") {
    parent.postMessage({ type: "lavish:snapshot", snapshot: snapshot() }, "*");
  }
  if (msg.type === "lavish:restoreScroll") {
    window.scrollTo(Number(msg.x) || 0, Number(msg.y) || 0);
  }
  if (msg.type === "lavish:setContentTheme" && typeof msg.id === "string") {
    document.documentElement.dataset.lavishContentTheme = msg.id;
  }
  if (msg.type === "lavish:requestContentExport") {
    const html = "<!doctype html>\n" + document.documentElement.outerHTML;
    parent.postMessage({ type: "lavish:contentExport", html }, "*");
  }
});

reportContentThemes();
```

(The `reportContentThemes();` call sits right after the message listener is registered, so a theme picked before this line ran can never race with it — there's nothing async in `readContentThemes`/`reportContentThemes`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/server.test.js`
Expected: all tests pass, including the 4 new ones and every pre-existing test in the file.

- [ ] **Step 6: Commit**

```bash
git add src/artifact-sdk.js test/server.test.js
git commit -m "feat: SDK support for opt-in content theme manifests"
```

---

### Task 2: Chrome-side content-theme menu, live switching, and standalone export

**Files:**

- Modify: `src/server.js`
- Modify: `src/chrome-client.js`
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: the three `postMessage` contracts from Task 1.
- Produces: a `<div id="contentThemeSection" hidden></div>` placeholder in the chrome markup (Task 1 has no dependency on this; it's purely for this task and its own tests), populated by `renderContentThemeSection(themes, current)` in `chrome-client.js`. Nothing later depends on this task's internals — it's the end of the user-facing feature.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js`:

```javascript
test("chrome reserves a hidden placeholder for the dynamically-populated content-theme menu section", () => {
  const html = createChromeHtml({ key: "abc", file: "/tmp/artifact.html" });
  assert.match(html, /<div id="contentThemeSection" hidden><\/div>/);
});

test("chrome-client renders a content-theme section and wires clicks when the artifact reports one", async () => {
  const client = await chromeClientSource();
  assert.match(client, /msg\.type === "lavish:contentThemes"/);
  assert.match(client, /function renderContentThemeSection\(themes, current\)/);
  assert.match(client, /postToFrame\(\{ type: "lavish:setContentTheme", id: value \}\)/);
  assert.match(client, /sessionStorage\.setItem\(contentThemeStorageKey, value\)/);
});

test("chrome-client restores a stored content theme choice after an artifact reload", async () => {
  const client = await chromeClientSource();
  assert.match(client, /sessionStorage\.getItem\(contentThemeStorageKey\)/);
  assert.match(client, /postToFrame\(\{ type: "lavish:setContentTheme", id: current \}\)/);
});

test("chrome-client downloads a themed export as a Blob when the artifact replies with content", async () => {
  const client = await chromeClientSource();
  assert.match(client, /msg\.type === "lavish:contentExport"/);
  assert.match(client, /new Blob\(\[html\], \{ type: "text\/html" \}\)/);
  assert.match(client, /link\.download = themedFileBaseName\(\) \+ "-themed\.html";/);
});

test("the export button requests a content export from the artifact", async () => {
  const client = await chromeClientSource();
  assert.match(client, /postToFrame\(\{ type: "lavish:requestContentExport" \}\)/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "content-theme|content export|themed" test/server.test.js`
Expected: FAIL — none of this exists yet.

- [ ] **Step 3: Add the placeholder in `src/server.js`**

Find this substring inside `createChromeHtml`'s template (immediately after the chrome theme section added by the earlier theme-switcher feature):

```
<div class="menu-themes" id="themeSwitcher" role="group" aria-label="Theme">${themeSwatchesHtml}</div><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">
```

Replace with:

```
<div class="menu-themes" id="themeSwitcher" role="group" aria-label="Theme">${themeSwatchesHtml}</div><div id="contentThemeSection" hidden></div><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">
```

- [ ] **Step 4: Add the DOM refs and storage key in `src/chrome-client.js`**

Find the line declaring `themeStorageKey` (added by the earlier chrome theme switcher feature):

```javascript
const themeStorageKey = "lavish-axi:theme:" + key;
```

Add immediately after the `initTheme();` call that follows it (search for `initTheme();`):

```javascript
const contentThemeSection = /** @type {HTMLDivElement} */ (document.getElementById("contentThemeSection"));
const contentThemeStorageKey = "lavish-axi:content-theme:" + key;

function themedFileBaseName() {
  const name = filePath.split("/").pop() || "artifact.html";
  return name.replace(/\.html?$/i, "");
}

function downloadThemedCopy(html) {
  if (!html) return;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = themedFileBaseName() + "-themed.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderContentThemeSection(themes, current) {
  const buttonsHtml = themes
    .map(
      (theme) =>
        `<button class="theme-swatch" type="button" data-content-theme-value="${escapeHtml(theme.id)}" aria-pressed="${theme.id === current ? "true" : "false"}">${escapeHtml(theme.label || theme.id)}</button>`,
    )
    .join("");
  contentThemeSection.innerHTML =
    '<div class="menu-head"><div class="menu-label">Content Theme</div></div><div class="menu-themes" role="group" aria-label="Content theme">' +
    buttonsHtml +
    '</div><button class="menu-item" id="exportThemedCopy" type="button"><span>Export standalone copy</span></button>';
  contentThemeSection.hidden = false;

  contentThemeSection.querySelectorAll(".theme-swatch").forEach((element) => {
    const button = /** @type {HTMLElement} */ (element);
    button.addEventListener("click", () => {
      const value = button.dataset.contentThemeValue;
      if (!value) return;
      postToFrame({ type: "lavish:setContentTheme", id: value });
      contentThemeSection.querySelectorAll(".theme-swatch").forEach((el) => {
        el.setAttribute("aria-pressed", String(el === button));
      });
      try {
        sessionStorage.setItem(contentThemeStorageKey, value);
      } catch {
        // Best-effort only; the theme still applies for the current page view.
      }
    });
  });

  const exportButton = /** @type {HTMLButtonElement} */ (document.getElementById("exportThemedCopy"));
  exportButton.onclick = () => postToFrame({ type: "lavish:requestContentExport" });
}
```

(There is no icon SVG on `#exportThemedCopy` unlike the server-rendered menu items — this button is built entirely client-side and duplicating the server's inline SVG icon strings here isn't worth the upkeep cost for one button. It's a plain text menu item, which the existing `.menu-item` CSS already supports without an icon.)

- [ ] **Step 5: Wire the two new message types**

Find the message listener in `src/chrome-client.js` (search for `if (msg.type === "lavish:endSession") endSession();`, the last line inside that listener):

```javascript
  if (msg.type === "lavish:sendQueuedPrompts") sendQueued();
  if (msg.type === "lavish:endSession") endSession();
});
```

Replace with:

```javascript
  if (msg.type === "lavish:sendQueuedPrompts") sendQueued();
  if (msg.type === "lavish:endSession") endSession();
  if (msg.type === "lavish:contentThemes") {
    let current = typeof msg.current === "string" ? msg.current : "";
    try {
      const stored = sessionStorage.getItem(contentThemeStorageKey);
      if (stored) current = stored;
    } catch {
      // Ignore; fall back to the artifact-reported current theme.
    }
    renderContentThemeSection(Array.isArray(msg.themes) ? msg.themes : [], current);
    if (current && current !== msg.current) {
      postToFrame({ type: "lavish:setContentTheme", id: current });
    }
  }
  if (msg.type === "lavish:contentExport") {
    downloadThemedCopy(String(msg.html || ""));
  }
});
```

(The `current !== msg.current` re-apply only fires when a stored pick differs from the artifact's own freshly-loaded default — exactly mirroring how the chrome's own `initTheme()` restores a `sessionStorage` pick after a hot reload, so a reviewer's content-theme choice survives a live-reload of the artifact file, not just a page-level chrome reload.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/server.test.js`
Expected: all tests pass, including the 5 new ones and every pre-existing test in the file.

- [ ] **Step 7: Run the full check**

Run: `pnpm run check`
Expected: exits 0 (build, lint, format, typecheck, tests, skill-freshness all pass).

- [ ] **Step 8: Commit**

```bash
git add src/server.js src/chrome-client.js test/server.test.js
git commit -m "feat: chrome-side content theme switcher and standalone export"
```

---

### Task 3: Reference implementation — `lavish-light` ↔ `swiss`

**Files:**

- Modify: `tier2/lavish-light.html` (in `will-sargent-dbtlabs/lavish-themes`)
- Modify: `tier2/swiss.html` (in `will-sargent-dbtlabs/lavish-themes`)

**Interfaces:**

- Consumes: the `#lavish-content-themes` manifest contract and `data-lavish-content-theme` attribute contract from Task 1 — this task is the first real proof that the contract works end to end.
- Produces: nothing later tasks import, but Task 4's docs reference these two files by name as the worked example.

Both files already share `--paper`/`--ink`/`--red`/`--rule`/`--muted`. `lavish-light.html` additionally declares `--line` (used in 4 `border-*` declarations across 3 selectors — `header.masthead`, `table`, `footer.colophon`) that `swiss.html` does not have — its override block must supply a `--line` value too, or those borders silently disappear under the swiss override (an invalid `var()` with no fallback drops the whole declaration, not just that one property).

- [ ] **Step 1: Verify the variable-compatibility claim before writing any CSS**

Run, from the `will-sargent-dbtlabs/lavish-themes` repo root:

```bash
grep -o 'var(--[a-z-]*)' tier2/lavish-light.html | sort -u
grep -o 'var(--[a-z-]*)' tier2/swiss.html | sort -u
```

Expected: `lavish-light.html` lists `var(--ink)`, `var(--line)`, `var(--muted)`, `var(--paper)`, `var(--red)`, `var(--rule)`. `swiss.html` lists the same set minus `var(--line)`. If either file references any other variable, stop and add it to both override blocks below before continuing — do not proceed with an incomplete cross-check.

- [ ] **Step 2: Add the manifest and override block to `lavish-light.html`**

Find (near the top of the file — note there is no blank line between `</style>` and `</head>`):

```html
</style>
</head>
<body>
```

Replace with:

```html
</style>
<style>
  :root[data-lavish-content-theme="swiss"] {
    --paper: #fafaf7;
    --ink:   #0a0a0a;
    --red:   #e30613;
    --rule:  #0a0a0a;
    --line:  #0a0a0a;
    --muted: #5a5a55;
  }
</style>
<script type="application/json" id="lavish-content-themes">
[
  {"id": "lavish-light", "label": "Lavish Light"},
  {"id": "swiss", "label": "Swiss"}
]
</script>
</head>
<body>
```

- [ ] **Step 3: Add the manifest and override block to `swiss.html`**

Find the same substring in `swiss.html` (also no blank line between `</style>` and `</head>`):

```html
</style>
</head>
<body>
```

Replace with:

```html
</style>
<style>
  :root[data-lavish-content-theme="lavish-light"] {
    --paper: #fcfcfa;
    --ink:   #2b2b2b;
    --red:   #e30613;
    --rule:  #d6d6d0;
    --muted: #6b6b66;
  }
</style>
<script type="application/json" id="lavish-content-themes">
[
  {"id": "lavish-light", "label": "Lavish Light"},
  {"id": "swiss", "label": "Swiss"}
]
</script>
</head>
<body>
```

(`swiss.html` never references `var(--line)`, so its override block for `lavish-light` doesn't need to define one.)

- [ ] **Step 4: Verify live in a real browser**

From `will-sargent-dbtlabs/lavish-axi`, run `node bin/lavish-axi.js --no-open /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/lavish-light.html`, open the printed session URL via Chrome DevTools MCP, open the overflow menu, and confirm:

- A "Content Theme" section appears with "Lavish Light" and "Swiss" swatches, "Lavish Light" pressed by default.
- Clicking "Swiss" instantly recolors the artifact content (inside the iframe) to near-black ink and hairlines, while the chrome around it is unaffected.
- Clicking "Export standalone copy" triggers a file download named `lavish-light-themed.html`.
- Opening the downloaded file directly (`file://` URL, no Lavish server running) renders identically to the live "Swiss"-selected view — confirming the exported copy is genuinely standalone.
- Reload the browser tab (not a fresh `lavish-axi` open) and confirm "Swiss" is still selected, proving the `sessionStorage` restore path works for content themes the same way it does for chrome themes.

- [ ] **Step 5: Commit and push**

```bash
git add tier2/lavish-light.html tier2/swiss.html
git commit -m "feat: opt lavish-light and swiss into live content re-theming"
git push
```

(This repo's established workflow is direct commits to `main` — no PR needed, matching how the `dbt-brief`/`dbt-brief-dashboard` themes were added earlier in this project.)

---

### Task 4: Documentation

**Files:**

- Modify: `docs/prd-fork-features.md` (in `will-sargent-dbtlabs/lavish-axi`)
- Modify: `~/.claude/skills/lavish/SKILL.md`
- Run: `bash ~/.claude/skills/lavish/themes/refresh.sh` (syncs the bundled theme cache from the `lavish-themes` fork)

**Interfaces:**

- Consumes: nothing (docs only).
- Produces: nothing later tasks depend on — this is the plan's last task.

- [ ] **Step 1: Add a "Feature 4" entry to the PRD**

In `docs/prd-fork-features.md`, find the `## Pending before any feature merge` heading and insert this new section immediately before it (after Feature 3's section):

```markdown
## Feature 4 — live content re-theming + standalone export ✅ DONE

### Status

Implemented on branch `feat/content-theme-switcher`.

### What was built

Content theming is an **opt-in contract**, not a lavish-axi-side registry — the tool has no hardcoded knowledge of any theme's palette. An artifact declares its own swappable palettes via a `#lavish-content-themes` JSON manifest plus `:root[data-lavish-content-theme="..."]` CSS override blocks (the same technique proven in `src/chrome.css` for the chrome itself). `src/artifact-sdk.js` detects the manifest and reports it to the chrome, applies switches by setting a `data-lavish-content-theme` attribute inside the sandboxed iframe, and replies to an export request with a full `outerHTML` snapshot. `src/chrome-client.js` renders a "Content Theme" menu section only when an artifact opts in, remembers the pick in `sessionStorage` (never `state.json`), and offers "Export standalone copy" — a client-side `Blob` download, no server route involved. `lavish-light` and `swiss` in `will-sargent-dbtlabs/lavish-themes` are the first reference implementation, since they already share a compatible variable scheme.

## Feature 5 — retrofit all bundled themes onto one shared variable scheme (future, not started)

### Problem

Feature 4's live re-theming only works between themes that happen to share both a CSS variable contract and compatible structural markup. Today that's just the `lavish-light`/`swiss` pair. The other six bundled themes (`terminal`, `water`, `zine`, `handwritten`, `latex`, `dbt-brief`/`dbt-brief-dashboard`) each use entirely different variable names and DOM structure, so they can't participate without a rewrite.

### Idea (not scoped or started)

Rename every bundled theme's CSS custom properties in `will-sargent-dbtlabs/lavish-themes` onto one shared, role-based set (e.g. `--paper`/`--ink`/`--accent`/`--muted`/`--rule`), so any theme built from the bundled library becomes a candidate for cross-family live switching via Feature 4's existing mechanism — no changes needed to `lavish-axi` itself. This is a content-authoring investment, not a lavish-axi engineering task: it touches up to 8 theme files, needs careful visual regression checking per theme (screenshot before/after), and risks changing a theme's character if a role-based rename forces a design compromise a theme wasn't built to make (e.g. `zine`'s `--yellow`/`--magenta`/`--cyan` palette doesn't map cleanly onto a `paper`/`ink`/`accent` role scheme without flattening what makes it a "loud" theme). Deferred until there's a concrete need for cross-family switching beyond the `lavish-light`/`swiss` pair.
```

- [ ] **Step 2: Update the PRD's last-updated line**

Find `_Last updated: 2026-07-01_` and update it to today's date using: `date +%Y-%m-%d`.

- [ ] **Step 3: Add authoring guidance to the lavish skill**

In `~/.claude/skills/lavish/SKILL.md`, find this sentence at the end of the `## Themes` section:

```
Because the shells set `lavish-design: off`, do **not** also apply Tailwind/DaisyUI when using a theme - they are mutually exclusive. Tier-2 themes (`lavish-light`, `swiss`, `handwritten`, `zine`) load Google Fonts via CDN (fine when online); the rest are fully offline. Refresh the bundle from the source fork with `bash ~/.claude/skills/lavish/themes/refresh.sh`.
```

Add immediately after it (still inside `## Themes`):

**Content theme switching (optional).** If you want the reviewer to be able to live-switch the artifact's own look (not just the Lavish chrome around it) and export a themed standalone copy, declare a `#lavish-content-themes` JSON manifest and one `:root[data-lavish-content-theme="<id>"]` CSS override block per alternate palette, using the exact variable names your base `:root` already declares. `lavish-light.html`/`swiss.html` are the reference pair - copy their pattern rather than inventing a new one. This only works between themes that already share a variable scheme and structural markup; don't promise a live switch between two bundled themes that weren't built as a compatible pair.

- [ ] **Step 4: Sync the bundled theme cache**

Run:

```bash
bash ~/.claude/skills/lavish/themes/refresh.sh
```

Expected output lists all 9 theme files, including the updated `lavish-light.html` and `swiss.html`.

- [ ] **Step 5: Verify no drift**

Run:

```bash
diff /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/lavish-light.html ~/.claude/skills/lavish/themes/lavish-light.html
diff /Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/swiss.html ~/.claude/skills/lavish/themes/swiss.html
```

Expected: no output from either command (files identical).

- [ ] **Step 6: Commit the lavish-axi PRD change**

```bash
cd /Users/operator/code/will-sargent-dbtlabs/lavish-axi
git add docs/prd-fork-features.md
git commit -m "docs: record the content theme switcher (and defer the all-themes retrofit)"
```

(`~/.claude/skills/lavish/SKILL.md` is a personal config file, not part of any git repo in this plan - it has no separate commit step.)

---

## Self-Review

- **Spec coverage:** the user's ask was "re-theme the live content" (Tasks 1-3) plus "export a standalone copy" (Tasks 1-2, the `lavish:requestContentExport`/Blob-download path) plus the deferred "plan 3" (the all-themes retrofit, captured as Feature 5 in Task 4 - explicitly not built, per the user's own framing of it as a later planning item, not a build item).
- **Placeholder scan:** no TBD/TODO. Task 3's "future, not started" section is not a placeholder for undone work in _this_ plan - it's the deliberately-deferred idea being written down, with its own explicit non-scope stated.
- **Type/name consistency:** the three message types (`lavish:contentThemes`, `lavish:setContentTheme`, `lavish:requestContentExport`/`lavish:contentExport`) and the `{id, label}` theme-entry shape are used identically across Task 1 (SDK), Task 2 (chrome), Task 3 (the two reference theme files' manifests), and every test.
