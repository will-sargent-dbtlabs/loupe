# Print Full Artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Print / Save PDF" from the Lavish Editor chrome capture the artifact's full content — all pages, all CSS-only tab panels — instead of a single truncated viewport of the sandboxed iframe.

**Architecture:** Two independent root causes, both must be fixed:

1. **Iframe truncation** — the artifact `<iframe>` is sandboxed without `allow-same-origin`, and browsers cannot paginate a cross-origin-equivalent iframe's content across print pages. Fix: a new `/print/:key` route serves the artifact as its own top-level page (mirroring the existing `/artifact/:key` URL shape exactly, so relative asset paths resolve with zero rewriting), with a small injected script that calls `window.print()` once loaded. The chrome's overflow menu opens this URL in a new tab via `window.open()`.
2. **Tab-panel visibility** — this only matters for artifacts using the CSS-only-tabs pattern (`display: none` on inactive `.tab-panel`s, toggled by `:has()`). Printing a page does not change which panels are visible, so without an artifact-side `@media print` override, the printed output still only shows whichever tab happens to be checked. This is fixed in the artifact's own CSS, not in lavish-axi — lavish-axi's job is only to document the requirement in the `dashboard` playbook and to fix the two dashboard-mode artifacts that already exist and would otherwise silently violate it.

**Tech Stack:** Express (existing `src/server.js` routing), no new dependencies. No Puppeteer/Playwright — this reuses the browser's own native print/PDF pipeline against a plain top-level HTML page.

## Global Constraints

- No new dependencies (PRD requirement: "without adding a heavy headless-browser dependency (no Puppeteer, no Playwright)").
- The print route must reuse `resolveArtifactAsset` for sibling-asset resolution rather than rewriting `src=`/`href=` attributes in the HTML — this is a deliberate deviation from the original PRD's "rewrite relative URLs to absolute" proposal, chosen because mirroring the existing `/artifact/:key/<path>` URL shape at `/print/:key/<path>` makes relative paths resolve correctly for free, with no regex-based HTML rewriting and no new failure mode for attributes the rewrite might miss (`srcset`, inline `<style>` `url()`, etc.).
- `pnpm run check` (build, lint, format, typecheck, tests, skill freshness) must pass after every task.
- Existing default behavior (`/artifact/:key/...`, the chrome's iframe, `injectLavishSdk`) must be unchanged — the print route is fully additive.

---

## File Structure

- Modify: `src/html-transform.js` — add `injectPrintScript(html)`, a sibling to the existing `injectLavishSdk(html, key)`, same append-before-`</body>` strategy, no SDK/annotation/layout-audit machinery.
- Modify: `src/server.js` — three new routes mirroring the existing `/artifact/:key*` routes (`/print/:key` redirect, `/print/:key/index.html`, `/print/:key/<path>` assets), one new `chromeIcons.printer` icon, one new menu button in `createChromeHtml()`.
- Modify: `src/chrome-client.js` — wire the new button's `onclick` to `window.open`.
- Modify: `test/html-transform.test.js` — TDD for `injectPrintScript`.
- Modify: `test/server.test.js` — TDD for the three new routes and the new chrome markup.
- Modify (different repo): `/Users/operator/code/dbt-labs/resident-architect-skills/skills/ps-operational/skills/build-ra-customer-briefing/assets/dashboard_template.html.j2` — add `@media print` override so all ten tabs print.
- Modify (different repo): `/Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/dbt-brief-dashboard.html` — same override, since it's the reference implementation the `dashboard` playbook points to.
- Modify (this repo, different file): `src/playbooks.js` — add a `design_rules` entry to the `dashboard` playbook requiring this override on every CSS-only-tabs artifact.

---

### Task 1: `injectPrintScript` in html-transform.js

**Files:**

- Modify: `src/html-transform.js`
- Test: `test/html-transform.test.js`

**Interfaces:**

- Consumes: nothing new.
- Produces: `injectPrintScript(html: string): string` — exported alongside `injectLavishSdk`. Task 3 imports this into `src/server.js`.

- [ ] **Step 1: Write the failing tests**

Append to `test/html-transform.test.js`:

```javascript
import { injectLavishSdk, injectPrintScript } from "../src/html-transform.js";

test("injects an auto-print script before the closing body tag", () => {
  const html = "<!doctype html><html><body><h1>Hi</h1></body></html>";
  const result = injectPrintScript(html);

  assert.match(
    result,
    /<script>window\.addEventListener\("DOMContentLoaded",\(\)=>window\.print\(\)\);<\/script><\/body>/,
  );
});

test("print script leaves the rest of the document untouched", () => {
  const html = "<!doctype html><html><head><title>Hi</title></head><body><h1>Hi</h1></body></html>";
  const result = injectPrintScript(html);

  assert.equal(
    result,
    '<!doctype html><html><head><title>Hi</title></head><body><h1>Hi</h1><script>window.addEventListener("DOMContentLoaded",()=>window.print());</script></body></html>',
  );
});

test("print script appends at end of document when there is no body tag", () => {
  const result = injectPrintScript("<h1>Hi</h1>");

  assert.equal(result, '<h1>Hi</h1>\n<script>window.addEventListener("DOMContentLoaded",()=>window.print());</script>');
});
```

Update the existing top-of-file import (currently `import { injectLavishSdk } from "../src/html-transform.js";`) to also import `injectPrintScript`, as shown above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/html-transform.test.js`
Expected: 3 new failures with `injectPrintScript is not defined` or similar (the export does not exist yet).

- [ ] **Step 3: Implement `injectPrintScript`**

In `src/html-transform.js`, add below the existing `injectLavishSdk`:

```javascript
export function injectPrintScript(html) {
  const script = `<script>window.addEventListener("DOMContentLoaded",()=>window.print());</script>`;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${script}</body>`);
  }
  return `${html}\n${script}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/html-transform.test.js`
Expected: all tests pass, including the 3 new ones and the pre-existing `injectLavishSdk` tests (unchanged, still passing).

- [ ] **Step 5: Commit**

```bash
git add src/html-transform.js test/html-transform.test.js
git commit -m "feat: add injectPrintScript for auto-triggering window.print()"
```

---

### Task 2: `/print/:key` routes in server.js

**Files:**

- Modify: `src/server.js`
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: `injectPrintScript` from Task 1 (`src/html-transform.js`), the existing `resolveArtifactAsset(root, assetPath)` (already exported from `src/server.js`, unchanged), the existing `store.findByKey(key)` session lookup used by every other route in this file.
- Produces: three routes at `/print/:key`, `/print/:key/index.html`, `/print/:key/<path>`. Task 4's chrome button opens `/print/${key}` (no trailing path) in a new tab.

- [ ] **Step 1: Write the failing tests**

Append to `test/server.test.js` (same file already imports `serve` and has the `mkdtemp`/`mkdir`/`writeFile`/`rm` pattern used below — copy the fixture style from the existing `"/artifact serves files copied under the artifact directory"` test at line 887):

```javascript
test("/print/:key serves the artifact as a top-level page with an auto-print script, not the Lavish SDK", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const artifact = path.join(dir, "artifact.html");
  await writeFile(artifact, "<!doctype html><html><body><h1>Full content</h1></body></html>");
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const sessionRes = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact }),
    });
    const session = await sessionRes.json();

    const redirect = await fetch(`${base}/print/${session.key}`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.match(redirect.headers.get("location") || "", /\/print\/.+\/index\.html$/);

    const printPage = await fetch(`${base}/print/${session.key}/index.html`);
    const html = await printPage.text();
    assert.equal(printPage.status, 200);
    assert.match(html, /<h1>Full content<\/h1>/);
    assert.match(html, /window\.print\(\)/);
    assert.doesNotMatch(html, /\/sdk\.js\?key=/);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("/print/:key/<path> serves sibling assets so relative paths resolve without rewriting", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const dir = path.join(parent, ".lavish");
  const assetDir = path.join(dir, "assets");
  const artifact = path.join(dir, "artifact.html");
  await mkdir(dir);
  await mkdir(assetDir);
  await writeFile(
    artifact,
    '<!doctype html><html><head><link rel="stylesheet" href="assets/style.css"></head><body><h1>Hi</h1></body></html>',
  );
  await writeFile(path.join(assetDir, "style.css"), "body { color: rgb(1 2 3); }\n");
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const sessionRes = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: artifact }),
    });
    const session = await sessionRes.json();

    const css = await fetch(`${base}/print/${session.key}/assets/style.css`);
    assert.equal(css.status, 200);
    assert.equal(await css.text(), "body { color: rgb(1 2 3); }\n");
  } finally {
    await server.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test("/print/:key returns 404 for an unknown session", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lavish-serve-"));
  const server = await serve({ port: 0, stateFile: path.join(dir, "state.json"), version: "9.9.9-test" });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const res = await fetch(`${base}/print/does-not-exist/index.html`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/server.test.js`
Expected: 3 new failures, each a 404 (route does not exist yet) where the test expects 200/302.

- [ ] **Step 3: Implement the routes**

In `src/server.js`, update the import at the top (currently `import { injectLavishSdk } from "./html-transform.js";`):

```javascript
import { injectLavishSdk, injectPrintScript } from "./html-transform.js";
```

Then, immediately after the existing three `/artifact/...` routes (after the closing `});` of the `app.get(/^\/artifact\/([^/]+)\/(.+)$/, ...)` route, i.e. right before the `app.get("/events/:key", ...)` route), add:

```javascript
app.get("/print/:key", (req, res) => {
  res.redirect(`/print/${req.params.key}/index.html`);
});

app.get(/^\/print\/([^/]+)\/index\.html$/, async (req, res, next) => {
  try {
    const key = req.params[0];
    const session = await store.findByKey(key);
    if (!session) {
      res.status(404).send("Session not found");
      return;
    }
    const html = await readFile(session.file, "utf8");
    res.type("html").send(injectPrintScript(html));
  } catch (error) {
    next(error);
  }
});

app.get(/^\/print\/([^/]+)\/(.+)$/, async (req, res, next) => {
  try {
    const key = req.params[0];
    const assetPath = req.params[1];
    const session = await store.findByKey(key);
    if (!session) {
      res.status(404).send("Session not found");
      return;
    }
    const root = path.dirname(session.file);
    const file = resolveArtifactAsset(root, assetPath);
    if (!file) {
      res.status(403).send("Forbidden");
      return;
    }
    res.sendFile(file, { dotfiles: "allow" });
  } catch (error) {
    next(error);
  }
});
```

`readFile` and `path` are already imported at the top of `src/server.js` for the existing `/artifact` routes — no new imports needed beyond `injectPrintScript`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/server.test.js`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/server.js test/server.test.js
git commit -m "feat: add /print/:key routes serving the artifact as a top-level page

Mirrors /artifact/:key/index.html and /artifact/:key/<path> exactly so
relative asset paths resolve for free - no HTML rewriting needed."
```

---

### Task 3: "Print / Save PDF" button in the chrome overflow menu

**Files:**

- Modify: `src/server.js` (chrome icon + `createChromeHtml` markup)
- Test: `test/server.test.js`

**Interfaces:**

- Consumes: nothing new from other tasks (the button's target URL is constructed client-side in Task 4 from the `key` already embedded in the session JSON).
- Produces: a `<button id="printArtifact">` in the chrome's overflow menu. Task 4 wires its `onclick`.

- [ ] **Step 1: Write the failing test**

Append to `test/server.test.js`, near the other `createChromeHtml` assertions (search the file for `createChromeHtml(` to find an existing test in this style, e.g. the one asserting `id="annotation"`):

```javascript
test("chrome overflow menu includes a Print / Save PDF action", () => {
  const html = createChromeHtml({ key: "abc123", file: "/tmp/x.html", chat: [] });

  assert.match(html, /id="printArtifact" type="button"/);
  assert.match(html, /Print \/ Save PDF/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.test.js --test-name-pattern "Print / Save PDF"`
Expected: FAIL — no `id="printArtifact"` in the current output.

- [ ] **Step 3: Add the printer icon and the menu button**

In `src/server.js`, in the `chromeIcons` object (right after the existing `camera` icon, before `exit`), add:

```javascript
  printer: chromeIcon(
    '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    15,
  ),
```

In `createChromeHtml`, find this exact substring (it is the `#copySnapshot` button followed immediately by the menu-rule and the `#end` button):

```
<button class="menu-item" id="copySnapshot" type="button">${chromeIcons.camera}<span>Copy DOM snapshot</span></button><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">${chromeIcons.exit}<span>End session</span></button>
```

Replace with:

```
<button class="menu-item" id="copySnapshot" type="button">${chromeIcons.camera}<span>Copy DOM snapshot</span></button><button class="menu-item" id="printArtifact" type="button">${chromeIcons.printer}<span>Print / Save PDF</span></button><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">${chromeIcons.exit}<span>End session</span></button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.test.js --test-name-pattern "Print / Save PDF"`
Expected: PASS.

- [ ] **Step 5: Run the full server test file to check for regressions**

Run: `node --test test/server.test.js`
Expected: all tests pass (no existing test hardcodes the exact overflow-menu HTML in a way this insertion would break, since the previous tests match on specific `id="..."` substrings, not full-string equality — if any test does fail, it should be a test asserting the exact full menu HTML string equality, in which case update that expected string to include the new button in the same position).

- [ ] **Step 6: Commit**

```bash
git add src/server.js test/server.test.js
git commit -m "feat: add Print / Save PDF button to the chrome overflow menu"
```

---

### Task 4: Wire the button in chrome-client.js

**Files:**

- Modify: `src/chrome-client.js`

**Interfaces:**

- Consumes: `id="printArtifact"` from Task 3, the module-level `key` constant already defined near the top of `src/chrome-client.js` (`const key = String(sessionData.key || "");`).
- Produces: nothing consumed by later tasks — this is the last lavish-axi-side wiring step.

- [ ] **Step 1: Add the button reference**

In `src/chrome-client.js`, find:

```javascript
const copySnapshotButton = /** @type {HTMLButtonElement} */ (document.getElementById("copySnapshot"));
```

Add immediately after it:

```javascript
const printArtifactButton = /** @type {HTMLButtonElement} */ (document.getElementById("printArtifact"));
```

- [ ] **Step 2: Wire the click handler**

Find:

```javascript
copySnapshotButton.onclick = copyDomSnapshot;
```

Add immediately after it:

```javascript
printArtifactButton.onclick = () => window.open(`/print/${key}`, "_blank");
```

- [ ] **Step 3: Verify with a manual check (no automated test - this line has no meaningful unit-testable behavior beyond "calls window.open with the right URL", which is already covered by Task 2's route tests confirming the URL shape works)**

Run: `pnpm run build && node dist/cli.mjs /tmp/some-scratch-file.html` (create a one-line scratch HTML file first if needed), open the session URL in a real browser via Chrome DevTools MCP or by hand, click the overflow menu, click "Print / Save PDF", and confirm a new tab opens showing the artifact content with the browser's native print dialog appearing automatically.

Expected: new tab opens at `/print/<key>/index.html`, shows the full artifact (not wrapped in Lavish chrome), and the print dialog opens automatically.

- [ ] **Step 4: Commit**

```bash
git add src/chrome-client.js
git commit -m "feat: wire Print / Save PDF button to open /print/:key in a new tab"
```

---

### Task 5: `@media print` overrides for CSS-only-tabs artifacts, and playbook documentation

**Files:**

- Modify: `src/playbooks.js` (this repo)
- Modify: `/Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/dbt-brief-dashboard.html` (different repo)
- Modify: `/Users/operator/code/dbt-labs/resident-architect-skills/skills/ps-operational/skills/build-ra-customer-briefing/assets/dashboard_template.html.j2` (different repo)

**Interfaces:**

- Consumes: nothing from Tasks 1-4 (this task is CSS-only and independent of the server-side print route; it fixes the second root cause described in the plan's Architecture section).
- Produces: nothing consumed elsewhere — this is the last task.

- [ ] **Step 1: Add the `@media print` rule to `dashboard_template.html.j2`**

In `/Users/operator/code/dbt-labs/resident-architect-skills/skills/ps-operational/skills/build-ra-customer-briefing/assets/dashboard_template.html.j2`, find the responsive `@media (max-width: 1024px)` block (it ends with a line containing only `}` followed by the `/* ── PRINT ── */` comment and the existing print block `@media print { nav { position: relative; } section { display: block !important; page-break-inside: avoid; } .card { box-shadow: 0 1px 4px rgba(0,0,0,0.06); } }`).

Replace that existing print block with:

```css
/* ── PRINT ── */
@media print {
  nav.tab-nav {
    display: none;
  }
  section.tab-panel {
    display: block !important;
    page-break-inside: avoid;
    page-break-before: always;
  }
  section.tab-panel:first-of-type {
    page-break-before: avoid;
  }
  .card {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }
}
```

This hides the (meaningless-on-paper) tab nav, forces every panel visible regardless of which radio is checked, and starts each panel on its own page so the printed document reads as ten sequential sections rather than an overlapping mess.

- [ ] **Step 2: Verify with the parity check plus a manual print-preview**

```bash
cd /Users/operator/code/dbt-labs/resident-architect-skills
uv run python skills/ps-operational/skills/build-ra-customer-briefing/scripts/check_template_parity.py target/ra-customer-brief/nfl/nfl.yaml
```

Expected: `OK: 10 sections, 25 subsections match` (this CSS-only change cannot affect heading structure, so parity must still hold - if it does not, something else was accidentally edited).

Then open `target/ra-customer-brief/nfl/nfl_dashboard.html` directly in a real browser (Chrome DevTools MCP `new_page` with the `file://` URL) and use `emulate` or the browser's print-preview to confirm all ten sections render sequentially instead of only the active tab.

- [ ] **Step 3: Commit in the resident-architect-skills repo**

```bash
cd /Users/operator/code/dbt-labs/resident-architect-skills
git add skills/ps-operational/skills/build-ra-customer-briefing/assets/dashboard_template.html.j2
git commit -m "fix: print all tabs in dashboard_template.html.j2, not just the active one

@media print previously inherited from the source briefing template
verbatim, which forces bare <section> visible but says nothing about
hiding the tab nav or ordering panels - add an explicit override."
```

- [ ] **Step 4: Apply the equivalent fix to the lavish-themes reference implementation**

In `/Users/operator/code/will-sargent-dbtlabs/lavish-themes/tier2/dbt-brief-dashboard.html`, find the `@media (max-width: 760px)` block's closing `}` (this theme currently has no `@media print` block at all - confirm with `grep -n "@media print" tier2/dbt-brief-dashboard.html` before starting, expecting no match). Add immediately after that block:

```css
@media print {
  nav.tab-nav {
    display: none;
  }
  .tab-panel {
    display: block !important;
    page-break-inside: avoid;
    page-break-before: always;
  }
  .tab-panel:first-of-type {
    page-break-before: avoid;
  }
}
```

- [ ] **Step 5: Commit in the lavish-themes repo**

```bash
cd /Users/operator/code/will-sargent-dbtlabs/lavish-themes
git add tier2/dbt-brief-dashboard.html
git commit -m "fix: print all tabs in dbt-brief-dashboard.html, not just the active one"
```

Then sync the bundled skill copy:

```bash
cp tier2/dbt-brief-dashboard.html ~/.claude/skills/lavish/themes/
```

- [ ] **Step 6: Document the requirement in the `dashboard` playbook**

In `src/playbooks.js` (this repo, lavish-axi), find the `dashboard` playbook's `design_rules` array (it currently has 3 entries ending with the one about `data-tab` attributes). Add a fourth entry:

```javascript
      "Include an `@media print { nav.tab-nav { display: none; } .tab-panel { display: block !important; page-break-inside: avoid; } }` rule (adjust selector names to match your artifact) on every CSS-only-tabs artifact. Printing a page does not change which panels are visible - without this override, `window.print()` or a PDF export only captures whichever tab happens to be checked, not the full artifact.",
```

- [ ] **Step 7: Run the full check**

```bash
cd /Users/operator/code/will-sargent-dbtlabs/lavish-axi
pnpm run check
```

Expected: exits 0. `pnpm run check` includes `node scripts/build-skill.js --check`, but this step's edit only touches the `dashboard` playbook's `design_rules` array - `createSkillMarkdown()` (in `src/skill.js`) only reads each playbook's `id` and `use_when` when generating `skills/lavish/SKILL.md`, not `design_rules`/`choose`/`structure`/`pitfalls`/`lavish_notes`. So `git status` will show no change to `skills/lavish/SKILL.md` after this edit, and that is correct, not a missed step - do not go looking for a SKILL.md diff that isn't supposed to exist. (If prettier reformats `src/playbooks.js` itself, that's expected; re-run `pnpm run check` once more to confirm clean.)

- [ ] **Step 8: Commit in the lavish-axi repo**

```bash
git add src/playbooks.js
git commit -m "docs: require an @media print override on CSS-only-tabs artifacts

Printing a page doesn't change which .tab-panel is display:none, so
without this every CSS-only-tabs artifact silently prints only the
active tab. Fixed the two existing dashboard-mode artifacts
(dbt-brief-dashboard.html, dashboard_template.html.j2) as a companion
change in their own repos."
```

---

## Self-Review Notes (completed before handoff)

- **Spec coverage:** "actually prints all the info" → Tasks 1-4 (the iframe-truncation fix via `/print/:key`). "including potentially multiple tabs" → Task 5 (the `@media print` overrides, since the route alone does not force hidden tab panels visible). Both root causes named in the user's request have a task.
- **Placeholder scan:** no TBD/TODO language; every step has literal code, exact strings to find/replace, and exact commands.
- **Type/interface consistency:** `injectPrintScript(html)` signature (Task 1) matches its single call site in Task 2's route handler exactly (`injectPrintScript(html)`, no second argument, unlike `injectLavishSdk(html, key)` which needs the key for the SDK URL - the print script needs no key). The route paths (`/print/:key`, `/print/:key/index.html`, `/print/:key/<path>`) are consistent between Task 2's implementation and Task 4's `window.open` call (which opens the bare `/print/${key}` redirect target, matching the redirect Task 2 implements). Button id `printArtifact` is consistent between Task 3 (markup) and Task 4 (query selector).
- **Cross-repo dependency check:** Task 5 touches three separate git repositories (`lavish-axi`, `lavish-themes`, `resident-architect-skills`). None of these commits depend on each other completing first - each commits independently to its own repo, matching the pattern already established earlier in this session for cross-repo work.
