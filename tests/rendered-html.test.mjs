import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("renders the synthesizer with its start control before audio initialization", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<title>Alien Grammar Synth<\/title>/);
  const start = html.match(/<button\b[^>]*>▶ Запустить<\/button>/)?.[0];
  assert.ok(start, "the audio start control is available in the initial page");
  assert.doesNotMatch(start, /\sdisabled(?:=|\s|>)/);
});

test("ships the complete AudioWorklet module graph in the client assets", async () => {
  const visited = new Set();
  async function visit(url) {
    url.search = "";
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const content = await readFile(url, "utf8");
    assert.ok(content.length > 0, `empty audio module ${url.pathname}`);
    for (const match of content.matchAll(/\bfrom\s+["'](\.\.?\/[^"']+)["']/g)) {
      await visit(new URL(match[1], url));
    }
  }
  await visit(new URL("../dist/client/alien-processor.js", import.meta.url));
  assert.equal(visited.size, 3, "processor, score and timbre modules are all deployed");
});
