import test from "node:test";
import assert from "node:assert/strict";
import { COUNTED_PAGE, COUNTER_ENDPOINT, createVisitRecorder, isCountedPage, parseVisitCounts } from "../src/visitStats.ts";

const payload = { busuanzi_site_pv: 1200, busuanzi_today_pv: 17 };
const success = () => Promise.resolve(new Response(JSON.stringify(payload)));

test("only the production homepage is counted; query strings and anchors do not split counts", () => {
  for (const url of [COUNTED_PAGE, `${COUNTED_PAGE}?campaign=example#about`, `${COUNTED_PAGE}index.html`, COUNTED_PAGE.slice(0, -1)]) {
    assert.equal(isCountedPage(url), true, url);
  }
  for (const url of ["http://localhost:3000/my-academic-site/", "http://127.0.0.1:4173/my-academic-site/", "https://preview.example/my-academic-site/", "https://xieruihong.github.io/another-site/", "http://xieruihong.github.io/my-academic-site/", "not a URL"]) {
    assert.equal(isCountedPage(url), false, url);
  }
});

test("parses only validated totals; zero is valid data", () => {
  assert.deepEqual(parseVisitCounts(payload), { total: 1200, today: 17 });
  assert.deepEqual(parseVisitCounts({ busuanzi_site_pv: "0", busuanzi_today_pv: "0" }), { total: 0, today: 0 });
  assert.deepEqual(parseVisitCounts({ ...payload, unrelated: "ignored" }), { total: 1200, today: 17 });
});

test("rejects absent, negative, fractional, unsafe, or inconsistent counters", () => {
  for (const bad of [null, {}, { error: "unavailable" }, { ...payload, busuanzi_site_pv: null }, { ...payload, busuanzi_today_pv: -1 }, { ...payload, busuanzi_today_pv: 1.5 }, { ...payload, busuanzi_site_pv: Number.MAX_SAFE_INTEGER + 1 }, { ...payload, busuanzi_today_pv: 1300 }, { ...payload, busuanzi_today_pv: "<script>" }, { ...payload, busuanzi_today_pv: "" }]) {
    assert.throws(() => parseVisitCounts(bad));
  }
});

test("one shared request survives repeated renders and concurrent mounts", async () => {
  let calls = 0;
  const record = createVisitRecorder(async (url, options) => {
    calls++;
    assert.equal(url, COUNTER_ENDPOINT);
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { url: COUNTED_PAGE, referrer: "" });
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    return success();
  });
  const first = record(`${COUNTED_PAGE}?private=value#publications`);
  const second = record(COUNTED_PAGE);
  assert.equal(first, second);
  assert.deepEqual(await first, { status: "ready", counts: { total: 1200, today: 17 } });
  await second;
  await record(COUNTED_PAGE);
  assert.equal(calls, 1);
});

test("a new document lifetime can record a new view", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return success(); };
  await createVisitRecorder(fetcher)(COUNTED_PAGE);
  await createVisitRecorder(fetcher)(COUNTED_PAGE);
  assert.equal(calls, 2);
});

test("local preview, DNT, and GPC make no network requests", async () => {
  let calls = 0;
  const record = createVisitRecorder(async () => { calls++; return success(); });
  assert.deepEqual(await record("http://localhost:3000/"), { status: "preview" });
  assert.deepEqual(await record(COUNTED_PAGE, { doNotTrack: true }), { status: "privacy" });
  assert.deepEqual(await record(COUNTED_PAGE, { globalPrivacyControl: true }), { status: "privacy" });
  assert.equal(calls, 0);
  assert.equal((await record(COUNTED_PAGE)).status, "ready");
  assert.equal(calls, 1);
});

test("network failures, HTTP errors, and malformed payloads stay unavailable without retrying writes", async () => {
  for (const fetcher of [async () => { throw new Error("offline"); }, async () => new Response("offline", { status: 503 }), async () => new Response("not JSON"), async () => new Response("{}")]) {
    let calls = 0;
    const record = createVisitRecorder(async (...args) => { calls++; return fetcher(...args); });
    assert.deepEqual(await record(COUNTED_PAGE), { status: "unavailable" });
    assert.deepEqual(await record(COUNTED_PAGE), { status: "unavailable" });
    assert.equal(calls, 1);
  }
});

test("a timeout aborts the request and does not retry", async () => {
  let calls = 0;
  const record = createVisitRecorder((_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }, 5);
  assert.deepEqual(await record(COUNTED_PAGE), { status: "unavailable" });
  assert.deepEqual(await record(COUNTED_PAGE), { status: "unavailable" });
  assert.equal(calls, 1);
});
