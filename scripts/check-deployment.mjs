const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error("Usage: node scripts/check-deployment.mjs https://deployed-host");
  process.exit(2);
}

async function check() {
  const health = await fetch(new URL("/api/health?ready=1", origin), { cache: "no-store" });
  if (!health.ok) throw new Error(`Readiness returned HTTP ${health.status}: ${(await health.text()).slice(0, 160)}`);
  const report = await health.json();
  if (report.status !== "ok" || report.checks?.configuration !== "ok") {
    throw new Error(`Readiness did not confirm application configuration: ${JSON.stringify(report.checks)}`);
  }
  if (process.env.EXPECTED_COMMIT && report.commitFull !== process.env.EXPECTED_COMMIT) {
    throw new Error(`Live commit ${report.commitFull} differs from deployment ${process.env.EXPECTED_COMMIT}`);
  }

  const home = await fetch(new URL("/", origin), { cache: "no-store" });
  if (!home.ok) throw new Error(`Home returned HTTP ${home.status}: ${(await home.text()).slice(0, 160)}`);
  const html = await home.text();
  const asset = html.match(/(?:src|href)="((?:\/assets\/|\/_next\/static\/)[^"?]+\.(?:js|css))"/)?.[1];
  if (!asset) throw new Error("Home rendered without a built JavaScript or CSS asset");
  const response = await fetch(new URL(asset, origin));
  if (!response.ok) throw new Error(`Built asset ${asset} returned HTTP ${response.status}`);
  console.log(`Deployment healthy: ${report.commit} · /api/health, /, ${asset}`);
}

let lastError;
const attempts = Number(process.env.SMOKE_ATTEMPTS || 6);
const retryMs = Number(process.env.SMOKE_RETRY_MS || 5_000);
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    await check();
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Attempt ${attempt}/${attempts}: ${error.message}`);
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
}
console.error(`Deployment smoke failed: ${lastError?.message}`);
process.exit(1);
