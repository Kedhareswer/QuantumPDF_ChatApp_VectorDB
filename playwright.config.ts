import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// Cloud dev containers ship a preinstalled Chromium; elsewhere use Playwright's
// own download (`npx playwright install chromium`).
const preinstalled = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium"
const executablePath = existsSync(preinstalled) ? preinstalled : undefined

const PORT = Number(process.env.E2E_PORT || 3100)

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} },
    },
  ],
  webServer: {
    // A production build: the liteparse route and the anydoc wasm worker behave as deployed.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/ping`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
})
