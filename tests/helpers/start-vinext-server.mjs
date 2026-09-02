import { createServer as createTcpServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const builtServer = path.join(root, ".output", "server", "index.mjs");

async function findFreePort() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!port) throw new Error("Unable to allocate a local test port.");
  return port;
}

export async function startVinextServer() {
  const port = await findFreePort();
  const child = spawn(process.execPath, [builtServer], {
    cwd: root,
    env: { ...process.env, NITRO_HOST: "127.0.0.1", NITRO_PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Built server exited before readiness: ${stderr}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status > 0) {
        return {
          baseUrl,
          async stop() {
            if (child.exitCode === null) child.kill();
          },
        };
      }
    } catch {
      // The listener may not be ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`Timed out waiting for built server: ${stderr}`);
}
