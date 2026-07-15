import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themeNames = ["loupe-aurora.html", "loupe-aurora-light.html"];

for (const themeName of themeNames) {
  test(`${themeName} uses the wide report canvas`, async () => {
    const theme = await readFile(new URL(`../.agents/skills/loupe/themes/${themeName}`, import.meta.url), "utf8");

    assert.match(theme, /body\{[^}]*max-width:1480px/);
    assert.doesNotMatch(theme, /body\{[^}]*max-width:1120px/);
  });
}
