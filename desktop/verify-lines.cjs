// 临时：验证源代码 PDF 每页行数（版式行=打印行槽含空行；非空行）（验证后删除）
const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const p = new PDFParse({ data: fs.readFileSync('../docs/copyright-assets/论语学习-源代码.pdf') });
  const d = await p.getText();
  const pages = (d.pages && d.pages.length) ? d.pages.map((x) => x.text) : String(d.all_text || '').split('\f');
  let layoutBad = 0, nonBlankBad = 0, minNonBlank = 99;
  pages.forEach((t, i) => {
    const raw = String(t).split('\n');
    while (raw.length && raw[raw.length - 1].trim() === '') raw.pop(); // 去尾部
    const nonBlank = raw.filter((l) => l.trim() !== '').length;
    minNonBlank = Math.min(minNonBlank, nonBlank);
    if (nonBlank < 51) nonBlankBad++; // 51 = 页眉1 + 代码50
  });
  console.log(`总页数: ${pages.length}`);
  console.log(`每页版式行槽: 50（固定渲染，页眉另计）`);
  console.log(`每页非空行(含页眉) 最小值: ${minNonBlank}，<51 的页数: ${nonBlankBad}`);
  await p.destroy();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
