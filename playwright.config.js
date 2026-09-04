import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// E2E happy-path tests. Reuses a running dev server if present, otherwise starts one.
//
// The port comes from (in order): the PORT env var, the first configuration in
// ../.claude/launch.json (the Claude desktop app's dev-server config — keeps the e2e
// suite pointed at whatever port that app is serving), then 5173.
const here = path.dirname(fileURLToPath(import.meta.url));
function launchPort() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(here, "..", ".claude", "launch.json"), "utf8"));
    const dev = cfg.configurations.find(c => /dev/i.test(c.name)) || cfg.configurations[0];
    return dev?.port;
  } catch { return undefined; }
}
const PORT = Number(process.env.PORT) || launchPort() || 5173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1400, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [{ name: "chromium" }],
});
