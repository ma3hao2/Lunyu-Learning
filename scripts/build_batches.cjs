/**
 * 把 .tmp/distilled_plan.json 切成批次任务文件 .tmp/batches/batch_XX.json
 * 每批 BATCH_SIZE 篇（默认 8），供 fleet/子代理并行提炼
 * 运行：node scripts/build_batches.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_FILE = path.join(ROOT, '.tmp', 'distilled_plan.json');
const BATCH_DIR = path.join(ROOT, '.tmp', 'batches');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '8', 10);

function main() {
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
  fs.rmSync(BATCH_DIR, { recursive: true, force: true });
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const batches = [];
  for (let i = 0; i < plan.length; i += BATCH_SIZE) {
    batches.push(plan.slice(i, i + BATCH_SIZE));
  }
  batches.forEach((b, idx) => {
    const tag = String(idx + 1).padStart(2, '0');
    fs.writeFileSync(
      path.join(BATCH_DIR, `batch_${tag}.json`),
      JSON.stringify({ batchIndex: idx + 1, totalBatches: batches.length, items: b }, null, 2),
      'utf-8'
    );
  });
  console.log(`计划 ${plan.length} 篇 → ${batches.length} 批（每批 ≤${BATCH_SIZE}）`);
  batches.forEach((b, i) => console.log(`  batch_${String(i + 1).padStart(2, '0')}: ${b.length} 篇 (verseId ${b[0].verseId}~${b[b.length - 1].verseId})`));
}

main();
