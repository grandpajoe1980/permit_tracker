import assert from "node:assert/strict";
import test from "node:test";
import { startVinextServer } from "./helpers/start-vinext-server.mjs";

test("renders the PATH shell and honest prototype disclosure", async () => {
  const server = await startVinextServer();
  try {
    const response = await fetch(`${server.baseUrl}/`, {
      headers: { accept: "text/html" },
    });

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/html\b/i,
    );
    const html = await response.text();
    assert.match(html, /<title>PATH — Starbase Louisiana – SpaceX Coordination<\/title>/i);
    assert.match(html, /PATH/i);
    assert.match(html, /Starbase Louisiana/i);
    assert.doesNotMatch(html, /Starter Project|Ship something real/i);
    assert.doesNotMatch(html, /official state government website/i);
  } finally {
    await server.stop();
  }
});
