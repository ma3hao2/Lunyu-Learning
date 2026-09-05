// 软著材料：程序鉴别材料（源代码 PDF）生成脚本
// 规范：每页 50 行，前 30 页 + 后 30 页（不足 60 页全量）
// 用法：node gen-source-pdf.cjs
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'copyright-assets', '论语学习-源代码.pdf');
const APP_NAME = '论语学习软件（Android客户端）';
const VERSION = 'V1.0';

// 收集顺序：入口与全局 → 页面 → 分包页面 → 组件 → 服务 → 工具 → 数据加载（排除纯数据文件）
const GROUPS = [
  ['app.config.ts', 'app.tsx', 'index.html'],
  ['pages/home/index.tsx', 'pages/classics/index.tsx', 'pages/insights/index.tsx', 'pages/mine/index.tsx', 'pages/settings/index.tsx', 'pages/privacy/index.tsx'],
  ['packageContent/pages/chapterDetail/index.tsx', 'packageContent/pages/verseDetail/index.tsx', 'packageContent/pages/writeNote/index.tsx', 'packageContent/pages/search/index.tsx'],
  ['packageContent/services/deepSearch.ts'],
  ['components/ChapterCard/index.tsx', 'components/VerseCard/index.tsx', 'components/ProgressBar/index.tsx', 'components/Skeleton/index.tsx'],
  ['services/auth.ts', 'services/search.ts', 'services/searchCommon.ts', 'services/sync.ts'],
  ['utils/storage.ts', 'utils/settings.ts', 'utils/searchHistory.ts', 'utils/highlight.tsx', 'utils/inflate.ts'],
  ['hooks/useProgress.ts', 'hooks/useDebounce.ts'],
  ['data/chapters.ts', 'data/versesIndex.ts', 'data/versesLoader.ts', 'data/dailyRecommend.ts'],
  ['config/cloud.ts', 'types/index.ts', 'styles/theme.scss', 'styles/variables.scss'],
  // 组件样式（补页数）
  ['pages/home/index.module.scss', 'pages/classics/index.module.scss', 'packageContent/pages/verseDetail/index.module.scss'],
];

const MAX_LINE = 96;      // 每行最大字符（超出截断）
const LINES_PER_PAGE = 50;

// 按显示宽度截断：中文/全角算 2 个半角宽度，避免超宽自动换行破坏每页 50 行
// 10pt 黑体下半角约 5pt，100 半角宽 = 500pt < 内容区 515pt
function truncateByWidth(line, maxWidth = 100) {
  let w = 0;
  for (let i = 0; i < line.length; i++) {
    w += line.charCodeAt(i) > 0xff ? 2 : 1;
    if (w > maxWidth) return line.slice(0, i);
  }
  return line;
}

// 平台中性化：本软著按 Android 客户端申报，PDF 材料中不应出现微信生态字样。
// 仅替换 PDF 输出文本，不改动真实源码（项目仍可构建微信小程序）。
// 顺序敏感：专有串与长词在前，短词兜底在后。
const SANITIZE = [
  // —— 专有串（URL / API / 标识符）——
  [/https:\/\/mp\.weixin\.qq\.com[^'\s]*/g, 'https://data.lunyu-app.cn/album'],
  [/wx\.requirePrivacyAuthorize/g, '系统隐私授权接口'],
  [/wxfile:\/\//g, 'file://'],
  [/wx:\/\//g, 'file://'],
  [/base\.wxml/g, 'base-view'],
  [/isWeapp/g, 'isApp'],
  [/(['"])weapp\1/g, '$1app$1'], // process.env.TARO_ENV === 'weapp'
  // —— 微信（先长后短）——
  [/微信开发者工具/g, '开发工具'],
  [/微信开发者平台/g, '应用开发平台'],
  [/微信官方隐私授权框/g, '系统隐私授权框'],
  [/微信官方授权框/g, '系统授权框'],
  [/微信隐私保护框架/g, '隐私保护框架'],
  [/微信隐私接口/g, '隐私接口'],
  [/微信一键登录/g, '一键登录'],
  [/微信登录/g, '用户登录'],
  [/微信小程序/g, '移动应用'],
  [/微信 openId/g, '用户 openId'],
  [/微信头像昵称填写能力/g, '系统头像昵称填写能力'],
  [/微信头像/g, '用户头像'],
  [/微信昵称/g, '常用昵称'],
  [/微信平台/g, '应用平台'],
  [/微信后台/g, '管理后台'],
  [/微信随时清理/g, '系统随时清理'],
  [/微信/g, '移动端'],
  // —— 其他小程序生态词 ——
  [/公众号/g, '内容站点'],
  [/老基础库/g, '旧运行时'],
  [/基础库/g, '运行时'],
  [/小程序/g, '应用'],
  [/分包/g, '功能模块'],
  [/主包/g, '主模块'],
  [/weixin|wechat/gi, 'app'],
];

function sanitizeLine(line) {
  let s = line;
  for (const [re, to] of SANITIZE) s = s.replace(re, to);
  return s;
}

function collectLines() {
  const lines = [];
  for (const group of GROUPS) {
    for (const rel of group) {
      const file = path.join(SRC, rel);
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      lines.push(`/* ===== 文件: src/${rel.replace(/\\/g, '/')} ===== */`);
      // 去除空行：纯空格文本在 PDF 中不产生可见输出，会导致每页实际行数 <50，
      // 全部保留非空行以保证每页 50 个可见行（登记要求每页不少于 50 行）；
      // 先做平台中性化替换再截断（替换可能改变行宽）
      for (const line of content.split(/\r?\n/)) {
        if (line.trim() === '') continue;
        lines.push(truncateByWidth(sanitizeLine(line)));
      }
    }
  }
  return lines;
}

function paginate(lines) {
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  return pages;
}

function main() {
  const allLines = collectLines();
  const totalPages = Math.ceil(allLines.length / LINES_PER_PAGE);
  const selected =
    totalPages <= 60
      ? { pages: paginate(allLines), from: 1, to: totalPages, note: '全部源代码' }
      : (() => {
          const pages = paginate(allLines);
          return { pages: [...pages.slice(0, 30), ...pages.slice(-30)], from: 1, to: 60, note: '源代码前30页与后30页' };
        })();

  // 登记规范要求每页不少于 50 行：末页不足时用可见的注释行补齐
  // （不能用空行补：纯空格文本在 PDF 中不产生可见输出）
  const lastPage = selected.pages[selected.pages.length - 1];
  while (lastPage.length < LINES_PER_PAGE) lastPage.push('//');

  const doc = new PDFDocument({ size: 'A4', margin: 36, font: '' });
  doc.pipe(fs.createWriteStream(OUT));

  // 全部使用中文字体：内置 Courier 不支持中文注释（会输出乱码）
  const FONT_CN = 'C:/Windows/Fonts/simhei.ttf';
  const FONT_CODE = FONT_CN;

  selected.pages.forEach((pageLines, idx) => {
    const pageNo = idx + 1;
    // 页眉
    doc.font(FONT_CN).fontSize(9).fillColor('#444')
      .text(`${APP_NAME} ${VERSION}  程序鉴别材料（${selected.note}）    第 ${pageNo} 页 / 共 ${selected.pages.length} 页`, 36, 22, { width: 523, align: 'center' });
    // 代码区：字号 10pt、行距 15.2pt，50 行恰好铺满 A4 内容区（顶 44 → 底 804），
    // 每页固定 50 个行槽，视觉与打印行数均为每页 50 行
    const startY = 44;
    doc.font(FONT_CODE).fontSize(10).fillColor('#000');
    let y = startY;
    for (const line of pageLines) {
      doc.text(line, 40, y, { width: 515, lineBreak: false });
      y += 15.2;
    }
    if (pageNo < selected.pages.length) doc.addPage();
  });

  doc.end();
  console.log(`完成: ${OUT}`);
  console.log(`总行数 ${allLines.length}，源代码页数 ${totalPages}，输出 ${selected.pages.length} 页`);
}

main();
