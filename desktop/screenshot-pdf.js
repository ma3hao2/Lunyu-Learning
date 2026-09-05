// 临时：渲染 PDF 指定页并截图（验证后删除）
// 用法：node_modules\.bin\electron screenshot-pdf.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'docs', 'copyright-assets');
const TASKS = [
  ['论语学习-源代码.pdf', [1, 60], 'src'],
  ['论语学习-操作手册.pdf', [4, 6], 'manual'],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 1100, show: false });
  for (const [file, pages, tag] of TASKS) {
    for (const pageNo of pages) {
      const url = 'file:///' + path.join(OUT, file).replace(/\\/g, '/') + `#page=${pageNo}`;
      await win.loadURL(url);
      await wait(2500);
      const img = await win.webContents.capturePage();
      const out = path.join(OUT, `check-${tag}-p${pageNo}.png`);
      fs.writeFileSync(out, img.toPNG());
      console.log(`OK ${out}`);
    }
  }
  app.quit();
});
