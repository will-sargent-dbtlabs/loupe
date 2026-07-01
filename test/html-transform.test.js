import assert from "node:assert/strict";
import test from "node:test";

import { injectLavishSdk, injectPrintScript } from "../src/html-transform.js";

test("injects the Lavish SDK before the closing body tag", () => {
  const html = "<!doctype html><html><body><h1>Hi</h1></body></html>";
  const result = injectLavishSdk(html, "abc123");

  assert.match(result, /<script src="\/sdk\.js\?key=abc123"><\/script><\/body>/);
});

test("does not inject Tailwind or DaisyUI design assets so the saved file stays portable", () => {
  const html = '<!doctype html><html><head><title>Hi</title></head><body><h1 class="btn">Hi</h1></body></html>';
  const result = injectLavishSdk(html, "abc123");

  assert.doesNotMatch(result, /\/design\/daisyui\.css/);
  assert.doesNotMatch(result, /\/design\/daisyui-themes\.css/);
  assert.doesNotMatch(result, /\/design\/tailwindcss-browser\.js/);
  assert.doesNotMatch(result, /data-lavish-design/);
});

test("leaves the <head> untouched - only the SDK script is appended at end of body", () => {
  const html = "<!doctype html><html><head><title>Hi</title></head><body><h1>Hi</h1></body></html>";
  const result = injectLavishSdk(html, "abc123");

  assert.equal(
    result,
    '<!doctype html><html><head><title>Hi</title></head><body><h1>Hi</h1><script src="/sdk.js?key=abc123"></script></body></html>',
  );
});

test("appends the Lavish SDK when the artifact has no body tag", () => {
  const result = injectLavishSdk("<h1>Hi</h1>", "abc123");

  assert.equal(result, '<h1>Hi</h1>\n<script src="/sdk.js?key=abc123"></script>');
});

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
