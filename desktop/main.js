// 论语学习 - Windows 桌面版入口（Electron）
// 策略：内置零依赖静态服务器托管 Taro H5 产物（hash 路由 + publicPath '/' 需要 http 前缀）
const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 打包后 H5 产物位于 resources/dist；开发模式位于上级目录 dist
const DIST_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist-h5');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// 启动本地静态服务器（127.0.0.1 随机端口），带 SPA 兜底与目录穿越防护
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
        if (!filePath.startsWith(DIST_DIR)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(DIST_DIR, 'index.html'); // SPA fallback
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } catch (e) {
        res.writeHead(500);
        res.end('Internal Error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 420,
    height: 880,
    minWidth: 375,
    minHeight: 667,
    title: '论语学习',
    backgroundColor: '#faf6f0',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 页面内新开链接走系统默认浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Alt+← 返回上一页（应用菜单被移除后补回该快捷键，与页面内返回栏互补）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.alt && input.key === 'ArrowLeft') {
      if (win.webContents.canGoBack()) win.webContents.goBack();
      event.preventDefault();
    }
  });

  win.loadURL(`http://127.0.0.1:${port}/`);
}

// 单实例锁（避免重复启动多个进程占用端口/资源）
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  Menu.setApplicationMenu(null);

  app.whenReady().then(async () => {
    try {
      const port = await startServer();
      createWindow(port);
    } catch (e) {
      console.error('启动失败:', e);
      app.quit();
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(startServer);
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
