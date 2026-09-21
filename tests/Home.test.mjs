import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

test("featured research follows the live feed and precedes the full library", async (context) => {
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: "custom",
    logLevel: "silent",
  });
  context.after(() => server.close());
  const { render } = await server.ssrLoadModule("/src/entry-server.tsx");
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
});
