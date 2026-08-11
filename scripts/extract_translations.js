const fs = require('fs');
const path = require('path');

const mdDir = 'd:\\Software\\马豪的知识库\\10-笔记\\论语学习心得';
const files = fs.readdirSync(mdDir).filter(f => f.endsWith('.md') && f !== '论语学习心得MOC.md');

const chapterMap = {
  '学而第一': 1, '为政第二': 2, '八佾第三': 3, '里仁第四': 4,
  '公冶长第五': 5, '雍也第六': 6, '述而第七': 7, '泰伯第八': 8,
  '子罕第九': 9, '乡党第十': 10, '先进第十一': 11, '颜渊第十二': 12,
  '子路第十三': 13, '宪问第十四': 14, '卫灵公第十五': 15,
  '季氏第十六': 16, '阳货第十七': 17, '微子第十八': 18,
  '子张第十九': 19, '尧曰第二十': 20
};

function clean(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/!\[\]\(\)/g, '')
    .replace(/\[图片\]/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Split body into 马/方 dialogue turns with labels
function parseDialogue(body) {
  // Remove metadata lines
  const cleanBody = body
    .replace(/^#.*$/gm, '')
    .replace(/!\[\]\(\)/g, '')
    .replace(/\[图片\]/g, '')
    .replace(/^---$/gm, '')
    .replace(/>\s*\*\*摘要\*\*[：:].*/g, '')
    .replace(/\*\*发布时间\*\*.*/g, '')
    .replace(/\*\*原文链接\*\*.*/g, '')
    .replace(/\*\*阅读数\*\*.*/g, '')
    .replace(/\*\*点赞数\*\*.*/g, '')
    .replace(/正文共.*/g, '')
    .replace(/预计阅读时间.*/g, '')
    .replace(/Confucius.*/g, '');

  // Try bold format: **马：** and **方：**
  let turns = [];
  const boldPattern = /\*\*(马|方)[：:]\*\*([\s\S]*?)(?=\*\*(?:马|方)[：:]\*\*|$)/g;
  let match;
  while ((match = boldPattern.exec(cleanBody)) !== null) {
    const speaker = match[1];
    const text = clean(match[2].replace(/今天我们的学习就到这里.*/s, '').trim());
    if (text.length > 5) {
      turns.push({ speaker, text });
    }
  }

  // If no bold turns found, try plain format: 马： and 方：
  if (turns.length === 0) {
    const plainPattern = /(?:^|\n)\s*(马|方)[：:]\s*([\s\S]*?)(?=\n\s*(?:马|方)[：:]|$)/g;
    while ((match = plainPattern.exec(cleanBody)) !== null) {
      const speaker = match[1];
      const text = clean(match[2].replace(/今天我们的学习就到这里.*/s, '').trim());
      if (text.length > 5) {
        turns.push({ speaker, text });
      }
    }
  }

  return turns;
}

// Extract translation: 方's response, filter out questions and meta-talk
function extractTranslation(turns) {
  // Find 方's turns that contain actual translation (not just questions)
  const fangTurns = turns.filter(t => t.speaker === '方');
  
  for (const turn of fangTurns) {
    let text = turn.text;
    // Skip if it's mostly questions or meta-talk
    if (text.includes('孔子说') || text.includes('曾子说') || text.includes('子曰') === false) {
      // Check if it looks like a translation (contains "说：" or "孔子说" etc.)
      if (text.length > 20 && 
          !text.startsWith('好呀') && !text.startsWith('好的') && 
          !text.startsWith('好。') === false) {
        // Remove leading conversational filler
        text = text.replace(/^(好[呀的。！，]?\s*)/, '');
        // Remove trailing questions/discussion
        const questionIdx = text.search(/我的疑问|我有疑问|我不太理解|为什么|这样说的话|我有个问题/);
        if (questionIdx > 20) {
          text = text.substring(0, questionIdx).trim();
        }
        if (text.length > 15) return text.substring(0, 300);
      }
    }
  }
  
  // Fallback: 方's first turn
  if (fangTurns.length > 0) {
    let text = fangTurns[0].text
      .replace(/^(好[呀的。！，]?\s*)/, '')
      .replace(/我的疑问.*$/s, '')
      .replace(/我有疑问.*$/s, '')
      .replace(/我不太理解.*$/s, '')
      .trim();
    if (text.length > 10) return text.substring(0, 300);
  }

  // Fallback: any turn containing translation markers
  for (const turn of turns) {
    if (turn.text.includes('孔子说：') || turn.text.includes('曾子说：') || 
        turn.text.includes('子曰：')) {
      // Extract the translation sentence
      const transMatch = turn.text.match(/((?:孔子|曾子|有子|子夏|子贡|子路|颜渊|冉有|季子|子游|子张|闵子|宰我|子禽|子贡)说[：:][^。]+。[^。]*。)/);
      if (transMatch) return transMatch[1].substring(0, 300);
    }
  }

  return '';
}

// Extract commentary: 马's deep analysis turns (skip opening remarks)
function extractCommentary(turns) {
  const maTurns = turns.filter(t => t.speaker === '马');
  
  // Skip first 马 turn (usually opening: "我们今天来学习..."), use the rest
  const commentaryTurns = maTurns.length > 1 ? maTurns.slice(1) : maTurns;
  
  const combined = commentaryTurns.map(t => t.text).join(' ');
  
  // Remove common opening phrases
  let cleaned = combined
    .replace(/^(很好[。！]?\s*|翻译的还挺好[。！]?\s*|好的[。！]?\s*|对[。！]?\s*)/, '')
    .trim();
  
  if (cleaned.length > 20) return cleaned.substring(0, 500);
  
  // Fallback: all 马 turns combined
  const allMa = maTurns.map(t => t.text).join(' ');
  if (allMa.length > 20) return allMa.substring(0, 500);
  
  return '';
}

function extractOriginal(body, fallbackTitle) {
  // Method 1: bold text that looks like original
  const boldMatches = body.match(/\*\*(.+?)\*\*/g);
  if (boldMatches) {
    for (const m of boldMatches) {
      const t = m.replace(/\*\*/g, '').trim();
      if (t.length > 10 && 
          !t.includes('发布时间') && !t.includes('原文链接') && 
          !t.includes('阅读数') && !t.includes('点赞数') &&
          !t.includes('摘要') && !t.includes('论语学习心得') &&
          !t.includes('正文共') && !t.startsWith('马') && !t.startsWith('方')) {
        return clean(t);
      }
    }
  }
  
  // Method 2: Summary block
  const summaryMatch = body.match(/>\s*\*\*摘要\*\*[：:]\s*(.+)/);
  if (summaryMatch) {
    const t = clean(summaryMatch[1]);
    if (t.length > 8) return t;
  }
  
  // Method 3: Heading title
  const titleMatch = body.match(/^#\s*论语学习心得[—\-–].+?\d+\)\s*(.+)/m);
  if (titleMatch) {
    const t = clean(titleMatch[1]);
    if (t.length > 8) return t;
  }
  
  // Method 4: filename
  if (fallbackTitle && fallbackTitle.length > 8) return clean(fallbackTitle);
  
  return '';
}

const results = [];
for (const file of files) {
  try {
    const content = fs.readFileSync(path.join(mdDir, file), 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    const chMatch = fm.match(/chapter:\s*"([^"]+)"/);
    const numMatch = fm.match(/number:\s*(\d+)/);
    if (!chMatch || !numMatch) continue;
    const chapterId = chapterMap[chMatch[1]];
    const order = parseInt(numMatch[1]);
    if (!chapterId) continue;

    const body = content.slice(fmMatch[0].length);
    const fnMatch = file.match(/\)\s*(.+?)\.md$/);
    const fallbackTitle = fnMatch ? fnMatch[1].substring(0, 150) : '';

    const original = extractOriginal(body, fallbackTitle);
    const turns = parseDialogue(body);
    const translation = extractTranslation(turns);
    const commentary = extractCommentary(turns);

    if (original && original.length > 8) {
      results.push({ chapterId, order, original, translation, commentary });
    }
  } catch (e) { }
}

results.sort((a, b) => a.chapterId - b.chapterId || a.order - b.order);

let id = 101;
const final = [];
const chVerses = {};
results.forEach(v => {
  if (!chVerses[v.chapterId]) chVerses[v.chapterId] = [];
  chVerses[v.chapterId].push(v);
});
for (let ch = 1; ch <= 20; ch++) {
  if (chVerses[ch]) {
    chVerses[ch].sort((a, b) => a.order - b.order);
    chVerses[ch].forEach((v, idx) => {
      final.push({ ...v, id: id++, order: idx + 1 });
    });
  }
}

// Get keyPoints
let keyPoints = {};
try {
  const lines = fs.readFileSync('d:\\Software\\lunyu-miniapp\\scripts\\extracted_verses.txt', 'utf-8').split('\n');
  for (const line of lines) {
    const cm = line.match(/chapterId:\s*(\d+)/);
    const km = line.match(/keyPoint:\s*"([^"]*)"/);
    if (cm && km) {
      const cid = parseInt(cm[1]);
      if (!keyPoints[cid]) keyPoints[cid] = [];
      keyPoints[cid].push(km[1]);
    }
  }
} catch (e) {}

const header = `import { Verse } from '@/types';

// 论语二十篇完整内容（共${final.length}章）
// 来源：马豪的知识库 论语逐句解读系列
// translation = 方同学的白话翻译，commentary = 马老师的深度解读

export const verses: Verse[] = [`;

const entries = final.map(v => {
  const orig = JSON.stringify(v.original);
  const trans = JSON.stringify(v.translation);
  const comm = JSON.stringify(v.commentary);
  const chKps = keyPoints[v.chapterId] || [];
  const kp = chKps[v.order - 1] || '';
  return `\n  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${orig}, translation: ${trans}, commentary: ${comm}, keyPoint: ${JSON.stringify(kp)} }`;
}).join(',');

fs.writeFileSync('d:\\Software\\lunyu-miniapp\\src\\data\\verses.ts', header + entries + '\n];\n', 'utf-8');

const counts = {};
final.forEach(v => { counts[v.chapterId] = (counts[v.chapterId] || 0) + 1; });
const hasTrans = final.filter(v => v.translation.length > 0).length;
const hasComm = final.filter(v => v.commentary.length > 0).length;
console.log(`Generated ${final.length} verses`);
console.log(`With translation: ${hasTrans}, With commentary: ${hasComm}`);
console.log('Counts:', JSON.stringify(counts));

// Print samples
console.log('\n=== SAMPLE (first 3) ===');
final.slice(0, 3).forEach(v => {
  console.log(`\n[${v.chapterId}-${v.order}] ${v.original.substring(0, 50)}`);
  console.log(`  译文: ${v.translation.substring(0, 100)}`);
  console.log(`  注释: ${v.commentary.substring(0, 100)}`);
});
