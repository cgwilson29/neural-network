import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const grid = JSON.parse(readFileSync(new URL('../../src/data/grid_predictions.json', import.meta.url), 'utf8')) as { wait: number[] }

const at = (h: number, d: number, s: number, q: number) => grid.wait[(((h - 8) * 5 + d) * 5 + (s - 1)) * 21 + q]

test('exhibit runs the network in the browser and updates predictions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('./')
  await expect(page).toHaveTitle('Queue Cartography')
  const readout = page.locator('.readout .figure .value')
  await expect(readout).toHaveText(String(Math.round(at(9, 0, 2, 12))))

  // ONNX Runtime Web loads and takes over from the lookup table
  await expect(page.locator('.chip.model')).toContainText('Network running in browser', { timeout: 30_000 })
  await expect(page.getByText('Computed by the trained network in your browser')).toBeVisible()

  // Visitor input → model output
  await page.getByRole('group', { name: 'Staff on shift' }).getByRole('button', { name: '3' }).click()
  await expect(readout).toHaveText(String(Math.round(at(9, 0, 3, 12))))
  await page.getByRole('group', { name: 'Day' }).getByRole('button', { name: 'Fri' }).click()
  await page.locator('#queue').fill('4')
  await expect(readout).toHaveText(String(Math.round(at(9, 4, 3, 4))))

  expect(errors).toEqual([])
})

test('chat is gated, and the exhibit stays usable when WebGPU is unavailable', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Ask the guide bot' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Guide bot' })
  await expect(dialog).toBeVisible()
  // Headless Playwright Firefox exposes no WebGPU adapter → the unsupported path with recorded answers.
  await expect(dialog.getByText('Chat isn’t available on this device.')).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByText('Where did your data come from?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close chat' }).click()

  const readout = page.locator('.readout .figure .value')
  await page.getByRole('group', { name: 'Staff on shift' }).getByRole('button', { name: '5' }).click()
  await expect(readout).toHaveText(String(Math.round(at(9, 0, 5, 12))))
})

test('evaluation and discovery sections render real results', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: /second staff member is worth far more/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Off by about 4\.5 minutes/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The visit that was quicker than expected' })).toBeVisible()
  await page.getByRole('button', { name: 'Show this visit on the map ↑' }).click()
  await expect(page.locator('.readout .label')).toContainText('Wed 1 pm')
})
