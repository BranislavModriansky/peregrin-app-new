const { app, BrowserWindow } = require('electron/main')
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const PORT = 8765
const HOST = '127.0.0.1'

let pyProc = null

const startPythonServer = () => {
  // Use "python" from PATH; adjust if you use a venv, e.g.
  // path.join(__dirname, '.venv', 'Scripts', 'python.exe')
  pyProc = spawn('python', [
    '-m', 'shiny', 'run',
    '--host', HOST,
    '--port', String(PORT),
    path.join(__dirname, 'app/app.py'),
  ], { stdio: 'inherit' })

  pyProc.on('error', (err) => {
    console.error('Failed to start Python:', err)
    app.quit()
  })
}

// Poll until the Shiny server responds
const waitForServer = (url, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const start = Date.now()
    const tryOnce = () => {
      http.get(url, () => resolve())
        .on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('Server timed out'))
          setTimeout(tryOnce, 250)
        })
    }
    tryOnce()
  })

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#5f6368',
      height: 64 // match --navbar-height in px
    }
  })
  win.setMenuBarVisibility(false)
  win.loadURL(`http://${HOST}:${PORT}/`)
}

app.whenReady().then(async () => {
  startPythonServer()
  await waitForServer(`http://${HOST}:${PORT}/`)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

const killPython = () => {
  if (pyProc) {
    pyProc.kill()
    pyProc = null
  }
}

app.on('window-all-closed', () => {
  killPython()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', killPython)