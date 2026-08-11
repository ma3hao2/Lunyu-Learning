/**
 * 从 src/data/verses/chapterN.ts 重新生成轻量索引 versesIndex.ts
 * 索引字段：id, chapterId, order, original（仅原文，体积最小）
 * 译文和注释不进索引，通过 loadChapter / loadAllVerses 按需加载用于深度搜索
 *
 * 运行：node scripts/regenerate_index.cjs
 */
const fs = require('fs');
const path = require('path');

const versesDir = path.join(__dirname, '..', 'src', 'data', 'verses');
const outFile = path.join(__dirname, '..', 'src', 'data', 'versesIndex.ts');
const index = [];

let truncatedBefore = 0;

for (let i = 1; i <= 20; i++) {
  const filePath = path.join(versesDir, `chapter${i}.ts`);
  let content = fs.readFileSync(filePath, 'utf-8');
  // 剥离类型导入与类型注解，转为可执行 JS
  content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"]@\/types['"];?/g, '');
  content = content.replace(/export const (chapter\d+Verses):\s*Verse\[\]\s*=/, 'const $1 =');
  // 在函数作用域内求值
  // eslint-disable-next-line no-new-func
  const fn = new Function(content + `\nreturn chapter${i}Verses;`);
  const verses = fn();
  for (const v of verses) {
    if (v.original && v.original.endsWith('...')) truncatedBefore++;
    index.push({ id: v.id, chapterId: v.chapterId, order: v.order, original: v.original });
  }
}

index.sort((a, b) => a.id - b.id);

// 生成 TS 文件内容
let output = `// 论语轻量索引（用于搜索和列表展示，完整数据按需加载）\n`;
output += `// 共 ${index.length} 条（由 scripts/regenerate_index.cjs 从完整章节数据生成）\n`;
output += `// 仅含 original；translation 和 commentary 通过 loadAllVerses 按需加载用于深度搜索\n\n`;
output += `export interface VerseIndex {\n  id: number;\n  chapterId: number;\n  order: number;\n  original: string;\n}\n\n`;
output += `export const versesIndex: VerseIndex[] = [\n`;
for (const v of index) {
  // 转义反斜杠与双引号，确保 TS 字符串字面量合法
  const escaped = String(v.original)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  output += `  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: "${escaped}" },\n`;
}
output += `];\n`;

fs.writeFileSync(outFile, output, 'utf-8');
console.log(`✓ 已重新生成 versesIndex.ts：共 ${index.length} 条`);
console.log(`  修复前被截断（以 ... 结尾）的条目数：${truncatedBefore}`);

