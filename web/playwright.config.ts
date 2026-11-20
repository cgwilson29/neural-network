import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/neural-network/' },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/neural-network/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
})
