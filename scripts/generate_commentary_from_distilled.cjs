/**
 * 用「论语学习心得提炼版」的字词注释 + 解读评析 替换 src/data/verses 的 commentary 字段
 *
 * 映射关系：提炼版文件名 {verseId}_{篇名}_{片段}.md ↔ verse 数据 id（已对齐 509 条，id 101-612）
 * 保留字段：original / translation / keyPoint 不动
 * commentary 格式（与旧版一致，UI 无需改动）：
 *   ①学：……\n②时：……\n\n【解读】……（解读评析保留自然段，段间 \n\n）
 *
 * 运行：node scripts/generate_commentary_from_distilled.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISTILLED_DIR = path.join(ROOT, '论语学习心得提炼版');
const VERSES_DIR = path.join(ROOT, 'src', 'data', 'verses');

/** 解析单篇提炼版 md，返回 { notes, analysis }（字词注释 / 解读评析，均为未转义文本） */
function parseDistilled(content) {
  const notesIdx = content.indexOf('## 字词注释');
  const analysisIdx = content.indexOf('## 解读评析');
  if (notesIdx === -1 || analysisIdx === -1) {
    throw new Error('缺少 ## 字词注释 或 ## 解读评析 章节');
  }
  const notes = content.slice(notesIdx + '## 字词注释'.length, analysisIdx);
  const analysis = content.slice(analysisIdx + '## 解读评析'.length);
  return { notes, analysis };
}

/** md 块 → 行数组：去空行、trim、去 markdown 标记残留 */
function toLines(block) {
  return block
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

/** 组合 commentary：字词注释行 \n 连接；解读评析保留自然段（空行→\n\n），段内换行合并为空格 */
function buildCommentary({ notes, analysis }) {
  const noteLines = toLines(notes);
  const analysisPara = toLines(analysis); // 空行已被过滤，段落=行
  return noteLines.join('\n') + '\n\n【解读】' + analysisPara.join('\n\n');
}

/** TS 字符串字面量转义：与旧数据格式保持一致——
 *  真实换行 → TS 源 \\n（双反斜杠），运行时为两字符 \n（renderLines 用 /\\n/g 再转真实换行）
 *  顺序：反斜杠加倍 → 引号 → 换行 */
function escapeTs(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\\\n');
}

function main() {
  const files = fs.readdirSync(DISTILLED_DIR).filter(f => f.endsWith('.md'));
  console.log(`提炼版文件数: ${files.length}`);

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let ch = 1; ch <= 20; ch++) {
    const filePath = path.join(VERSES_DIR, `chapter${ch}.ts`);
    let lines = fs.readFileSync(filePath, 'utf-8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const idMatch = line.match(/id:\s*(\d+)/);
      if (!idMatch || !line.includes('chapterId:')) continue; // 仅处理 verse 数据行
      const id = +idMatch[1];

      const mdFile = files.find(f => f.startsWith(`${id}_`));
      if (!mdFile) {
        skipped++;
        errors.push(`id=${id}: 提炼版文件缺失`);
        continue;
      }
      const mdContent = fs.readFileSync(path.join(DISTILLED_DIR, mdFile), 'utf-8');
      let parsed;
      try {
        parsed = parseDistilled(mdContent);
      } catch (e) {
        skipped++;
        errors.push(`id=${id}: ${e.message}`);
        continue;
      }
      const commentary = buildCommentary(parsed);
      const escaped = escapeTs(commentary);

      const re = /commentary: ("(?:[^"\\]|\\.)*")(, keyPoint)/;
      if (!re.test(line)) {
        skipped++;
        errors.push(`id=${id}: 未找到 commentary 字段`);
        continue;
      }
      lines[i] = line.replace(re, (m, _old, tail) => `commentary: "${escaped}"${tail}`);
      updated++;
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  console.log(`已替换: ${updated}`);
  console.log(`跳过/异常: ${skipped}`);
  if (errors.length) {
    console.log('--- 异常明细(前20) ---');
    errors.slice(0, 20).forEach(e => console.log('  ' + e));
  }
}

main();
