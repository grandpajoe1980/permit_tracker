import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

try {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  repository.resetE2EDemo();
  console.log(JSON.stringify({
    reset: true,
    project: repository.getProject().code,
    customerRequests: repository.getCustomerRequests().length,
    externalFilings: repository.getExternalFilings().length,
    documentVersions: repository.getDocuments().reduce((count, document) => count + document.versions.length, 0),
  }));
} finally {
  await vite.close();
}
