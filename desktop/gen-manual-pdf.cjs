// 软著材料：文档鉴别材料（操作手册 PDF）生成脚本 —— 流式排版，避免文字重叠
// 用法：node gen-manual-pdf.cjs
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'copyright-assets', 'screenshots');
const OUT = path.join(ROOT, 'docs', 'copyright-assets', '论语学习-操作手册.pdf');

const FONT_TITLE = 'C:/Windows/Fonts/simhei.ttf';   // 黑体（标题）
const FONT_BODY = 'C:/Windows/Fonts/simfang.ttf';   // 仿宋（正文）

const W = 595; // A4 宽 pt
const MARGIN = 60;
const CONTENT_W = W - MARGIN * 2; // 475

const APP_NAME = '论语学习软件（Android客户端）';
const VERSION = 'V1.0';

const doc = new PDFDocument({ size: 'A4', margin: MARGIN, font: FONT_TITLE });
doc.pipe(fs.createWriteStream(OUT));

// ---------- 页眉（软件名+版本+页码）：每页必备，文字与申请表一致 ----------
// 注意：页眉放在顶部 y=28（内容区之外）；若在页底 815 绘制会超出 maxY 触发
// 自动换页 → pageAdded 递归 → 栈溢出
let pageNo = 1;
function drawChrome() {
  const x = doc.x, y = doc.y; // 保存流式排版位置，避免页眉绘制干扰正文
  doc.font(FONT_TITLE).fontSize(9).fillColor('#444')
    .text(`${APP_NAME} ${VERSION}    第 ${pageNo} 页`, MARGIN, 28, { width: CONTENT_W, align: 'center', lineBreak: false });
  doc.x = x; doc.y = y;
}
doc.on('pageAdded', () => { pageNo += 1; drawChrome(); });
drawChrome(); // 首页（构造函数创建，不触发 pageAdded）

// ---------- 封面 ----------
doc.fontSize(30).text('论语学习软件', MARGIN, 240, { width: CONTENT_W, align: 'center' });
doc.moveDown(1.0);
doc.fontSize(22).text('（Android客户端）', { width: CONTENT_W, align: 'center' });
doc.moveDown(1.2);
doc.fontSize(22).text('操作手册', { width: CONTENT_W, align: 'center' });
doc.moveDown(2.5);
doc.fontSize(14).text('版本：V1.0', { width: CONTENT_W, align: 'center' });
doc.moveDown(0.8);
doc.fontSize(14).text('编制日期：2026 年 8 月', { width: CONTENT_W, align: 'center' });

// ---------- 目录页 ----------
// 紧接封面，addPage 在 move 完成后再执行；封面已写到底部附近，手动新页避免留白
doc.addPage();
doc.font(FONT_TITLE).fontSize(18).fillColor('#000').text('目  录', { width: CONTENT_W, align: 'center' });
doc.moveDown(1.4);

const TOC = [
  { level: 0, title: '一、软件概述' },
  { level: 1, title: '1.1  软件简介' },
  { level: 1, title: '1.2  运行环境' },
  { level: 1, title: '1.3  技术架构' },
  { level: 0, title: '二、功能与操作说明' },
  { level: 1, title: '2.1  首页' },
  { level: 1, title: '2.2  论语篇目列表' },
  { level: 1, title: '2.3  篇章章句列表' },
  { level: 1, title: '2.4  章句详情研读' },
  { level: 1, title: '2.5  写笔记' },
  { level: 1, title: '2.6  全文搜索' },
  { level: 1, title: '2.7  我的笔记' },
  { level: 1, title: '2.8  个人中心' },
  { level: 1, title: '2.9  设置' },
  { level: 1, title: '2.10 隐私政策' },
  { level: 0, title: '三、软件安装' },
  { level: 1, title: '3.1  Android 版安装' },
];

for (const item of TOC) {
  const indented = item.level === 0 ? item.title : '　　' + item.title;
  doc.font(item.level === 0 ? FONT_TITLE : FONT_BODY)
     .fontSize(item.level === 0 ? 13 : 11.5)
     .fillColor('#000')
     .text(indented, { width: CONTENT_W });
  doc.moveDown(item.level === 0 ? 0.55 : 0.3);
}

doc.addPage();

// ---------- 一、软件概述 ----------
doc.font(FONT_TITLE).fontSize(18).text('一、软件概述');
doc.moveDown(0.8);

function para(text, opts = {}) {
  doc.font(opts.title ? FONT_TITLE : FONT_BODY)
     .fontSize(opts.size || 11.5)
     .fillColor('#000')
     .text(text, { width: CONTENT_W, align: 'justify', lineGap: 4, ...opts.pdf });
  doc.moveDown(opts.gap ?? 0.5);
}

para('1.1 软件简介', { title: true, size: 13, gap: 0.2 });
para('　　论语学习软件是一款面向《论语》学习的离线阅读与学习工具。软件内置于完整《论语》二十篇共 509 章句的原文、白话译文与注释解读，用户无需注册登录、无需联网即可使用全部功能。');
para('　　软件提供篇章阅读、章句详情研读、学习进度标记、本地笔记、每日推荐、全文搜索、学习统计等功能，帮助用户系统化地研习《论语》。');

para('1.2 运行环境', { title: true, size: 13, gap: 0.2 });
para('　　（1）Android 版：Android 6.0（API 23）及以上系统；');
para('　　（2）分辨率：自适应 375pt 及以上屏幕。');

para('1.3 技术架构', { title: true, size: 13, gap: 0.2 });
para('　　软件采用 React + TypeScript 技术栈开发，基于 Taro 跨端框架构建应用，通过 Capacitor 封装为 Android 客户端。章句数据经压缩内置于软件包内，运行时本地解压加载，全程离线可用。学习进度与笔记数据存储于用户设备本地。');

// ---------- 二、功能与操作说明 ----------
// 紧跟概述节：若当前页下方剩余 ≥80pt 就直接开新节标题，避免大标题独占一整页造成几乎空白页
doc.moveDown(1.0);
if (doc.y > 760) doc.addPage();
doc.font(FONT_TITLE).fontSize(18).fillColor('#000').text('二、功能与操作说明');
doc.moveDown(0.6);

const sections = [
  {
    title: '2.1 首页',
    img: '01-home.png',
    desc: [
      '首页是软件启动后的主界面，自上而下包含以下内容：',
      '　　（1）全库搜索框：点击后进入搜索页，可按关键词检索《论语》原文、译文与注释；',
      '　　（2）今日推荐：每日自动推荐一条章句供用户研读，点击"开始学习"进入该章句详情；',
      '　　（3）学习进度统计：以四宫格展示已读章句数、已读篇目数、连续学习天数与笔记数量，下方进度条显示总进度（已读章句 / 共 509 章）；',
      '　　（4）快捷入口：提供篇章阅读、我的笔记、个人中心、设置的快速跳转；',
      '　　（5）经典名句：轮换展示《论语》名句供用户随时品读。',
      '底部导航栏提供首页、论语、笔记、我的四个页面的切换入口。',
    ],
  },
  {
    title: '2.2 论语篇目列表',
    img: '02-classics.png',
    desc: [
      '论语页展示《论语》二十篇的全部篇目：',
      '　　（1）分类筛选：可按全部、学习修身、为政治国、礼乐制度等主题筛选篇目；',
      '　　（2）篇目卡片：显示各篇名称、主题分类与章句数量，已读完的篇目带"已读完"标记，点击任意篇目进入该篇章句列表。',
    ],
  },
  {
    title: '2.3 篇章章句列表',
    img: '03-chapter-detail.png',
    desc: [
      '进入某一篇（如"学而第一"）后，页面显示该篇的学习进度与全部章句列表：',
      '　　（1）本篇进度：以进度条显示已读章句数与总章句数（如 16/16，100%）；',
      '　　（2）章句列表：逐条展示原文与主题标签，已读章句带"已读"标记；每条卡片提供"查看详情"入口与写笔记快捷操作。',
    ],
  },
  {
    title: '2.4 章句详情研读',
    img: '04-verse-detail.png',
    desc: [
      '章句详情页是软件的核心研读界面：',
      '　　（1）原文：显示该章句完整原文；',
      '　　（2）核心要点：以标签形式概括本章主旨；',
      '　　（3）白话译文：提供通俗准确的现代汉语翻译；',
      '　　（4）注释解读：对原文中的关键字逐词释义，辅助理解。',
      '阅读完成后可将该章句标记为已读，计入学习进度。',
    ],
  },
  {
    title: '2.5 写笔记',
    img: '05-write-note.png',
    desc: [
      '在章句详情页点击"写笔记"进入笔记编辑页：',
      '　　（1）顶部引用所研读的章句原文；',
      '　　（2）笔记输入框：最多可输入 500 字学习心得，实时显示字数统计；',
      '　　（3）标签选择：可为笔记选择预置标签（修身、学习、处世、教育等）或自定义标签（最多 5 个）；',
      '　　（4）点击"保存笔记"将笔记保存到本地，随后可在"笔记"页统一查看。',
    ],
  },
  {
    title: '2.6 全文搜索',
    img: '06-search.png',
    desc: [
      '搜索页提供对全部 509 条章句的深度检索：',
      '　　（1）在搜索框输入关键词（支持原文、译文、注释内容），软件实时返回匹配结果总数（如"找到 152 条匹配"）；',
      '　　（2）结果卡片展示章句出处、命中字段与内容预览，命中关键词高亮显示；',
      '　　（3）点击结果条目直接跳转至对应章句详情页；搜索历史自动记录最近关键词，便于快速重搜。',
    ],
  },
  {
    title: '2.7 我的笔记',
    img: '07-insights.png',
    desc: [
      '笔记页汇总用户写下的全部学习笔记：',
      '　　（1）笔记卡片：按时间倒序展示，每条包含笔记内容、标签、创建时间与所评章句原文出处；',
      '　　（2）点击卡片可跳转至对应章句详情页继续研读；',
      '　　（3）每条笔记提供"编辑"与"删除"操作；尚未撰写笔记时显示空状态引导提示。',
    ],
  },
  {
    title: '2.8 个人中心',
    img: '08-mine.png',
    desc: [
      '我的页是用户的学习数据中心：',
      '　　（1）用户信息：展示昵称、个性签名，支持编辑资料；',
      '　　（2）学习统计：已读章句数、已读篇数、连续学习天数、笔记数；',
      '　　（3）学习总进度：进度条展示全本阅读进度（已读 / 509 章）；',
      '　　（4）功能入口：继续阅读（回到上次阅读位置）、我的笔记、设置、退出。',
    ],
  },
  {
    title: '2.9 设置',
    img: '09-settings.png',
    desc: [
      '设置页提供账号、个性化与数据管理选项：',
      '　　（1）账号与同步：显示当前用户与云同步状态，可手动同步学习进度，并可开启/关闭自动同步；',
      '　　（2）阅读体验：正文字号可调标准、大、特大，影响原文、译文与注释的显示；',
      '　　（3）隐私：查看软件隐私政策全文；',
      '　　（4）数据管理：可清空本机全部学习数据（已读记录与本地笔记）；',
      '　　（5）关于：查看数据来源说明、软件版本信息。',
    ],
  },
  {
    title: '2.10 隐私政策',
    img: '10-privacy.png',
    desc: [
      '隐私政策页展示软件的隐私政策全文：',
      '　　（1）我们收集的信息：说明学习进度、笔记等本地数据的收集范围；',
      '　　（2）信息的使用：说明数据仅用于设备本地展示与多设备同步，不向第三方出售；',
      '　　（3）云同步与用户行为统计：说明同步的授权机制与统计数据开关策略；',
      '　　（4）你的权利：说明用户可随时清空本地学习数据。',
    ],
  },
];

const IMG_W = 260;                 // 图宽（原图 542x1034，等比高约 495pt）
const PAGE_BOTTOM = 842 - 60;      // A4 高 - 下边距
// 第一节（2.1 首页）不做 addPage，紧接上一段的"二、功能与操作说明"大标题
sections.forEach((s, idx) => {
  if (idx > 0) doc.addPage();
  doc.font(FONT_TITLE).fontSize(16).fillColor('#000').text(s.title);
  doc.moveDown(0.6);

  const imgPath = path.join(SHOTS, s.img);
  if (fs.existsSync(imgPath)) {
    const img = doc.openImage(imgPath);
    const imgH = IMG_W * (img.height / img.width);
    // 当前页剩余空间放不下整图时另起一页，避免图片被页底裁切
    if (doc.y + imgH > PAGE_BOTTOM) doc.addPage();
    doc.image(img, (W - IMG_W) / 2, doc.y, { width: IMG_W });
    doc.y += imgH;          // image() 不推进 y，手动下移，防止后续文字压在图上
    doc.moveDown(0.8);
  }

  doc.font(FONT_BODY).fontSize(11.5).fillColor('#000');
  for (const line of s.desc) {
    doc.text(line, { width: CONTENT_W, align: 'justify', lineGap: 4 });
    doc.moveDown(0.35);
  }
});

// ---------- 三、软件安装 ----------
doc.addPage();
doc.font(FONT_TITLE).fontSize(18).text('三、软件安装');
doc.moveDown(0.8);
para('3.1 Android 版安装', { title: true, size: 13, gap: 0.2 });
para('　　将 APK 安装包传输至 Android 手机，在文件管理器中点击安装包并允许安装未知来源应用，按提示完成安装后从桌面图标启动。');

doc.end();
console.log(`完成: ${OUT}`);
