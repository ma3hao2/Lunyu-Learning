/**
 * 将 verses.ts 拆分为按篇章的数据文件
 * - src/data/verses/chapter1.ts ~ chapter20.ts（完整数据）
 * - src/data/versesIndex.ts（轻量索引，只含 id/chapterId/order/original前30字）
 *
 * 运行: node scripts/split_verses.js
 */

const fs = require('fs');
const path = require('path');

const versesTs = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'verses.ts'), 'utf-8');

// 解析所有 verse
const regex = /\{\s*id:\s*(\d+),\s*chapterId:\s*(\d+),\s*order:\s*(\d+),\s*original:\s*"((?:[^"\\]|\\.)*)",\s*translation:\s*"((?:[^"\\]|\\.)*)",\s*commentary:\s*"((?:[^"\\]|\\.)*)",\s*keyPoint:\s*"([^"]*)"\s*\}/g;
const verses = [];
let m;
while ((m = regex.exec(versesTs)) !== null) {
  verses.push({
    id: parseInt(m[1]),
    chapterId: parseInt(m[2]),
    order: parseInt(m[3]),
    original: m[4],
    translation: m[5],
    commentary: m[6],
    keyPoint: m[7]
  });
}
console.log(`解析到 ${verses.length} 条经文`);

// 创建 verses 目录
const versesDir = path.join(__dirname, '..', 'src', 'data', 'verses');
if (!fs.existsSync(versesDir)) fs.mkdirSync(versesDir, { recursive: true });

// 按篇章分组并写入文件
const indexData = [];
for (let ch = 1; ch <= 20; ch++) {
  const chVerses = verses.filter(v => v.chapterId === ch).sort((a, b) => a.order - b.order);
  if (chVerses.length === 0) continue;

  // 完整数据文件
  const content = `import { Verse } from '@/types';

export const chapter${ch}Verses: Verse[] = [
${chVerses.map(v => `  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${JSON.stringify(v.original)}, translation: ${JSON.stringify(v.translation)}, commentary: ${JSON.stringify(v.commentary)}, keyPoint: ${JSON.stringify(v.keyPoint)} }`).join(',\n')}
];
`;
  fs.writeFileSync(path.join(versesDir, `chapter${ch}.ts`), content, 'utf-8');

  // 索引数据（轻量）
  chVerses.forEach(v => {
    indexData.push({
      id: v.id,
      chapterId: v.chapterId,
      order: v.order,
      original: v.original.length > 40 ? v.original.substring(0, 40) + '...' : v.original
    });
  });
}

// 写入索引文件
const indexContent = `// 论语轻量索引（用于搜索和列表展示，完整数据按需加载）
// 共 ${indexData.length} 条

export interface VerseIndex {
  id: number;
  chapterId: number;
  order: number;
  original: string;
}

export const versesIndex: VerseIndex[] = [
${indexData.map(v => `  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${JSON.stringify(v.original)} }`).join(',\n')}
];
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'versesIndex.ts'), indexContent, 'utf-8');

console.log(`已生成 20 个篇章文件 + 1 个索引文件`);
console.log(`索引条目: ${indexData.length}`);

// 检查文件大小
const indexSize = Buffer.byteLength(indexContent, 'utf-8');
console.log(`索引文件大小: ${(indexSize / 1024).toFixed(1)} KB`);
