/**
 * 从 .tmp/verse_mapping.json 生成提炼计划：目标文件名 {verseId}_{篇名}_{原文片段}.md
 * 文件名片段规则（对齐 4 个样本）：
 *   去掉开头"X曰："标记 → 按标点切分 → 累积各段(去标点) 直到 ≥6 字（或到句读且≥6字），超 14 字截断
 * 输出：.tmp/distilled_plan.json（含 chapterName/orderCN/snippet/fileName）
 * 运行：node scripts/build_distilled_plan.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAP_FILE = path.join(ROOT, '.tmp', 'verse_mapping.json');
const OUT_FILE = path.join(ROOT, '.tmp', 'distilled_plan.json');

const CHAPTER_CN = {
  1: '学而第一', 2: '为政第二', 3: '八佾第三', 4: '里仁第四', 5: '公冶长第五',
  6: '雍也第六', 7: '述而第七', 8: '泰伯第八', 9: '子罕第九', 10: '乡党第十',
  11: '先进第十一', 12: '颜渊第十二', 13: '子路第十三', 14: '宪问第十四',
  15: '卫灵公第十五', 16: '季氏第十六', 17: '阳货第十七', 18: '微子第十八',
  19: '子张第十九', 20: '尧曰第二十',
};

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cnNumber(n) {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return '十' + (n % 10 === 0 ? '' : CN_NUM[n % 10]);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return CN_NUM[tens] + '十' + (ones === 0 ? '' : CN_NUM[ones]);
}

// 去引号/空白，保留正文
function stripQuotes(s) {
  return String(s).replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '');
}

function buildSnippet(original) {
  let text = stripQuotes(original);
  // 去掉开头"X曰："等说话标记（含冒号与引号）
  const m = text.match(/^(.{1,14}?曰)[：:]?/);
  if (m) text = text.slice(m[1].length).replace(/^[：:]/g, '');
  text = stripQuotes(text);
  // 按标点切分
  const parts = text.split(/[，。！？、；,.;:：!?]/).filter((p) => p.trim());
  let acc = '';
  for (const p of parts) {
    let seg = p.replace(/[""'“”‘’\u200b-\u200d\ufeff\u00a0\u3000\s]/g, '');
    if (!seg) continue;
    acc += seg;
    if (acc.length >= 6) break;
  }
  if (acc.length > 14) acc = acc.slice(0, 14);
  return acc;
}

function main() {
  const { mapped } = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
  const plan = mapped.map((m) => {
    const chapterName = CHAPTER_CN[m.chapterId];
    const orderCN = '第' + cnNumber(m.order) + '章';
    const snippet = buildSnippet(m.verseOriginal);
    const fileName = `${m.verseId}_${chapterName}_${snippet}.md`;
    return {
      verseId: m.verseId, chapterId: m.chapterId, chapterName, order: m.order, orderCN,
      number: m.number, snippet, fileName, sourceFile: m.file,
      original: m.verseOriginal,
    };
  });
  plan.sort((a, b) => a.verseId - b.verseId);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(plan, null, 2), 'utf-8');

  console.log(`提炼计划共 ${plan.length} 篇`);
  console.log('--- 文件名一览（前 120 个） ---');
  plan.slice(0, 120).forEach((p) => console.log(`  ${p.fileName}`));
  console.log(`  ...（共 ${plan.length} 篇）`);
}

main();
