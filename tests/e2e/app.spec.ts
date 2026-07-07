import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let application: ElectronApplication
let page: Page

test.beforeAll(async () => {
  application = await electron.launch({ args: ['.'], env: { ...process.env, GYM_E2E_MODE: '1' } })
  page = await application.firstWindow()
})

test.afterAll(async () => {
  if (application) await application.close()
})

test('starts with an automatic all-availability search', async () => {
  await expect(page.getByRole('heading', { name: '体育馆空场查询' })).toBeVisible()
  await expect(page.getByText('3 个场次')).toBeVisible()
  await expect(page.getByText('星期', { exact: true })).toBeVisible()
})

test('applies combined weekday, facility and inclusive start-time criteria', async () => {
  await page.getByText('星期一', { exact: true }).click()
  await page.locator('.facility-card').getByText('光が丘体育館', { exact: true }).click()
  await page.getByLabel('这个时间及以后').fill('15:00')
  await page.getByRole('button', { name: '开始检索' }).click()

  await expect(page.getByText('1 个场次')).toBeVisible()
  await expect(page.getByRole('cell', { name: '16:00' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '09:00' })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '平和台体育館' })).toHaveCount(0)
})
