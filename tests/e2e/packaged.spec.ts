import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('packaged Windows app launches and completes its initial search', async () => {
  test.skip(process.env['GYM_PACKAGED_TEST'] !== '1', 'Only run after building the Windows package')
  const application = await electron.launch({
    executablePath: resolve('dist/win-unpacked/体育馆空场查询.exe'),
    env: { ...process.env, GYM_E2E_MODE: '1' }
  })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '体育馆空场查询' })).toBeVisible()
    await expect(page.getByText('3 个场次')).toBeVisible()
  } finally {
    await application.close()
  }
})
