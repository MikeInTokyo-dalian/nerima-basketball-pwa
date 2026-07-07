import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { SearchCriteria } from '../shared/types'
import type { SearchService } from './service'
import { ScraperSearchService } from './service'
import { FixtureSearchService } from './fixture-service'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f3f6f8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://shisetsuyoyaku.city.nerima.tokyo.jp/')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(service: SearchService): void {
  ipcMain.handle('gym:get-facilities', () => service.getFacilities())
  ipcMain.handle('gym:search', (event, criteria: SearchCriteria) => service.search(criteria, event.sender))
  ipcMain.handle('gym:cancel', () => service.cancel())
}

const service = process.env['GYM_E2E_MODE'] === '1' ? new FixtureSearchService() : new ScraperSearchService()
registerIpc(service)

app.whenReady().then(() => {
  electronApp.setAppUserModelId('jp.nerima.gym-availability')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  service.cancel()
  if (process.platform !== 'darwin') app.quit()
})
