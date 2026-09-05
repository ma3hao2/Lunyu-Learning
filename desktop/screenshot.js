// 论语学习 - 自动截图脚本（Electron capturePage，直接跑 H5 产物）
// 用法：node_modules\.bin\electron screenshot.js
// 说明：截图前注入学习数据（已读进度+笔记），保证搜索/笔记/统计页有真实内容；
//       需要的页面按 opts 滚动后再截，避免底部内容被裁切。
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'copyright-assets', 'screenshots');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(DIST_DIR)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 注入学习数据：已读 24 章（学而全 16 + 为政前 8）+ 3 条笔记 + 连续 5 天，
// 使首页/我的统计、笔记列表有真实内容。
// 注意两点（见 dist 打包产物与 storage.ts）：
// 1. Taro H5 的 setStorageSync 实际存储格式为 {"data": value}，注入必须包一层 data；
// 2. 已登录用户的存储 key 为 lunyu_progress_<openId>（见 getStorageKey），
//    需解析 lunyu_user 取 openId，把数据写到真实使用的 key（两种 key 都写兜底）。
function injectProgress(win) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const readVerseIds = [];
  for (let i = 101; i <= 116; i++) readVerseIds.push(i); // 学而第一 16 章
  for (let i = 201; i <= 208; i++) readVerseIds.push(i); // 为政第二前 8 章
  const progress = {
    readVerseIds,
    myNotes: [
      { id: 1755500000000001, verseId: 101, content: '「时习」是关键：学了要按时温习与实践，才能真正内化。知行合一，方得不亦说乎。', createTime: '2026-08-18 09:30', updateTime: '2026-08-18 09:30', tags: ['学习', '修身'] },
      { id: 1755500000000002, verseId: 104, content: '吾日三省吾身：反省是修身的起点。为人谋而不忠乎？与朋友交而不信乎？传不习乎？', createTime: '2026-08-17 20:15', updateTime: '2026-08-17 20:15', tags: ['修身'] },
      { id: 1755500000000003, verseId: 201, content: '为政以德，譬如北辰：以德服人而非以力压人，众人自然归附。', createTime: '2026-08-16 21:00', updateTime: '2026-08-16 21:00', tags: ['处世'] },
    ],
    totalReadDays: 5,
    lastReadDate: todayStr,
    lastReadVerseId: 101,
    deletedNoteIds: [], likedNoteIds: [], unlikedNoteIds: [],
  };
  const payload = JSON.stringify({ data: progress });
  const js = `(() => {
    const val = ${JSON.stringify(payload)};
    localStorage.setItem('lunyu_progress', val);
    let userKey = null;
    try {
      const u = JSON.parse(localStorage.getItem('lunyu_user') || 'null');
      const openId = u && u.data && u.data.openId;
      if (openId) { userKey = 'lunyu_progress_' + openId; localStorage.setItem(userKey, val); }
    } catch (e) {}
    return userKey || 'lunyu_progress';
  })()`;
  return win.webContents.executeJavaScript(js).then((k) => console.log(`inject -> ${k}`));
}

// 搜索页输入关键词：直接改 location.hash 传 keyword 时 Taro 不解码（会搜编码串），
// 改用原生 setter + input 事件驱动 React 受控输入框
function typeSearchKeyword(win, keyword) {
  const js = `(() => {
    const input = document.querySelector('input[placeholder="搜索译文、注释..."]');
    if (!input) return 'no-input';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(keyword)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`;
  return win.webContents.executeJavaScript(js);
}

// 点击底部 tabbar 切换页面：直改 hash 不触发 tab 页 onShow（数据不刷新），
// 真实点击走 Taro switchTab 生命周期，useDidShow 内的 getProgress() 才会重新执行
function clickTab(win, text) {
  const js = `(() => {
    const els = [...document.querySelectorAll('body *')].filter(el =>
      el.children.length === 0 && el.textContent.trim() === ${JSON.stringify(text)});
    if (!els.length) return 'not-found';
    els[els.length - 1].click(); // tabbar 位于 DOM 末尾，取最后一个
    return 'ok';
  })()`;
  return win.webContents.executeJavaScript(js);
}

// 页面滚动：全 DOM 扫描「可见且可滚动」的容器（Taro ScrollView / 页面容器），
// 隐藏页面（display:none，如非活动 tab）自动排除；document.scrollingElement 兜底
function scrollPage(win, opts) {
  const js = `(() => {
    const seen = new Set();
    const els = [...document.querySelectorAll('body *'), document.scrollingElement].filter(el => {
      if (!el || seen.has(el) || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
      seen.add(el);
      if (el.clientHeight < 100) return false;
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY)) return false;
      if (el.scrollHeight <= el.clientHeight + 20) return false;
      let p = el;
      while (p && p !== document.body) {
        if (getComputedStyle(p).display === 'none') return false;
        p = p.parentElement;
      }
      return true;
    });
    for (const el of els) {
      el.scrollTop = ${!!opts.bottom} ? el.scrollHeight : ${Number(opts.y || 0)};
    }
    return els.length;
  })()`;
  return win.webContents.executeJavaScript(js);
}

// 滚动到指定文本元素（如"学习进度"统计区）。
// 不用 scrollIntoView：对 Taro ScrollView 自定义滚动层支持不稳定，手动累加
// offsetTop 定位；必须过滤不可见元素（隐藏 tab 页的同款文案不可滚动）
function scrollToText(win, text) {
  const js = `(() => {
    const visible = (el) => {
      let p = el;
      while (p && p !== document.body) {
        if (getComputedStyle(p).display === 'none') return false;
        p = p.parentElement;
      }
      return true;
    };
    const els = [...document.querySelectorAll('body *')].filter(el =>
      el.children.length === 0 && visible(el) &&
      el.textContent.trim().startsWith(${JSON.stringify(text)}));
    if (!els.length) return 'not-found';
    const target = els[0];
    let offset = 0, node = target, scroller = null;
    while (node && node !== document.body) {
      offset += node.offsetTop;
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
        scroller = node; break;
      }
      node = node.offsetParent || node.parentElement;
    }
    if (!scroller) scroller = document.scrollingElement;
    if (!scroller) return 'no-scroller';
    const before = scroller.scrollTop;
    scroller.scrollTop = offset - 8; // 顶部留 8px 余量
    return 'scrolled ' + before + ' -> ' + scroller.scrollTop + ' (offset ' + offset + ')';
  })()`;
  return win.webContents.executeJavaScript(js).then((r) => console.log(`find "${text}": ${r}`));
}

// 页面清单：[名称, hash 路由, 可选动作 {scroll, search, tab, find}]
// tab：先 hash 落到任一 tabbar 页，再真实点击目标 tab（触发 onShow 刷新注入的数据）
const PAGES = [
  ['01-home', '/pages/home/index', { find: '学习进度' }],                                            // 滚到统计区：今日推荐长文会把统计推到视口外
  ['02-classics', '/pages/classics/index'],
  ['03-chapter-detail', '/packageContent/pages/chapterDetail/index?id=1', { scroll: { y: 80 } }],  // 微滚：第三条卡片"查看详情"完整入镜
  ['04-verse-detail', '/packageContent/pages/verseDetail/index?id=101'],
  ['05-write-note', '/packageContent/pages/writeNote/index?verseId=101'],
  ['06-search', '/packageContent/pages/search/index', { search: '学习' }],                          // DOM 输入触发真实搜索
  ['07-insights', '/pages/home/index', { tab: '笔记' }],                                            // 点击 tab：笔记页读注入数据
  ['08-mine', '/pages/home/index', { tab: '我的' }],                                                // 点击 tab：我的页读注入数据
  ['09-settings', '/pages/settings/index'],                                                         // 首屏：标题+账号同步+阅读体验+隐私；整页一屏放不下
  ['10-privacy', '/pages/privacy/index'],                                                           // 不滚：标题紧贴顶缘，滚动会切标题；长文末行自然截断可接受
];

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const port = await startServer();
  const win = new BrowserWindow({
    width: 375, height: 812, show: false,  // 逻辑尺寸，与设计稿一致
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  await wait(4000); // 等首屏渲染 + 数据解压
  await injectProgress(win);
  // 注入后重载：页面组件在挂载时已用空数据初始化 React state，且 hash 落页
  // 不触发 onShow；reload 让全部页面重新挂载、mount 时即读到注入数据
  await win.webContents.reload();
  await wait(4000);

  for (const [name, route, action] of PAGES) {
    try {
      await win.webContents.executeJavaScript(`location.hash = '#${route}'`);
      if (action && action.search) {
        // 搜索页：等预加载完成后输入关键词，再等防抖(300ms)+深度搜索渲染
        await wait(2500);
        await typeSearchKeyword(win, action.search);
        await wait(2500);
      } else if (action && action.tab) {
        // tabbar 页：先落到任一 tab 页再点击目标 tab，触发 onShow 数据刷新
        await wait(1500);
        const r = await clickTab(win, action.tab);
        if (r !== 'ok') console.log(`WARN ${name}: tab "${action.tab}" ${r}`);
        await wait(2000);
      } else {
        await wait(2400); // 等页面切换/分包加载
      }
      if (action && action.find) { await scrollToText(win, action.find); await wait(500); }
      if (action && action.scroll) { await scrollPage(win, action.scroll); await wait(500); }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), img.toPNG());
      console.log(`OK  ${name}`);
    } catch (e) {
      console.log(`ERR ${name}: ${e.message}`);
    }
  }
  app.quit();
}).catch((e) => { console.error(e); app.quit(); });
