const fs = require('fs');

// Read extracted data
const raw = fs.readFileSync('d:\\Software\\lunyu-miniapp\\scripts\\extracted_verses.txt', 'utf-8');

// Parse each verse entry and clean up
const lines = raw.split('\n');
const cleaned = [];
let currentId = 101;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line.startsWith('{')) continue;
  
  // Extract fields
  const idMatch = line.match(/id:\s*(\d+)/);
  const chapterMatch = line.match(/chapterId:\s*(\d+)/);
  const orderMatch = line.match(/order:\s*(\d+)/);
  const originalMatch = line.match(/original:\s*"([^"]*)"/);
  // keyPoint might use Chinese quotes
  const keyPointMatch = line.match(/keyPoint:\s*"([^"]*)"/);
  
  if (!chapterMatch || !orderMatch) continue;
  
  const chapterId = parseInt(chapterMatch[1]);
  const order = parseInt(orderMatch[1]);
  let original = originalMatch ? originalMatch[1] : '';
  let keyPoint = keyPointMatch ? keyPointMatch[1] : '';
  
  // Clean original text
  original = original
    .replace(/\*\*/g, '')
    .replace(/[""＂]/g, '"')
    .replace(/[''＇]/g, "'")
    .replace(/\\n作者:.*$/g, '')
    .replace(/\n作者:[\s\S]*$/g, '')
    .trim();
  
  // Skip if original is too short or starts with metadata
  if (original.length < 8 || original.startsWith('原文链接') || original.startsWith('作者')) continue;
  
  // Re-assign sequential IDs per chapter
  cleaned.push({
    id: currentId++,
    chapterId,
    order,
    original: original.length > 250 ? original.substring(0, 247) + '...' : original,
    keyPoint
  });
}

// Group by chapter for re-ordering
const chapterVerses = {};
cleaned.forEach(v => {
  if (!chapterVerses[v.chapterId]) chapterVerses[v.chapterId] = [];
  chapterVerses[v.chapterId].push(v);
});

// Re-assign order within each chapter (sequential from 1)
let newId = 101;
const finalVerses = [];
for (let ch = 1; ch <= 20; ch++) {
  if (chapterVerses[ch]) {
    chapterVerses[ch].sort((a, b) => a.order - b.order);
    chapterVerses[ch].forEach((v, idx) => {
      finalVerses.push({
        id: newId++,
        chapterId: ch,
        order: idx + 1,
        original: v.original,
        keyPoint: v.keyPoint
      });
    });
  }
}

// Generate TypeScript file
const header = `import { Verse } from '@/types';

// 论语二十篇完整内容（共${finalVerses.length}章）
// 原文提取自马豪的知识库论语逐句解读系列
// keyPoint 为马豪知识库中标注的主题标签

export const verses: Verse[] = [`;

const entries = finalVerses.map(v => {
  const orig = JSON.stringify(v.original);
  const kp = JSON.stringify(v.keyPoint || '');
  return `\n  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${orig}, translation: '', commentary: '', keyPoint: ${kp} }`;
}).join(',');

const footer = `\n];
`;

const output = header + entries + footer;
fs.writeFileSync('d:\\Software\\lunyu-miniapp\\src\\data\\verses.ts', output, 'utf-8');

// Update chapter verse counts
const chapterCounts = {};
finalVerses.forEach(v => {
  chapterCounts[v.chapterId] = (chapterCounts[v.chapterId] || 0) + 1;
});

console.log(`Generated ${finalVerses.length} verses across 20 chapters`);
console.log('Chapter counts:', JSON.stringify(chapterCounts, null, 2));
