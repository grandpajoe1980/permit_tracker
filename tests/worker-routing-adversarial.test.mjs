import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { startVinextServer } from "./helpers/start-vinext-server.mjs";

describe("Challenger 1: Production Worker HTTP Routing Adversarial Tests", () => {
  test("Production Worker HTTP Route Permutations & SSR Delivery", async () => {
    const server = await startVinextServer();

    async function fetchPath(path) {
      return fetch(server.baseUrl + path, { headers: { accept: "text/html" } });
    }

    // 1. Root page
    const rootRes = await fetchPath("/");
    assert.equal(rootRes.status, 200);

    // 2. Project Routes (Canonical, Lowercase, URL-Encoded)
    for (const prj of ["PRJ-PECAN-2026", "prj-pecan-2026", "PRJ%2DPECAN%2D2026"]) {
      const res = await fetchPath("/projects/" + prj);
      assert.equal(res.status, 200, `Project route /projects/${prj} must return 200`);
      const html = await res.text();
      assert.ok(html.length > 0);
    }

    // 3. Workstream Detail Routes (Canonical, Lowercase, URL-Encoded)
    for (const ws of ["WS-LA82-HEAVYHAUL", "ws-la82-heavyhaul", "WS%2DLA82%2DHEAVYHAUL", "WS-WETLANDS-PAD-A", "ws%2Dwetlands%2Dpad%2Da"]) {
      const res = await fetchPath("/projects/PRJ-PECAN-2026/workstreams/" + ws);
      assert.equal(res.status, 200, `Workstream route /projects/PRJ-PECAN-2026/workstreams/${ws} must return 200`);
    }

    // 4. Non-existent Workstream Route -> Graceful 200 with UI error, NOT 500
    const nonWsRes = await fetchPath("/projects/PRJ-PECAN-2026/workstreams/WS-NONEXISTENT");
    assert.equal(nonWsRes.status, 200);
    const nonWsHtml = await nonWsRes.text();
    assert.ok(
      nonWsHtml.includes("Workstream not found") || nonWsHtml.includes("Sign in required"),
      "Nonexistent workstream route must render graceful UI message, not crash"
    );

    // 5. Non-existent Project Route -> Graceful 200 with UI error, NOT 500
    const nonPrjRes = await fetchPath("/projects/PRJ-DOES-NOT-EXIST");
    assert.equal(nonPrjRes.status, 200);
    const nonPrjHtml = await nonPrjRes.text();
    assert.ok(
      nonPrjHtml.includes("Project not found") || nonPrjHtml.includes("Sign in required"),
      "Nonexistent project route must render graceful UI message, not crash"
    );

    // 6. Global Workstream Route
    const globalRes = await fetchPath("/workstreams/WS-LA82-HEAVYHAUL");
    assert.ok([200, 307, 308].includes(globalRes.status), "Global workstream route must return 200 or redirect");
    await server.stop();
  });
});
