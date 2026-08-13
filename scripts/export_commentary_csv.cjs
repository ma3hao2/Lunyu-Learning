// 导出 509 条章句（原文/译文/AI 注释/关键词）为 CSV，供发布前人工抽查
// 用法：node scripts/export_commentary_csv.cjs [输出路径]
// 输出：UTF-8 BOM（Excel 直接打开不乱码），字段内换行用引号包裹保留
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSES_DIR = path.join(ROOT, 'src', 'data', 'verses');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'ai-commentary-review-20260813.csv');

// ---------- 读取 chapters.ts 的篇名 ----------
function loadChapters() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'chapters.ts'), 'utf8');
  const map = new Map();
  // 形如 { id: 1, title: '学而第一', ... }
  const re = /id:\s*(\d+)[^}]*?title:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    map.set(Number(m[1]), m[2]);
  }
  return map;
}

// ---------- 读取 chapter*.ts 的 Verse 数组（剥离 TS 语法后 eval） ----------
function loadChapterVerses(file) {
  const src = fs.readFileSync(path.join(VERSES_DIR, file), 'utf8');
  const start = src.indexOf('[');
  const end = src.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error(`无法解析 ${file}`);
  const body = src.slice(start, end + 1);
  // 数据文件为自己生成的无类型注解对象数组字面量，eval 解析（避免引入 TS 编译链）
  // eslint-disable-next-line no-eval
  return eval(body);
}

// ---------- CSV 转义 ----------
function csvField(v) {
  if (v == null) return '';
  const s = String(v)
    // 字面 \n（反斜杠+n，源数据中分隔注释条目）统一为真实换行，便于阅读
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ---------- 主流程 ----------
const chapters = loadChapters();
const verses = [];
let diag = { literalBackslashN: 0, realNewline: 0, hasCommentary: 0 };

const files = fs.readdirSync(VERSES_DIR).filter(f => /^chapter\d+\.ts$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
for (const f of files) {
  const list = loadChapterVerses(f);
  for (const v of list) {
    if (v.commentary) {
      diag.hasCommentary++;
      if (v.commentary.includes('\\n')) diag.literalBackslashN++;
      if (v.commentary.includes('\n')) diag.realNewline++;
    }
    verses.push(v);
  }
}

const header = ['章句编号', '篇名', '原文', '译文', 'AI注释', '关键词'];
const rows = verses.map(v => [
  // Excel 会把裸写的 "1-1" 自动识别为日期（1月1日），用 ="1-1" 强制文本格式显示
  `="${v.chapterId}-${v.order}"`,
  chapters.get(v.chapterId) || `第${v.chapterId}篇`,
  v.original,
  v.translation,
  v.commentary,
  v.keyPoint
]);

const csv = '\uFEFF' + [header, ...rows].map(r => r.map(csvField).join(',')).join('\n');
fs.writeFileSync(OUT, csv, 'utf8');

// ---------- 校验 ----------
const total = verses.length;
const noCommentary = verses.filter(v => !v.commentary).map(v => `${v.chapterId}-${v.order}`);
const noOriginal = verses.filter(v => !v.original).map(v => `${v.chapterId}-${v.order}`);
const ids = new Set(verses.map(v => v.id));
const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1);

console.log(`已导出: ${OUT}`);
console.log(`章句总数: ${total}（id 唯一: ${ids.size === total}）`);
console.log(`缺注释: ${noCommentary.length}${noCommentary.length ? ' -> ' + noCommentary.join(',') : ''}`);
console.log(`缺原文: ${noOriginal.length}${noOriginal.length ? ' -> ' + noOriginal.join(',') : ''}`);
console.log(`文件大小: ${sizeKB} KB`);
console.log(`[诊断] commentary 含字面 \\n 的条目: ${diag.literalBackslashN}，含真实换行的条目: ${diag.realNewline}`);
