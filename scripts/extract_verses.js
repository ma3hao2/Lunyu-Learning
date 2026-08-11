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

const results = [];
let id = 1000;

for (const file of files) {
  try {
    const content = fs.readFileSync(path.join(mdDir, file), 'utf-8');
    
    // Extract frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    
    const fm = fmMatch[1];
    const chapterMatch = fm.match(/chapter:\s*"([^"]+)"/);
    const numberMatch = fm.match(/number:\s*(\d+)/);
    const themesMatch = fm.match(/themes:\n([\s\S]*?)(?:\n\w|$)/);
    
    if (!chapterMatch || !numberMatch) continue;
    
    const chapterName = chapterMatch[1];
    const chapterId = chapterMap[chapterName];
    const order = parseInt(numberMatch[1]);
    
    if (!chapterId) continue;
    
    // Extract original text (bold text after frontmatter)
    const bodyContent = content.slice(fmMatch[0].length);
    const boldMatches = bodyContent.match(/\*\*[""](.+?)[""]\*\*/g) 
                     || bodyContent.match(/\*\*(子曰|子.+?曰|[^：\n]{10,}?)\*\*/g);
    
    let original = '';
    // Find the first substantial bold text that looks like original text
    const boldTextMatch = bodyContent.match(/\*\*(.+?)\*\*/);
    if (boldTextMatch) {
      const text = boldTextMatch[1].trim();
      // Filter out headers, dates, short labels
      if (text.length > 10 && !text.startsWith('马：') && !text.startsWith('方：') 
          && !text.includes('论语学习心得') && !text.includes('正文共')) {
        // Clean quotes
        original = text.replace(/["""]/g, '"').replace(/[''']/g, '\'');
      }
    }
    
    // If we didn't find good bold text, look for quoted text with子曰 pattern
    if (!original) {
      const quMatch = bodyContent.match(/(["""].*?["""]|子曰[^。"'""']+|子[^曰]+曰[^。"'""']+)/);
      if (quMatch) {
        original = quMatch[0].replace(/["""]/g, '"').replace(/[''']/g, '\'').trim();
      }
    }
    
    // Extract key themes for keyPoint
    let keyPoint = '';
    if (themesMatch) {
      const themesList = themesMatch[1].trim().split('\n').map(l => l.trim().replace(/^-\s*/, ''));
      keyPoint = themesList.filter(t => t && !t.startsWith('themes')).join('、');
    }
    
    if (original && original.length > 8) {
      results.push({
        id: id++,
        chapterId,
        order,
        original: original.substring(0, 200),
        keyPoint: keyPoint || chapterName,
      });
    }
  } catch (e) {
    // skip errors
  }
}

// Sort by chapter and order
results.sort((a, b) => a.chapterId - b.chapterId || a.order - b.order);

// Output as TypeScript verses array (compact)
const output = results.map(v => 
  `  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${JSON.stringify(v.original)}, translation: '', commentary: '', keyPoint: ${JSON.stringify(v.keyPoint)} }`
).join(',\n');

fs.writeFileSync('d:\\Software\\lunyu-miniapp\\scripts\\extracted_verses.txt', output, 'utf-8');
console.log(`Extracted ${results.length} verses from ${files.length} files`);

// Also print chapter counts
const chapterCounts = {};
results.forEach(v => {
  chapterCounts[v.chapterId] = (chapterCounts[v.chapterId] || 0) + 1;
});
console.log('Chapter counts:', JSON.stringify(chapterCounts, null, 2));
