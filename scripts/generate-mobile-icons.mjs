import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { copyFile, mkdir } from 'node:fs/promises'

const chrome = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : undefined
const browser = await chromium.launch({ headless: true, executablePath: chrome })
const source = pathToFileURL(resolve('mobile/icons/icon.svg')).href
const outputDirectory = resolve('mobile/public/icons')
await mkdir(outputDirectory, { recursive: true })
await copyFile(resolve('mobile/icons/icon.svg'), resolve(outputDirectory, 'icon.svg'))

for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.goto(source)
  await page.screenshot({ path: resolve(outputDirectory, `icon-${size}.png`), fullPage: false, omitBackground: false })
  await page.close()
}
await browser.close()
