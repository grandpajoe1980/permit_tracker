import assert from "node:assert/strict";
import test from "node:test";

test("renders the Critical Path shell and honest prototype disclosure", async () => {
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
  assert.match(html, /<title>Critical Path — SpaceX Louisiana Project Operations<\/title>/i);
  assert.match(html, /Critical Path/i);
  assert.match(html, /SpaceX Louisiana/i);
  assert.doesNotMatch(html, /Starter Project|Ship something real/i);
  assert.doesNotMatch(html, /official state government website/i);
});
