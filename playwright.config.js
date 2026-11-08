import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./tests",
  timeout: 40000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    channel: "chrome",
  },
  projects: [
    { name: "demo", testMatch: "marketplace.spec.js" },
    {
      name: "api-contract",
      testMatch: "api-contract.spec.js",
      use: { baseURL: "http://127.0.0.1:5174" },
    },
  ],
  webServer: [
    {
      command: `${npm} run dev -- --host 127.0.0.1 --port 5173 --strictPort`,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 60000,
      env: { VITE_USE_MOCKS: "true", VITE_CACHE_DIR: 'node_modules/.vite-demo-test' },
    },
    {
      command: `${npm} run dev -- --host 127.0.0.1 --port 5174 --strictPort`,
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        VITE_USE_MOCKS: "false",
        VITE_CACHE_DIR: 'node_modules/.vite-api-test',
        VITE_API_URL: "http://127.0.0.1:5174/api/v1",
      },
    },
  ],
});
