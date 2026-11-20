import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/neural-network/' },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/neural-network/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    // Headless Firefox: navigator.gpu exists but there is no adapter → CPU tier (like Firefox on Linux).
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // Headless Chromium with SwiftShader WebGPU (10 storage buffers, no f16) → WebLLM tier.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
})
