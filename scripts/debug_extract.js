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

// Check 5 random files that might fail
const failed = [];
for (const file of files.slice(0, 20)) {
  const content = fs.readFileSync(path.join(mdDir, file), 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) { failed.push(file + ' [no fm]'); continue; }
  const fm = fmMatch[1];
  const chMatch = fm.match(/chapter:\s*"([^"]+)"/);
  const numMatch = fm.match(/number:\s*(\d+)/);
  if (!chMatch || !numMatch) { failed.push(file + ' [no ch/num]'); continue; }
  
  const body = content.slice(fmMatch[0].length);
  const firstBold = body.match(/\*\*(.+?)\*\*/);
  
  // Check dialogue markers
  const hasDialogue = /\*\*马[：:]\*\*/.test(body) || /\*\*方[：:]\*\*/.test(body);
  const parts = body.split(/\*\*(?:马|方)[：:]\*\*/);
  
  console.log(`${file}`);
  console.log(`  chapter: ${chMatch[1]}, number: ${numMatch[1]}`);
  console.log(`  firstBold: "${firstBold?.[1]?.substring(0,60)}"`);
  console.log(`  hasDialogue: ${hasDialogue}, dialogueParts: ${parts.length - 1}`);
  console.log('');
}
