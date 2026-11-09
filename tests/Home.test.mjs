import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("homepage keeps section order and shares the updated profile with the CV", async (context) => {
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: "custom",
    logLevel: "silent",
  });
  context.after(() => server.close());
  const { render, renderCv } = await server.ssrLoadModule("/src/entry-server.tsx");
  const html = render();
  const sections = [...html.matchAll(/<section id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(sections, ["top", "about", "research", "selected", "publications", "experience", "news"]);
  const liveFeed = html.indexOf("Latest research &amp; citations");
  const selected = html.indexOf('<section id="selected"');
  assert.ok(liveFeed >= 0 && liveFeed < selected);
  assert.ok(html.indexOf("Research in focus.") > selected);
  const selectedSection = html.slice(selected, html.indexOf("</section>", selected));
  assert.ok(selectedSection.startsWith('<section id="selected" class="section selected-section"><div class="selected-panel">'));
  assert.equal((selectedSection.match(/class="selected-panel"/g) || []).length, 1);
  assert.equal((selectedSection.match(/class="selected-paper"/g) || []).length, 3, "One inset panel contains all featured papers");
  assert.equal((html.match(/class="selected-paper"/g) || []).length, 3);
  assert.ok(html.includes('href="#selected"'), "Hero still links to featured research");
  assert.ok(html.includes('href="#publications"'), "Full-library links remain valid");
  for (const [name, page] of [["homepage", html], ["CV", renderCv()]]) {
    assert.ok(page.includes("Incoming Postdoctoral Researcher"), `${name} does not prematurely claim a current postdoctoral role`);
    assert.ok(page.includes("City University of Hong Kong") && page.includes("Dec 2026"));
    assert.ok(page.includes("Prof. Qiusheng Li") && page.includes("floating offshore wind turbines"));
    assert.ok(page.includes("Wind-sensitive Structures") && page.includes('href="mailto:ruihongxie33@gmail.com"'));
    assert.ok(page.includes("31 Jul 2025"), `${name} shows the corrected award date`);
    assert.ok(page.includes("University of Toronto") && page.includes("Feb 2025 — Aug 2026"), "Historical visiting research is preserved");
    assert.ok(!page.includes("mail.utoronto.ca") && !page.includes("Bridge Wind Engineering &amp; Vibration Control"));
    assert.ok(!/\p{Script=Han}/u.test(page), `${name} remains English`);
  }
  assert.ok(html.includes("07.31") && !html.includes("07.01"));
  assert.ok(renderCv().replace(/<!--.*?-->/g, "").includes("Updated November 2026"));
});
