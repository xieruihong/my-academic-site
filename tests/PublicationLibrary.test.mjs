import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as research from "../src/research.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/PublicationLibrary.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
function label(node) {
  if (Array.isArray(node)) return node.map(label).join("");
  if (node?.props) return label(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

function harness({ rejectClipboard = false } = {}) {
  let cursor = 0;
  let tree;
  const states = [];
  const effectDeps = [];
  let effects = [];
  let effectIndex = 0;
  const listeners = new Map();
  const copies = [];
  const downloads = [];
  const scrolls = [];
  const frames = [];
  const exports = {};
  const location = { href: "http://127.0.0.1:4173/my-academic-site/?private=value", hash: "" };
  const React = require("react");
  const hookReact = {
    ...React,
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useRef(initial) { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; },
    useMemo: fn => fn(),
    useEffect(fn, deps) { const index = effectIndex++; if (!effectDeps[index] || deps.some((dep, i) => dep !== effectDeps[index][i])) { effects.push(fn); effectDeps[index] = deps; } },
  };
  runInNewContext(compiled, {
    exports, URL,
    window: { location, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frames.push(fn); return 1; }, cancelAnimationFrame() {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {} },
    navigator: { clipboard: { async writeText(value) { if (rejectClipboard) throw new Error("Permission denied"); copies.push(value); } } },
    require(id) { if (id === "react") return hookReact; if (id === "./research") return { ...research, scrollToId: id => scrolls.push(id), downloadText: (...args) => downloads.push(args) }; return require(id); },
  });
  const request = { topic: "All", key: 0 };
  const render = (next = request) => { cursor = 0; effectIndex = 0; tree = exports.default({ request: next }); return tree; };
  return {
    render, location, copies, downloads, scrolls,
    html: () => renderToStaticMarkup(tree),
    find: predicate => elements(tree).find(predicate),
    all: predicate => elements(tree).filter(predicate),
    button(text) { return elements(tree).find(node => node.type === "button" && label(node) === text); },
    effects() { const queue = effects; effects = []; queue.forEach(fn => fn()); },
    hash(value) { location.hash = value; listeners.get("hashchange")?.(); },
    frames() { frames.splice(0).forEach(fn => fn()); },
    selected: () => renderToStaticMarkup(exports.SelectedPublications()),
  };
}

test("selected work links to published papers; the initial library is compact without losing records", () => {
  const view = harness();
  const selected = view.selected();
  assert.equal((selected.match(/class="selected-paper"/g) || []).length, 3);
  assert.ok(selected.includes('href="#paper-1"') && !selected.includes("Under review"));
  view.render();
  assert.equal(view.all(node => node.type === "article").length, 31);
  assert.equal(view.all(node => node.type === "article" && !node.props.hidden).length, 8);
  assert.ok(view.html().includes('class="author-self">Ruihong Xie</strong>'));
  view.button("Show all results ↓").props.onClick();
  view.render();
  assert.equal(view.all(node => node.type === "article" && !node.props.hidden).length, 31);
});

test("topic requests clear incompatible filters, and search has a recoverable empty state", () => {
  const view = harness();
  view.render(); view.effects();
  view.find(node => node.type === "input").props.onChange({ target: { value: "zz-no-match" } });
  view.render();
  assert.ok(view.html().includes("No matching research outputs."));
  const request = { topic: "energy", key: 1 };
  view.render(request); view.effects(); view.render(request);
  assert.equal(view.find(node => node.type === "input").props.value, "");
  assert.ok(view.all(node => node.type === "article").some(node => node.props.id === "paper-20"));
  assert.ok(!view.all(node => node.type === "article").some(node => node.props.id === "paper-10"));
});

test("shared links reset filters and open papers even beyond the initial visible list", () => {
  const view = harness();
  view.render(); view.effects();
  view.hash("#paper-31"); view.render(); view.frames();
  const paper = view.find(node => node.props.id === "paper-31");
  assert.equal(paper.props.hidden, false);
  assert.ok(paper.props.className.includes("open"));
  assert.equal(view.find(node => node.props.id === "paper-detail-31").props.hidden, false);
  assert.deepEqual(view.scrolls, ["paper-31"]);
});

test("citation, BibTeX and share actions use real data and omit private query parameters", async () => {
  const view = harness();
  view.render();
  await view.button("Copy citation").props.onClick();
  await new Promise(setImmediate); view.render();
  assert.ok(view.copies[0].startsWith("Xie, R."));
  assert.ok(view.html().includes("Citation copied."));
  view.button("Download BibTeX ↓").props.onClick();
  assert.ok(view.downloads[0][0].includes("@article{Xie2026_1"));
  await view.button("Copy link").props.onClick();
  await new Promise(setImmediate);
  assert.equal(view.copies[1], "http://127.0.0.1:4173/my-academic-site/#paper-1");
});

test("clipboard rejection exposes selectable text rather than a false success", async () => {
  const view = harness({ rejectClipboard: true });
  view.render();
  await view.button("Copy citation").props.onClick();
  await new Promise(setImmediate); view.render();
  assert.ok(view.html().includes("Clipboard unavailable."));
  assert.ok(!view.html().includes("Citation copied."));
  assert.ok(view.find(node => node.type === "textarea").props.value.startsWith("Xie, R."));
});
