import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const grid = JSON.parse(readFileSync(new URL('../../src/data/grid_predictions.json', import.meta.url), 'utf8')) as { wait: number[] }
const at = (h: number, d: number, s: number, q: number) => grid.wait[(((h - 8) * 5 + d) * 5 + (s - 1)) * 21 + q]
const EXTERNAL = /huggingface\.co|hf\.co|raw\.githubusercontent\.com|jsdelivr|unpkg/

/** Most tests skip the first-visit welcome card. */
async function returningVisitor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('qc.tour.v1', 'done'))
}

test.describe('exhibit', () => {
  test.beforeEach(async ({ page }) => returningVisitor(page))

  test('runs the network in the browser and updates predictions', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('./')
    await expect(page).toHaveTitle('Queue Cartography')
    const readout = page.locator('.readout .figure .value')
    await expect(readout).toHaveText(String(Math.round(at(9, 0, 2, 12))))
    await expect(page.locator('.chip.model')).toContainText('Network running in browser', { timeout: 30_000 })
    await page.getByRole('group', { name: 'Staff on shift' }).getByRole('button', { name: '3' }).click()
    await expect(readout).toHaveText(String(Math.round(at(9, 0, 3, 12))))
    await page.getByRole('group', { name: 'Day' }).getByRole('button', { name: 'Fri' }).click()
    await page.locator('#queue').fill('4')
    await expect(readout).toHaveText(String(Math.round(at(9, 4, 3, 4))))
    expect(errors).toEqual([])
  })

  test('findings render and the biggest miss loads onto the map', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: /second staff member is worth far more/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Off by about 4\.5 minutes/ })).toBeVisible()
    await page.getByRole('button', { name: 'Show this visit on the map ↑' }).click()
    await expect(page.locator('.readout .label')).toContainText('Wed 1 pm')
  })
})

test.describe('guide bot', () => {
  test.beforeEach(async ({ page }) => returningVisitor(page))

  test('Firefox without a GPU adapter is routed to CPU mode, and guide search answers instantly with nothing downloaded', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific routing')
    const external: string[] = []
    page.on('request', (r) => EXTERNAL.test(r.url()) && external.push(r.url()))
    await page.goto('./')
    await page.getByRole('button', { name: 'Ask the guide bot' }).first().click()
    const chat = page.getByRole('dialog', { name: 'Guide bot' })
    await expect(chat.getByText('CPU mode · llama.cpp (not WebLLM) · recommended')).toBeVisible({ timeout: 15_000 })
    await expect(chat.getByText(/WebLLM · on your GPU/)).toHaveCount(0)
    await chat.getByRole('button', { name: 'How did your model compare with the baseline?' }).click()
    const answer = chat.locator('.msg.assistant').last()
    await expect(answer).toContainText('46.14')
    await expect(answer).toContainText('Guide search · not AI-generated')
    await chat.getByRole('button', { name: 'Where did your data come from?' }).click()
    await expect(chat.locator('.msg.assistant').last()).toContainText('clinic-wait-times.csv')
    expect(external).toEqual([])
    // the exhibit stays usable
    await chat.getByRole('button', { name: 'Close chat' }).click()
    await page.getByRole('group', { name: 'Staff on shift' }).getByRole('button', { name: '5' }).click()
    await expect(page.locator('.readout .figure .value')).toHaveText(String(Math.round(at(9, 0, 5, 12))))
  })

  test('Chromium with WebGPU is offered WebLLM (q4f32 build without shader-f16), with CPU and search as alternatives', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs the SwiftShader WebGPU adapter')
    await page.goto('./')
    await page.getByRole('button', { name: 'Ask the guide bot' }).first().click()
    const chat = page.getByRole('dialog', { name: 'Guide bot' })
    await expect(chat.getByText('WebLLM · on your GPU · recommended')).toBeVisible({ timeout: 15_000 })
    await expect(chat.getByText('CPU mode · llama.cpp (not WebLLM)')).toBeVisible()
    await expect(chat.getByText('Guide search · no AI')).toBeVisible()
    await expect(chat.getByRole('button', { name: /Enable chat/ })).toBeVisible()
    await chat.getByText('Why this mode?').click()
    await expect(chat.getByText(/16-bit GPU shaders: no/)).toBeVisible()
  })

  test('a 9-storage-buffer GPU (Firefox on Mac) is routed to CPU mode with the reason shown', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'stubs the WebGPU adapter')
    await page.addInitScript(() => {
      const gpu = (navigator as unknown as { gpu?: { requestAdapter: (o?: unknown) => Promise<unknown> } }).gpu
      if (!gpu) return
      const real = gpu.requestAdapter.bind(gpu)
      gpu.requestAdapter = async (o?: unknown) => {
        const a = (await real(o)) as { features: Set<string>; limits: Record<string, number> } | null
        if (!a) return a
        return { features: a.features, limits: { ...Object.fromEntries(['maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeWorkgroupStorageSize'].map((k) => [k, a.limits[k]])), maxStorageBuffersPerShaderStage: 9 } }
      }
    })
    await page.goto('./')
    await page.getByRole('button', { name: 'Ask the guide bot' }).first().click()
    const chat = page.getByRole('dialog', { name: 'Guide bot' })
    await expect(chat.getByText(/allows 9 storage buffers per shader; WebLLM needs 10/)).toBeVisible({ timeout: 15_000 })
    await expect(chat.getByText('CPU mode · llama.cpp (not WebLLM) · recommended')).toBeVisible()
  })
})

test.describe('onboarding tour', () => {
  test('welcome card → learn-by-doing step → end, remembered across reloads, restartable', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'one browser is enough for the flow')
    await page.goto('./')
    const welcome = page.getByRole('dialog', { name: 'Welcome to Queue Cartography' })
    await expect(welcome).toBeVisible({ timeout: 10_000 })
    await welcome.getByRole('button', { name: 'Take the 60-second tour' }).click()
    const tour = page.locator('.tour-pop')
    await expect(tour).toContainText('This is a map of waiting')
    await tour.getByRole('button', { name: 'Next' }).click()
    await expect(tour).toContainText('Your clinic’s predicted wait')
    await tour.getByRole('button', { name: 'Next' }).click()
    await expect(tour).toContainText('Try it: add a staff member')
    await expect(tour.getByRole('button', { name: 'Skip this step' })).toBeVisible()
    await page.getByRole('group', { name: 'Staff on shift' }).getByRole('button', { name: '3' }).click()
    await expect(tour.locator('.tour-done')).toContainText(`${Math.round(at(9, 0, 3, 12))} min`)
    await expect(tour.getByRole('button', { name: 'Next' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tour).toHaveCount(0)

    await page.reload()
    await page.waitForTimeout(1600)
    await expect(page.getByRole('dialog', { name: 'Welcome to Queue Cartography' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Start the guided tour' }).click()
    await expect(page.locator('.tour-pop')).toContainText('This is a map of waiting')
  })

  test('the tour docks as a bottom sheet on phones', async ({ browser, browserName }) => {
    test.skip(browserName !== 'firefox', 'layout check')
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto('./')
    await page.getByRole('button', { name: 'Take the 60-second tour' }).click({ timeout: 10_000 })
    const pop = page.locator('.tour-pop')
    await expect(pop).toBeVisible()
    const box = (await pop.boundingBox())!
    expect(Math.round(box.y + box.height)).toBe(844)
    expect(Math.round(box.width)).toBe(390)
    await ctx.close()
  })
})

test.describe('layout', () => {
  test('the guide-bot button sits under the header and never covers the map legend', async ({ browser, browserName }) => {
    test.skip(browserName !== 'firefox', 'layout check')
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport })
      await ctx.addInitScript(() => localStorage.setItem('qc.tour.v1', 'done'))
      const page = await ctx.newPage()
      await page.goto('./')
      const bar = (await page.locator('.topbar').boundingBox())!
      const btn = (await page.locator('.chat-launcher').boundingBox())!
      const legend = (await page.locator('.hero-legend').boundingBox())!
      const overlaps = (a: typeof btn, b: typeof btn) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
      expect(btn.y).toBeGreaterThanOrEqual(bar.y + bar.height) // below the header
      expect(btn.y).toBeLessThan(bar.height + 40) // …right under it
      expect(btn.x + btn.width).toBeGreaterThanOrEqual(viewport.width - 48) // at the right edge (page gutter ≤ 40px)
      expect(overlaps(btn, legend)).toBe(false)
      expect(await page.evaluate(() => document.querySelector('.topbar')!.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      await ctx.close()
    }
  })
})
