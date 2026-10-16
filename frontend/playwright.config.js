import { defineConfig, devices } from "@playwright/test";

// Starts a fresh backend (in-memory store) and the Vite dev server on
// dedicated ports, then runs the end-to-end tests against them.
const API_PORT = 3100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(mobile|screens).spec/ },
  ],
  webServer: [
    {
      command: "npm start",
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/healthz`,
      env: {
        PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: "warn",
        SAVE_DEBOUNCE_MS: "100",
      },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
