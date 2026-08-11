/**
 * 验证 论语学习心得提炼版/ 输出完整性：
 *  - 每个计划目标文件是否存在
 *  - 结构字段是否齐全：标题行、原文/出处/参考源 引言、## 字词注释、## 解读评析
 * 运行：node scripts/verify_distilled.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_FILE = path.join(ROOT, '.tmp', 'distilled_plan.json');
const OUT_DIR = path.join(ROOT, '论语学习心得提炼版');

function main() {
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
  const missing = [];
  const broken = [];
  let ok = 0;
  for (const p of plan) {
    const fp = path.join(OUT_DIR, p.fileName);
    if (!fs.existsSync(fp)) {
      missing.push(p.fileName);
      continue;
    }
    const c = fs.readFileSync(fp, 'utf-8');
    // 规范化：全角引号/逗号与半角统一，忽略标点差异造成的误报
    const norm = (s) =>
      s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[，;；]/g, ',').replace(/。/g, '.');
    // 去所有标点，用于原文前缀模糊匹配（容忍异体字/标点差异导致的截断差异）
    const bare = (s) => s.replace(/[，,。.；;、？！：:""''“”‘’()（）《》<>]/g, '');
    const normC = norm(c);
    const checks = {
      title: c.includes(`# ${p.verseId} · ${p.chapterName}`),
      original:
        normC.includes(norm(`> **原文**：${p.original}`)) ||
        bare(normC).includes(bare(norm(p.original)).slice(0, 25)),
      source: normC.includes(norm(`> **参考源**：和合文化屋《论语学习心得》（${p.number}）`)),
      notes: c.includes('## 字词注释'),
      analysis: c.includes('## 解读评析'),
    };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (bad.length) broken.push({ file: p.fileName, bad });
    else ok++;
  }
  console.log(`目标总数: ${plan.length}`);
  console.log(`完整合格: ${ok}`);
  console.log(`缺失文件: ${missing.length}`);
  console.log(`结构异常: ${broken.length}`);
  console.log('--- 缺失 ---');
  missing.forEach((m) => console.log(`  ${m}`));
  console.log('--- 结构异常(前40) ---');
  broken.slice(0, 40).forEach((b) => console.log(`  ${b.file}: 缺 ${b.bad.join(', ')}`));
}

main();
