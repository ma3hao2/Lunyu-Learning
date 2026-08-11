/**
 * 从 http://www.lunyu8.cn/ 抓取论语译文和注释
 *
 * 页面 HTML 结构：
 *   <div class="arctitle_yuanwen"><h2>原文</h2>...</div>
 *   <div class="arctitle_zhushi"><h2>注释</h2>...</div>
 *   <div class="arctitle_fanyi"><h2>翻译</h2>...</div>
 *   <div class="arctitle_jiedu"><h2>评析/解读</h2>...</div>
 *
 * 运行: node scripts/fetch_lunyu8.js
 */

const fs = require('fs');
const path = require('path');

const HOME_URL = 'http://www.lunyu8.cn/';
const OUTPUT_FILE = path.join(__dirname, 'lunyu8_data.json');
const PROGRESS_FILE = path.join(__dirname, 'lunyu8_progress.json');

const chapterNameMap = {
  '学而篇': 1, '为政篇': 2, '八佾篇': 3, '里仁篇': 4,
  '公冶长篇': 5, '雍也篇': 6, '述而篇': 7, '泰伯篇': 8,
  '子罕篇': 9, '乡党篇': 10, '先进篇': 11, '颜渊篇': 12,
  '子路篇': 13, '宪问篇': 14, '卫灵公篇': 15,
  '季氏篇': 16, '阳货篇': 17, '微子篇': 18,
  '子张篇': 19, '尧曰篇': 20
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchText(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('\uFFFD')) {
        try {
          const gbkText = new TextDecoder('gbk').decode(buffer);
          if (!gbkText.includes('\uFFFD')) text = gbkText;
        } catch (e) {}
      }
      return text;
    } catch (e) {
      console.warn(`  [重试 ${i + 1}/${retries}] ${url} - ${e.message}`);
      await sleep(1500 * (i + 1));
    }
  }
  return '';
}

// 从主页 HTML 提取所有章节 URL
// HTML 结构:
//   <h2><a href="/2/xr/">论语·学而篇</a>...</h2>
//   <li><i>1.1</i><a href="/2/xr/3.html" target="_blank">原文<span>【翻译】</span></a></li>
function parseHomepage(html) {
  const verses = [];
  // 先按 h2 切分章节块
  const chapterBlockRegex = /<h2><a\s+href="[^"]*"[^>]*>(论语·([^<]+))<\/a>[\s\S]*?(?=<h2><a\s+href=|<\/ul>\s*<\/div>)/g;
  let chMatch;
  while ((chMatch = chapterBlockRegex.exec(html)) !== null) {
    const chName = chMatch[2].trim();
    const chapterId = chapterNameMap[chName];
    if (!chapterId) continue;
    const block = chMatch[0];
    // 匹配每个 <li><i>x.y</i><a href="url">text<span>【翻译】</span></a></li>
    const itemRegex = /<li><i>(\d+)\.(\d+)<\/i><a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/li>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(block)) !== null) {
      const chapterId2 = parseInt(itemMatch[1]);
      const order = parseInt(itemMatch[2]);
      const url = itemMatch[3].startsWith('http') ? itemMatch[3] : 'http://www.lunyu8.cn' + itemMatch[3];
      // 原文 = 去掉 <span>【翻译】</span> 后的纯文本
      const originalRaw = itemMatch[4].replace(/<span>[^<]*<\/span>/g, '');
      const originalText = originalRaw
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .trim();
      verses.push({ chapterId: chapterId2 || chapterId, order, original: originalText, url });
    }
  }
  return verses;
}

// 清理 HTML 标签，提取纯文本
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[\d]>/gi, '\n')
    .replace(/<ruby>/gi, '')
    .replace(/<rt>[^<]*<\/rt>/gi, '')
    .replace(/<\/ruby>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '……')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 通过 div class 提取某个区块的纯文本
function extractDiv(html, className) {
  // 匹配 <div class="className">...</div>，处理嵌套
  // 简化处理：从 <div class="className"> 开始，到下一个同级的 <div class="arctitle_
  const startPattern = new RegExp(`<div\\s+class="${className}"\\s*>`, 'i');
  const startMatch = html.match(startPattern);
  if (!startMatch) return '';
  const startIdx = startMatch.index + startMatch[0].length;
  // 找到下一个 arctitle_ div 的开始
  const rest = html.slice(startIdx);
  const nextDivMatch = rest.match(/<div\s+class="arctitle_/);
  const endIdx = nextDivMatch ? nextDivMatch.index : rest.indexOf('</div>');
  const content = nextDivMatch ? rest.slice(0, nextDivMatch.index) : rest.slice(0, endIdx);
  // 移除开头的 <h2>标题</h2>
  const withoutH2 = content.replace(/<h2>[^<]*<\/h2>/i, '');
  return stripHtml(withoutH2);
}

// 从章节页面提取译文和注释
function parseVersePage(html) {
  return {
    translation: extractDiv(html, 'arctitle_fanyi'),
    annotation: extractDiv(html, 'arctitle_zhushi'),
    commentary: extractDiv(html, 'arctitle_jiedu'),
    original: extractDiv(html, 'arctitle_yuanwen')
  };
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch (e) {
    return { verses: [] };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

async function main() {
  console.log('=== 论语8 抓取工具 ===\n');

  console.log('[1/3] 抓取主页...');
  const homeHtml = await fetchText(HOME_URL);
  if (!homeHtml) {
    console.error('无法抓取主页');
    process.exit(1);
  }
  fs.writeFileSync(path.join(__dirname, 'homepage.html'), homeHtml, 'utf-8');

  const allVerses = parseHomepage(homeHtml);
  console.log(`共发现 ${allVerses.length} 章经文\n`);

  let progress = loadProgress();
  if (progress.verses.length === 0) {
    progress.verses = allVerses.map(v => ({ ...v, translation: '', annotation: '', commentary: '', original8: '', fetched: false }));
  } else {
    allVerses.forEach(v => {
      const existing = progress.verses.find(x => x.chapterId === v.chapterId && x.order === v.order);
      if (!existing) {
        progress.verses.push({ ...v, translation: '', annotation: '', commentary: '', original8: '', fetched: false });
      } else if (!existing.url) {
        existing.url = v.url;
      }
    });
  }
  progress.verses.sort((a, b) => a.chapterId - b.chapterId || a.order - b.order);

  console.log('[2/3] 抓取每章经文...');
  const needFetch = progress.verses.filter(v => !v.fetched);
  console.log(`需要抓取 ${needFetch.length} 章，已缓存 ${progress.verses.length - needFetch.length} 章\n`);

  let fetched = 0;
  for (let i = 0; i < progress.verses.length; i++) {
    const v = progress.verses[i];
    if (v.fetched) continue;

    process.stdout.write(`[${i + 1}/${progress.verses.length}] 第${v.chapterId}篇第${v.order}章 ${v.url} ... `);
    const html = await fetchText(v.url);
    if (html) {
      const parsed = parseVersePage(html);
      v.translation = parsed.translation;
      v.annotation = parsed.annotation;
      v.commentary = parsed.commentary;
      v.original8 = parsed.original;
      v.fetched = true;
      fetched++;
      console.log(`OK (译${v.translation.length}字, 注${v.annotation.length}字, 解${v.commentary.length}字)`);
    } else {
      console.log('FAILED');
    }

    if (fetched % 10 === 0) saveProgress(progress);
    await sleep(300);
  }

  saveProgress(progress);

  console.log('\n[3/3] 保存结果...');
  const finalData = progress.verses.map(v => ({
    chapterId: v.chapterId,
    order: v.order,
    original: v.original,
    url: v.url,
    translation: v.translation,
    annotation: v.annotation,
    commentary: v.commentary,
    original8: v.original8
  }));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf-8');

  const hasTrans = finalData.filter(v => v.translation.length > 0).length;
  const hasAnno = finalData.filter(v => v.annotation.length > 0).length;
  const hasComm = finalData.filter(v => v.commentary.length > 0).length;
  console.log(`\n=== 完成 ===`);
  console.log(`总计: ${finalData.length} 章`);
  console.log(`有译文: ${hasTrans}, 有注释: ${hasAnno}, 有解读: ${hasComm}`);
  console.log(`结果保存至: ${OUTPUT_FILE}`);

  console.log('\n=== 样本（第1章） ===');
  const sample = finalData.find(v => v.chapterId === 1 && v.order === 1);
  if (sample) {
    console.log(`原文: ${sample.original.substring(0, 60)}...`);
    console.log(`译文: ${sample.translation.substring(0, 200)}`);
    console.log(`注释: ${sample.annotation.substring(0, 300)}`);
  }
}

main().catch(e => {
  console.error('运行出错:', e);
  process.exit(1);
});
