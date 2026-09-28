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

  test(`${themeName} keeps mobile grid tracks shrinkable`, async () => {
    const theme = await readFile(new URL(`../.agents/skills/loupe/themes/${themeName}`, import.meta.url), "utf8");

    assert.match(theme, /main\{grid-template-columns:minmax\(0,1fr\)/);
    assert.doesNotMatch(theme, /main\{grid-template-columns:1fr;/);
  });
}
