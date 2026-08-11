/**
 * 将 lunyu8_data.json 转换为 verses.ts
 * - original/translation/commentary 来自 lunyu8.cn
 * - keyPoint 从现有 verses.ts 按 chapterId+order 匹配，匹配不上用篇 theme 兜底
 *
 * 运行: node scripts/generate_verses_lunyu8.js
 */

const fs = require('fs');
const path = require('path');

const lunyu8Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'lunyu8_data.json'), 'utf-8'));

// 篇 theme 映射（来自 chapters.ts）
const chapterTheme = {
  1: '学习修身', 2: '为政治国', 3: '礼乐制度', 4: '仁德修养',
  5: '品评人物', 6: '仁德品行', 7: '教育理念', 8: '至德精神',
  9: '进德修业', 10: '生活礼仪', 11: '人才评价', 12: '仁政克己',
  13: '政事管理', 14: '修己安人', 15: '君子之道', 16: '政治伦理',
  17: '性习相近', 18: '隐士处世', 19: '弟子言论', 20: '尧舜之道'
};

// 从现有 verses.ts 提取 keyPoint（按 chapterId 分组）
function loadExistingKeyPoints() {
  const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'verses.ts'), 'utf-8');
  const keyPointsByChapter = {};
  // 匹配 { id, chapterId, order, ..., keyPoint: "..." }
  const regex = /\{\s*id:\s*\d+,\s*chapterId:\s*(\d+),\s*order:\s*(\d+),[^}]*?keyPoint:\s*"([^"]*)"\s*\}/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const cid = parseInt(m[1]);
    const order = parseInt(m[2]);
    const kp = m[3];
    if (!keyPointsByChapter[cid]) keyPointsByChapter[cid] = {};
    keyPointsByChapter[cid][order] = kp;
  }
  return keyPointsByChapter;
}

// 清理注释文本：合并多余空行，保留 ① ② 等编号结构
function cleanAnnotation(text) {
  if (!text) return '';
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '')
    .trim();
}

// 清理解读文本：截断过长内容，保留前 800 字
function cleanCommentary(text) {
  if (!text) return '';
  let cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  // 如果过长，截断到 1000 字
  if (cleaned.length > 1000) {
    cleaned = cleaned.substring(0, 1000) + '……';
  }
  return cleaned;
}

// 组合 commentary = 注释 + 解读
function buildCommentary(annotation, commentary) {
  const anno = cleanAnnotation(annotation);
  const comm = cleanCommentary(commentary);
  if (anno && comm) return anno + '\n\n【解读】' + comm;
  if (anno) return anno;
  if (comm) return '【解读】' + comm;
  return '';
}

// 清理原文：移除多余空白
function cleanOriginal(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。！？；：、""''])/g, '$1')
    .trim();
}

function main() {
  console.log('=== 生成 verses.ts ===\n');

  const existingKps = loadExistingKeyPoints();
  console.log('已加载现有 keyPoint 数据:', Object.keys(existingKps).map(k => `第${k}篇${Object.keys(existingKps[k]).length}章`).join(', '));

  // 按 chapterId, order 排序
  lunyu8Data.sort((a, b) => a.chapterId - b.chapterId || a.order - b.order);

  // 生成最终数据
  let id = 101;
  const final = [];
  const counts = {};

  for (const v of lunyu8Data) {
    const original = cleanOriginal(v.original);
    const translation = (v.translation || '').trim();
    const commentary = buildCommentary(v.annotation, v.commentary);

    // keyPoint: 优先按 chapterId+order 匹配现有数据，否则用篇 theme
    let keyPoint = '';
    if (existingKps[v.chapterId] && existingKps[v.chapterId][v.order]) {
      keyPoint = existingKps[v.chapterId][v.order];
    } else {
      // 兜底：用篇 theme
      keyPoint = chapterTheme[v.chapterId] || '';
    }

    final.push({
      id: id++,
      chapterId: v.chapterId,
      order: v.order,
      original,
      translation,
      commentary,
      keyPoint
    });

    counts[v.chapterId] = (counts[v.chapterId] || 0) + 1;
  }

  // 生成 TS 文件内容
  const header = `import { Verse } from '@/types';

// 论语二十篇完整内容（共${final.length}章）
// 来源：http://www.lunyu8.cn/ 论语网
// translation = 白话译文，commentary = 字词注释 + 解读评析

export const verses: Verse[] = [`;

  const entries = final.map(v => {
    const orig = JSON.stringify(v.original);
    const trans = JSON.stringify(v.translation);
    const comm = JSON.stringify(v.commentary);
    const kp = JSON.stringify(v.keyPoint);
    return `\n  { id: ${v.id}, chapterId: ${v.chapterId}, order: ${v.order}, original: ${orig}, translation: ${trans}, commentary: ${comm}, keyPoint: ${kp} }`;
  }).join(',');

  const footer = '\n];\n';

  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'verses.ts'), header + entries + footer, 'utf-8');

  // 统计
  const hasTrans = final.filter(v => v.translation.length > 0).length;
  const hasComm = final.filter(v => v.commentary.length > 0).length;
  const hasKp = final.filter(v => v.keyPoint.length > 0).length;

  console.log(`\n=== 生成完成 ===`);
  console.log(`总计: ${final.length} 章`);
  console.log(`有译文: ${hasTrans}, 有注释解读: ${hasComm}, 有要点: ${hasKp}`);
  console.log(`\n各篇章数:`);
  for (let i = 1; i <= 20; i++) {
    console.log(`  第${i}篇: ${counts[i] || 0} 章`);
  }

  // 样本
  console.log('\n=== 样本（第1篇第1章） ===');
  const sample = final.find(v => v.chapterId === 1 && v.order === 1);
  if (sample) {
    console.log(`id: ${sample.id}`);
    console.log(`原文: ${sample.original}`);
    console.log(`译文: ${sample.translation}`);
    console.log(`注释解读: ${sample.commentary.substring(0, 300)}...`);
    console.log(`要点: ${sample.keyPoint}`);
  }
}

main();
