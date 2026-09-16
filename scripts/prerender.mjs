import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

// Pre-render the same React page, so the full academic profile is readable
// by search engines and visitors before JavaScript or remote feeds load.
const server = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { render, renderCv } = await server.ssrLoadModule("/src/entry-server.tsx");
  const template = await readFile("dist/index.html", "utf8");
  if (!template.includes("<!--app-html-->")) throw new Error("Missing prerender placeholder");
  await writeFile("dist/index.html", template.replace("<!--app-html-->", () => render()));
  const cvTemplate = template
    .replace(/<title>.*?<\/title>/, "<title>Curriculum Vitae · Ruihong Xie</title>")
    .replace(/<meta (?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, "")
    .replace('rel="canonical" href="https://xieruihong.github.io/my-academic-site/"', 'rel="canonical" href="https://xieruihong.github.io/my-academic-site/cv.html"');
  await writeFile("dist/cv.html", cvTemplate.replace("<!--app-html-->", () => renderCv()));
} finally {
  await server.close();
}

const redirects = {
  "publications.html": "publications",
  "Educational experience.html": "experience",
  "Awards and honours.html": "awards",
  "contact.html": "contact",
  "investigation.html": "research",
  "research.html": "research",
  "news.html": "news",
};
for (const [file, section] of Object.entries(redirects)) {
  const url = `/my-academic-site/#${section}`;
  await writeFile(`dist/${file}`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ruihong Xie</title><meta http-equiv="refresh" content="0;url=${url}"><link rel="canonical" href="https://xieruihong.github.io${url}"></head><body><a href="${url}">Visit the updated academic website</a></body></html>`);
}
await writeFile("dist/.nojekyll", "");
await writeFile("dist/404.html", '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Ruihong Xie</title></head><body><h1>Page not found</h1><p><a href="/my-academic-site/">Return to Ruihong Xie&#39;s academic homepage</a></p></body></html>');
console.log("Pre-rendered academic profile and preserved legacy page links.");
