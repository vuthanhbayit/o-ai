import { app, shell, BrowserWindow, ipcMain, globalShortcut, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

import {
  createPtySession,
  writeToPty,
  resizePty,
  closePty,
  closeAllPty,
  invalidateWindowReferences
} from './pty-manager'
import {
  getSettings,
  saveSettings,
  isFirstTime,
  getHistory,
  addToHistory,
  updateHistoryTitle,
  clearHistory
} from './storage'
import { browseDirectory, getHomeDirectory } from './fs-utils'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): void {
  const settings = getSettings()

  mainWindow = new BrowserWindow({
    width: settings.windowBounds?.width || 1200,
    height: settings.windowBounds?.height || 800,
    x: settings.windowBounds?.x,
    y: settings.windowBounds?.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#111827',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Handle close event - save bounds and cleanup
  mainWindow.on('close', () => {
    if (mainWindow && !isQuitting) {
      const bounds = mainWindow.getBounds()
      saveSettings({ windowBounds: bounds })

      // Invalidate window references in pty sessions
      invalidateWindowReferences()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  // PTY handlers
  ipcMain.handle('pty:create', (_event, { id, cwd }) => {
    if (!mainWindow) return null
    return createPtySession(id, cwd, mainWindow)
  })

  ipcMain.on('pty:input', (_event, { id, data }) => {
    if (!isQuitting) {
      writeToPty(id, data)
    }
  })

  ipcMain.on('pty:resize', (_event, { id, cols, rows }) => {
    if (!isQuitting) {
      resizePty(id, cols, rows)
    }
  })

  ipcMain.on('pty:close', (_event, { id }) => {
    closePty(id)
  })

  // File system handlers
  ipcMain.handle('fs:browse', (_event, { path, showHidden }) => {
    return browseDirectory(path, showHidden)
  })

  ipcMain.handle('fs:home', () => {
    return getHomeDirectory()
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:set', (_event, settings) => {
    return saveSettings(settings)
  })

  ipcMain.handle('settings:isFirstTime', () => {
    return isFirstTime()
  })

  // History handlers
  ipcMain.handle('history:get', () => {
    return getHistory()
  })

  ipcMain.handle('history:add', (_event, { path }) => {
    return addToHistory(path)
  })

  ipcMain.handle('history:update', (_event, { id, title }) => {
    return updateHistoryTitle(id, title)
  })

  ipcMain.handle('history:clear', () => {
    clearHistory()
    return []
  })
}

function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => {
            console.log('[Menu] Toggle DevTools clicked')
            mainWindow?.webContents.toggleDevTools()
          }
        },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  console.log('[Menu] Application menu created')
}

function registerGlobalShortcuts(): void {
  if (mainWindow) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      const isModifier = process.platform === 'darwin' ? input.meta : input.control

      if (isModifier && input.key.toLowerCase() === 't') {
        mainWindow?.webContents.send('shortcut:new-tab')
      } else if (isModifier && input.key.toLowerCase() === 'w') {
        mainWindow?.webContents.send('shortcut:close-tab')
      } else if (isModifier && input.key === 'Tab') {
        if (input.shift) {
          mainWindow?.webContents.send('shortcut:prev-tab')
        } else {
          mainWindow?.webContents.send('shortcut:next-tab')
        }
      } else if (isModifier && /^[1-9]$/.test(input.key)) {
        mainWindow?.webContents.send('shortcut:switch-tab', parseInt(input.key) - 1)
      }
    })
  }
}

function setupAutoUpdater(): void {
  // Enable detailed logging
  autoUpdater.logger = console

  // Disable auto-download to show user notification first
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  console.log('[AutoUpdater] Setup started')
  console.log('[AutoUpdater] Current version:', app.getVersion())
  console.log('[AutoUpdater] Platform:', process.platform)
  console.log('[AutoUpdater] isDev:', is.dev)
  console.log('[AutoUpdater] Download path:', app.getPath('userData'))

  // Check for updates on app start (after 3 seconds)
  setTimeout(() => {
    if (!is.dev) {
      console.log('[AutoUpdater] Checking for updates...')
      autoUpdater.checkForUpdates()
    } else {
      console.log('[AutoUpdater] Skipping update check in dev mode')
    }
  }, 3000)

  // Check for updates every 30 minutes
  setInterval(
    () => {
      if (!is.dev) {
        console.log('[AutoUpdater] Periodic update check...')
        autoUpdater.checkForUpdates()
      }
    },
    30 * 60 * 1000
  )

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', JSON.stringify(info, null, 2))
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available:', JSON.stringify(info, null, 2))
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err)
    console.error('[AutoUpdater] Error stack:', err.stack)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(
      `[AutoUpdater] Download progress: ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`
    )
    mainWindow?.webContents.send('update-download-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', JSON.stringify(info, null, 2))
    mainWindow?.webContents.send('update-downloaded', info)
  })

  // Handle download update request from renderer
  ipcMain.handle('update:download', async () => {
    try {
      console.log('Starting update download...')
      await autoUpdater.downloadUpdate()
      console.log('Update download initiated successfully')
      return { success: true }
    } catch (error) {
      console.error('Failed to download update:', error)
      return { success: false, error: String(error) }
    }
  })

  // Handle install update request from renderer
  ipcMain.handle('update:install', async () => {
    try {
      console.log('[AutoUpdater] Install requested from renderer')
      console.log('[AutoUpdater] autoInstallOnAppQuit:', autoUpdater.autoInstallOnAppQuit)

      // Set quitting flag to prevent cleanup issues
      isQuitting = true

      // For unsigned apps on macOS, we need to manually handle the update
      // The update file is already downloaded, we need to:
      // 1. Close the app gracefully (not force exit)
      // 2. Let electron-updater's autoInstallOnAppQuit handle it
      // 3. If that doesn't work, provide manual instructions

      console.log('[AutoUpdater] Attempting graceful quit for auto-install...')

      setTimeout(() => {
        // Close all windows
        const windows = BrowserWindow.getAllWindows()
        console.log('[AutoUpdater] Closing', windows.length, 'window(s)')
        windows.forEach((win) => win.close())

        // Use app.quit() instead of app.exit() to trigger autoInstallOnAppQuit
        setTimeout(() => {
          console.log('[AutoUpdater] Calling app.quit() to trigger autoInstallOnAppQuit')
          app.quit()
        }, 200)
      }, 100)

      return { success: true }
    } catch (error) {
      console.error('[AutoUpdater] Failed to install update:', error)
      console.error('[AutoUpdater] Error stack:', error instanceof Error ? error.stack : 'N/A')
      isQuitting = false
      return { success: false, error: String(error) }
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claude-workspace')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createApplicationMenu()
  createWindow()
  registerGlobalShortcuts()
  setupAutoUpdater()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Handle before-quit to set flag and cleanup
app.on('before-quit', () => {
  console.log('[App] before-quit event fired')
  isQuitting = true
  invalidateWindowReferences()
  closeAllPty()
})

app.on('window-all-closed', () => {
  console.log('[App] window-all-closed event fired')
  invalidateWindowReferences()
  closeAllPty()
  if (process.platform !== 'darwin') {
    console.log('[App] Quitting app (non-macOS)')
    app.quit()
  }
})

app.on('will-quit', () => {
  console.log('[App] will-quit event fired')
  globalShortcut.unregisterAll()
  closeAllPty()
})
