import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'ui-prototype/iphone-home.png', fullPage: false })
await page.locator('#filterButton').click()
await page.screenshot({ path: 'ui-prototype/iphone-filter.png', fullPage: false })
await browser.close()
