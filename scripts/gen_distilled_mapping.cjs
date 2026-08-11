/**
 * 建立 论语学习心得/*.md → src/data/verses 的 verseId 映射（v4，内容匹配优先）
 *
 * 关键事实：
 *  - 心得编号存在"跳章"（作者未写部分章节，如公冶长缺"子谓南容"），故 (chapter, order) 可能错位
 *  - 以 title 原文片段的内容匹配为主，(chapter, order) 为兜底
 *
 * 输出：.tmp/verse_mapping.json（mapped 为最终提炼清单）
 * 运行：node scripts/gen_distilled_mapping.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, '论语学习心得');
const VERSES_DIR = path.join(ROOT, 'src', 'data', 'verses');
const OUT_DIR = path.join(ROOT, '.tmp');
const OUT_FILE = path.join(OUT_DIR, 'verse_mapping.json');

const CHAPTER_NAME_MAP = {
  '学而第一': 1, '为政第二': 2, '八佾第三': 3, '里仁第四': 4, '公冶长第五': 5,
  '雍也第六': 6, '述而第七': 7, '泰伯第八': 8, '子罕第九': 9, '乡党第十': 10,
  '先进第十一': 11, '颜渊第十二': 12, '子路第十三': 13, '宪问第十四': 14,
  '卫灵公第十五': 15, '季氏第十六': 16, '阳货第十七': 17, '微子第十八': 18,
  '子张第十九': 19, '尧曰第二十': 20,
};
const CHAPTER_FIRST = { 1: 1, 2: 17, 3: 41, 4: 67, 5: 93, 6: 120, 7: 150, 8: 187, 9: 208, 10: 239, 11: 266, 12: 291, 13: 315, 14: 345, 15: 389, 16: 431, 17: 445, 18: 471, 19: 482, 20: 507 };

function parseVerses() {
  const verses = [];
  for (let ch = 1; ch <= 20; ch++) {
    const content = fs.readFileSync(path.join(VERSES_DIR, `chapter${ch}.ts`), 'utf-8');
    const re = /\{\s*id:\s*(\d+),\s*chapterId:\s*(\d+),\s*order:\s*(\d+),\s*original:\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      verses.push({ id: +m[1], chapterId: +m[2], order: +m[3], original: m[4] });
    }
  }
  return verses;
}

function parseFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];
  const get = (key) => {
    const r = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return { chapter: get('chapter'), number: get('number'), title: get('title') };
}

// 归一化：去空白/标点/零宽字符
function norm(s) {
  return String(s)
    .replace(/[\u200b-\u200d\ufeff\u00a0\u3000]/g, '')
    .replace(/[\s，。！？、；：""''（）()《》〈〉·…,.;:!?'‘’“”]/g, '');
}

function main() {
  const verses = parseVerses();
  const lookup = new Map();
  for (const v of verses) lookup.set(`${v.chapterId}:${v.order}`, v);
  const byId = new Map(verses.map((v) => [v.id, v]));

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'));
  const records = [];
  const skipped = [];

  for (const f of files) {
    const fm = parseFrontmatter(path.join(SRC_DIR, f));
    if (!fm || !fm.chapter || fm.number === null) {
      skipped.push({ file: f, reason: '非心得文件或 frontmatter 缺失' });
      continue;
    }
    const chapterId = CHAPTER_NAME_MAP[fm.chapter];
    const number = parseInt(fm.number, 10);
    if (!chapterId || Number.isNaN(number)) {
      skipped.push({ file: f, reason: '无法解析篇名/编号' });
      continue;
    }
    const title = fm.title || f;
    const afterBracket = title.includes('）') ? title.split('）').slice(1).join('') : title;
    const snippet = norm(afterBracket);
    records.push({ file: f, chapter: fm.chapter, chapterId, number, title, snippet });
  }

  // 内容匹配：返回 {verse, hitType: 'unique'|'sameChapter'|'multi'|'none'}
  function contentMatch(r) {
    if (!r.snippet) return { verse: null, hitType: 'none' };
    const headLen = Math.min(r.snippet.length, 12);
    const head = r.snippet.slice(0, headLen);
    const hits = verses.filter((v) => norm(v.original).includes(head));
    if (hits.length === 0) return { verse: null, hitType: 'none' };
    if (hits.length === 1) return { verse: hits[0], hitType: 'unique' };
    const sameCh = hits.filter((v) => v.chapterId === r.chapterId);
    if (sameCh.length === 1) return { verse: sameCh[0], hitType: 'sameChapter' };
    return { verse: hits[0], hitType: 'multi', candidates: hits.map((v) => v.id) };
  }

  const mapped = [];
  const duplicates = [];
  const problems = [];
  const usedVerseIds = new Set();

  // 处理顺序：内容命中且同篇的优先（防止 chapter 标错的副本抢占 verse）
  const scored = records.map((r) => {
    const cm = contentMatch(r);
    const orderByNumber = r.number - CHAPTER_FIRST[r.chapterId] + 1;
    const verseByNumber = lookup.get(`${r.chapterId}:${orderByNumber}`);
    let priority = 3; // 默认最低：跨篇内容命中
    if (cm.verse && cm.verse.chapterId === r.chapterId) priority = 0;
    else if (verseByNumber && cm.verse && cm.verse.id === verseByNumber.id) priority = 0;
    else if (verseByNumber) priority = 1;
    else if (cm.verse) priority = 2;
    return { r, cm, priority };
  });
  scored.sort((a, b) => a.priority - b.priority);

  for (const { r, cm } of scored) {
    const orderByNumber = r.number - CHAPTER_FIRST[r.chapterId] + 1;
    const verseByNumber = lookup.get(`${r.chapterId}:${orderByNumber}`);

    let verse = null;
    let source = '';
    if (cm.verse) {
      if (verseByNumber && cm.verse.id === verseByNumber.id) {
        verse = cm.verse; source = 'content+number';
      } else if (cm.hitType === 'unique' || cm.hitType === 'sameChapter') {
        verse = cm.verse; source = 'content';
      } else if (verseByNumber && cm.candidates && cm.candidates.includes(verseByNumber.id)) {
        verse = verseByNumber; source = 'contentMulti+number';
      } else {
        verse = cm.verse; source = 'contentMulti';
      }
    } else if (verseByNumber) {
      verse = verseByNumber; source = 'numberOnly(unverified)';
    }

    if (!verse) {
      problems.push({ file: r.file, reason: `无匹配：number order=${orderByNumber} 无 verse，内容无命中` });
      continue;
    }

    if (usedVerseIds.has(verse.id)) {
      duplicates.push({ file: r.file, reason: `重复：id=${verse.id} 已被占用（source=${source}）` });
      continue;
    }
    usedVerseIds.add(verse.id);
    mapped.push({ file: r.file, chapter: r.chapter, chapterId: r.chapterId, number: r.number, order: verse.order, verseId: verse.id, verseOriginal: verse.original, source, note: source.startsWith('numberOnly') ? '仅编号定位，内容未校验' : '' });
  }

  const unverified = mapped.filter((m) => m.source.startsWith('numberOnly'));
  const contentFixed = mapped.filter((m) => m.source === 'content' || m.source === 'contentMulti');
  const unmatchedVerses = verses.filter((v) => !usedVerseIds.has(v.id));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ mapped, duplicates, problems, skipped, unmatchedVerses: unmatchedVerses.map((v) => ({ id: v.id, chapterId: v.chapterId, order: v.order, original: v.original })) }, null, 2), 'utf-8');

  console.log(`文件总数: ${files.length}`);
  console.log(`最终提炼清单: ${mapped.length}`);
  console.log(`  其中 content+number 确认: ${mapped.filter((m) => m.source === 'content+number').length}`);
  console.log(`  其中 content 单独命中: ${contentFixed.length}`);
  console.log(`  其中 numberOnly 未校验: ${unverified.length}`);
  console.log(`重复副本(排除): ${duplicates.length}`);
  console.log(`无法映射: ${problems.length}`);
  console.log(`跳过(非心得): ${skipped.length}`);
  console.log(`未被覆盖 verse: ${unmatchedVerses.length}`);
  console.log('--- 无法映射 ---');
  problems.forEach((p) => console.log(`  ${p.file}: ${p.reason}`));
  console.log('--- numberOnly 未校验(前60) ---');
  unverified.slice(0, 60).forEach((m) => console.log(`  ${m.file}\n    -> id=${m.verseId} 篇${m.chapterId}第${m.order}章: ${m.verseOriginal.slice(0, 36)}`));
  console.log('--- 未被覆盖 verse ---');
  unmatchedVerses.forEach((v) => console.log(`  id=${v.id} 篇${v.chapterId}第${v.order}章: ${v.original.slice(0, 34)}`));

  // 跨篇检查：source 含 content 且 verse 所属篇与文件 chapter 不一致
  const contentMapped = mapped.filter((m) => m.source.startsWith('content'));
  const cross = contentMapped.filter((m) => m.verseId !== 0 && byId.get(m.verseId) && byId.get(m.verseId).chapterId !== m.chapterId);
  console.log(`--- 内容命中但跨篇(可疑误配): ${cross.length} ---`);
  cross.forEach((m) => console.log(`  ${m.file}\n    -> verseId=${m.verseId} 篇${byId.get(m.verseId).chapterId}第${byId.get(m.verseId).order}章: ${m.verseOriginal.slice(0, 36)} [src=${m.source}]`));
}

main();
