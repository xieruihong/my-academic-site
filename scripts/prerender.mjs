import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

// Pre-render the same React page, so the full academic profile is readable
// by search engines and visitors before JavaScript or remote feeds load.
const server = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: "custom",
});
try {
  const { render } = await server.ssrLoadModule("/src/entry-server.tsx");
  const template = await readFile("dist/index.html", "utf8");
  if (!template.includes("<!--app-html-->")) throw new Error("Missing prerender placeholder");
  await writeFile("dist/index.html", template.replace("<!--app-html-->", () => render()));
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
  await writeFile(`dist/${file}`, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ruihong Xie</title><meta http-equiv="refresh" content="0;url=${url}"><link rel="canonical" href="https://xieruihong.github.io${url}"></head><body><a href="${url}">前往新版学术网站</a></body></html>`);
}
await writeFile("dist/.nojekyll", "");
await writeFile("dist/404.html", '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到 · Ruihong Xie</title></head><body><h1>页面未找到</h1><p><a href="/my-academic-site/">回到 Ruihong Xie 的学术主页</a></p></body></html>');
console.log("Pre-rendered academic profile and preserved legacy page links.");
