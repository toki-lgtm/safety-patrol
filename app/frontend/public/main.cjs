const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  console.log('🔨 Creating Electron window...')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../dist/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

  if (isDev) {
    const devUrl = 'http://localhost:5173'
    console.log(`📱 Loading from dev server: ${devUrl}`)

    mainWindow.loadURL(devUrl).catch((err) => {
      console.error('❌ Failed to load dev server:', err)
      setTimeout(() => {
        mainWindow.loadURL(devUrl)
      }, 2000)
    })
  } else {
    const cloudUrl = 'https://your-app.vercel.app'
    const localPath = path.join(__dirname, '../dist/index.html')

    console.log(`📱 Loading from: ${cloudUrl}`)

    mainWindow.loadURL(cloudUrl).catch((err) => {
      console.error('❌ Failed to load cloud version, trying local...')
      mainWindow.loadFile(localPath)
    })
  }

  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Web contents crashed')
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  mainWindow.on('closed', () => {
    console.log('🔴 Window closed')
    mainWindow = null
  })
}

app.on('ready', () => {
  console.log('🚀 Electron app is ready')
  if (!mainWindow) {
    createWindow()
  }
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.focus()
  } else {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
})
