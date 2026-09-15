import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/VisitorStats.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Exercise the view and effect lifecycle without a browser or real analytics.
function harness(result, privacy = {}) {
  let state = { status: "loading" };
  let effect;
  const calls = [];
  const exports = {};
  runInNewContext(compiled, {
    exports,
    window: { location: { href: "https://xieruihong.github.io/my-academic-site/" } },
    navigator: privacy,
    require(id) {
      if (id === "react") return { useState: () => [state, value => { state = value; }], useEffect: fn => { effect = fn; } };
      if (id === "./visitStats") return { recordPageView: (...args) => { calls.push(args); return Promise.resolve(result); } };
      return require(id);
    },
  });
  const render = () => renderToStaticMarkup(exports.default());
  return { render, calls, mount() { render(); return effect(); } };
}

test("initial markup is readable, uses unknown placeholders, and never tracks during prerender", () => {
  const view = harness({ status: "ready", counts: { total: 1000, today: 10 } });
  const html = view.render();
  assert.ok(html.includes("Total views") && html.includes("Views today"));
  assert.equal((html.match(/<dd>—<\/dd>/g) || []).length, 2);
  assert.ok(html.includes('aria-busy="true"'));
  assert.equal(view.calls.length, 0);
});

test("loaded values use English number formatting and disclose counting rules", async () => {
  const view = harness({ status: "ready", counts: { total: 12345, today: 27 } });
  view.mount();
  await Promise.resolve();
  const html = view.render();
  assert.ok(html.includes("12,345") && html.includes("<dd>27</dd>"));
  assert.ok(html.includes('aria-busy="false"'));
  assert.ok(html.includes("About these counts") && html.includes("not unique visitors"));
  assert.ok(html.includes("Busuanzi") && html.includes("IP address"));
});

test("preview, privacy and failure states keep dashes instead of fake zeros", async () => {
  for (const status of ["preview", "privacy", "unavailable"]) {
    const view = harness({ status });
    view.mount();
    await Promise.resolve();
    const html = view.render();
    assert.equal((html.match(/<dd>—<\/dd>/g) || []).length, 2);
    assert.ok(!html.includes("<dd>0</dd>"));
    assert.ok(!html.includes("Loading visit statistics"));
  }
});

test("browser privacy preferences are forwarded and unmounted views ignore late responses", async () => {
  const view = harness({ status: "ready", counts: { total: 10, today: 2 } }, { doNotTrack: "1", globalPrivacyControl: true });
  const cleanup = view.mount();
  assert.equal(view.calls[0][1].doNotTrack, true);
  assert.equal(view.calls[0][1].globalPrivacyControl, true);
  cleanup();
  await Promise.resolve();
  assert.ok(view.render().includes("Loading visit statistics"));
});
