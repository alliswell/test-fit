import { defineConfig } from "@playwright/test";

// E2E happy-path tests. Reuses a running dev server if present, otherwise starts one.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1400, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [{ name: "chromium" }],
});
