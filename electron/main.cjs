const { app, BrowserWindow, Menu, dialog, ipcMain, session } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// Disable error dialogs
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// Single instance lock - Chỉ cho phép 1 instance chạy
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Nếu user cố mở app lần 2, focus vào cửa sổ đang mở
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

let mainWindow

// Simple logger to file under userData
function log(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'app.log')
    const time = new Date().toISOString()
    fs.appendFileSync(logPath, `[${time}] ${message}\n`)
  } catch {}
}

function createWindow() {
  // Resolve window icon path depending on packaged/dev mode
  const devIcon = path.join(__dirname, 'build', 'icon.ico')
  const prodIcon = path.join(process.resourcesPath, 'icon.ico')
  const iconPath = fs.existsSync(app.isPackaged ? prodIcon : devIcon)
    ? (app.isPackaged ? prodIcon : devIcon)
    : undefined
  // Tạo cửa sổ trình duyệt
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      enableRemoteModule: false
    },
    backgroundColor: '#ffffff',
    show: false, // Không hiển thị cho đến khi ready
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: false,
    title: 'IBST BIM - Quản lý Dự án'
  })

  // Load the app
  if (process.env.ELECTRON_START_URL) {
    // Development mode - load from dev server
    const startUrl = process.env.ELECTRON_START_URL
    log(`Loading DEV url: ${startUrl}`)
    mainWindow.loadURL(startUrl)
  } else {
    // Production mode - load from file
    log(`App isPackaged: ${app.isPackaged}`)
    log(`__dirname: ${__dirname}`)
    log(`process.resourcesPath: ${process.resourcesPath}`)
    log(`app.getAppPath(): ${app.getAppPath()}`)
    
    if (app.isPackaged) {
      // Resolve index via file:// URL and include initial hash for HashRouter
      const baseAppPath = app.getAppPath()
      const indexPath = path.join(baseAppPath, 'dist', 'index.html')
      log(`Base app path: ${baseAppPath}`)
      log(`Index path: ${indexPath}`)

      const fileExists = fs.existsSync(indexPath)
      log(`File exists: ${fileExists}`)

      if (fileExists) {
        const indexURL = pathToFileURL(indexPath).toString() + '#/'
        log(`Loading URL: ${indexURL}`)
        mainWindow.loadURL(indexURL).then(() => {
          log('✅ URL loaded successfully!')
        }).catch(err => {
          const msg = `LoadURL error: ${err.message}\nURL: ${indexURL}\nFile exists: ${fileExists}\n\nDebug info:\napp.isPackaged: ${app.isPackaged}\nprocess.resourcesPath: ${process.resourcesPath}\napp.getAppPath(): ${app.getAppPath()}\n__dirname: ${__dirname}`
          log(msg)
          dialog.showErrorBox('Load Error', msg)
        })
      } else {
        const msg = `File not found!\nPath: ${indexPath}\n\nDebug info:\napp.isPackaged: ${app.isPackaged}\nprocess.resourcesPath: ${process.resourcesPath}\napp.getAppPath(): ${app.getAppPath()}\n__dirname: ${__dirname}`
        log(msg)
        dialog.showErrorBox('File Not Found', msg)
      }
    } else {
      // Development - files are in regular file system
      const indexPath = path.join(__dirname, '../dist/index.html')
      log(`Development - loading from: ${indexPath}`)
      
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath).catch(err => {
          const msg = `LoadFile error: ${err.message}`
          log(msg)
          dialog.showErrorBox('Load Error', msg)
        })
      } else {
        const msg = `index.html not found at: ${indexPath}`
        log(msg)
        dialog.showErrorBox('File Not Found', msg)
      }
    }
  }

  // Hiển thị khi đã sẵn sàng (fade-in effect)
  mainWindow.once('ready-to-show', () => {
    log('Window ready-to-show event fired')
    mainWindow.show()
    mainWindow.focus()
    // Maximize nếu không phải lần đầu
    const shouldMaximize = true // Có thể lưu preference
    if (shouldMaximize) {
      mainWindow.maximize()
    }
  })
  
  // Failsafe: Show window after 3 seconds even if ready-to-show hasn't fired
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log('Failsafe: Showing window after timeout')
      mainWindow.show()
    }
  }, 3000)

  // Open DevTools in production temporarily to diagnose white screen
  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load fired')
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    // Ignore ERR_ABORTED (-3): happens on harmless navigations/redirects
    if (code === -3) {
      log(`did-fail-load ignored code=${code} desc=${desc} url=${url}`)
      return
    }
    const msg = `did-fail-load code=${code} desc=${desc} url=${url}`
    log(msg)
    dialog.showErrorBox('Load failed', msg)
  })

  // Allow toggling devtools with F12 in packaged app
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) mainWindow.webContents.closeDevTools()
      else mainWindow.webContents.openDevTools()
    }
    // Intercept F5 to perform a hard reload that also clears caches/storage
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault()
      ipcMain.emit('app:hard-reload')
    }
  })

  // Mở DevTools trong development mode
  if (process.env.ELECTRON_START_URL) {
    mainWindow.webContents.openDevTools()
  }

  // Xử lý khi đóng cửa sổ
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Tạo menu tùy chỉnh
  createMenu()
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Thoát',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Chỉnh sửa',
      submenu: [
        { label: 'Hoàn tác', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Làm lại', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cắt', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Sao chép', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Dán', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Chọn tất cả', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'Xem',
      submenu: [
        { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Tải lại đầy đủ', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Phóng to', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Thu nhỏ', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Đặt lại zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toàn màn hình', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Trợ giúp',
      submenu: [
        {
          label: 'Về ứng dụng',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Về ứng dụng',
              message: 'Hệ thống Quản lý Dự án',
              detail: 'Phiên bản 1.0.0\n\nỨng dụng quản lý dự án xây dựng và giám sát thi công\nDành cho công ty tư vấn và giám sát xây dựng'
            })
          }
        }
      ]
    }
  ]

  // Thêm menu Developer cho development mode
  if (process.env.ELECTRON_START_URL) {
    template.push({
      label: 'Developer',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Khởi tạo app khi Electron sẵn sàng
app.whenReady().then(createWindow)

// Handle hard reload: clear cache/storage and reload all windows
ipcMain.handle('app:hard-reload', async () => {
  try {
    const s = session.defaultSession
    await s.clearCache()
    await s.clearStorageData({
      storages: ['appcache','cookies','filesystem','indexdb','localstorage','shadercache','websql','serviceworkers'],
      quotas: ['temporary','persistent','syncable']
    })
  } catch (e) {
    log('hard-reload error: ' + (e?.message || e))
  }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.reloadIgnoringCache()
  }
})

// Thoát khi tất cả cửa sổ đóng (trừ macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Tạo lại cửa sổ khi click vào dock icon (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Xử lý lỗi
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
