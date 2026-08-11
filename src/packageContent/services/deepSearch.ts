import { versesIndex, type VerseIndex } from '@/data/versesIndex';
import { loadAllVerses } from '@/data/versesLoader';
import type { Verse } from '@/types';

// 匹配字段类型
export type MatchField = 'original' | 'translation' | 'commentary';

// 统一搜索结果
export interface SearchResult {
  id: number;
  chapterId: number;
  order: number;
  original: string;
  matchFields: MatchField[];   // 命中了哪些字段（可多字段同时命中）
  previewField: MatchField;    // 预览展示的字段（按优先级取最高）
  previewText: string;         // 匹配上下文片段（含前后文，已截断）
}

const MAX_RESULTS = 512;
const PREVIEW_LEN = 50; // 上下文预览长度（字符）

// 字段优先级：原文 > 译文 > 注释
const FIELD_PRIORITY: MatchField[] = ['original', 'translation', 'commentary'];

const FIELD_LABELS: Record<MatchField, string> = {
  original: '原文',
  translation: '译文',
  commentary: '注释',
};

export function getFieldLabel(field: MatchField): string {
  return FIELD_LABELS[field];
}

// ===== Tier 1：即时搜索（原文，来自轻量索引）=====
export function searchInstant(keyword: string): SearchResult[] {
  const kw = keyword.trim();
  if (!kw) return [];
  const results: SearchResult[] = [];
  for (const v of versesIndex) {
    if (!v.original.includes(kw)) continue;
    results.push(buildResult(v, ['original'], kw));
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

// ===== Tier 2：深度搜索（译文 + 注释，加载完整章节数据）=====
// 此模块位于分包内，加载的完整章节数据进入分包而非主包
export async function searchDeep(keyword: string): Promise<SearchResult[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const results: SearchResult[] = [];
  const allVerses = await loadAllVerses();
  for (const v of allVerses) {
    const fields: MatchField[] = [];
    if (v.translation && v.translation.includes(kw)) fields.push('translation');
    if (v.commentary && v.commentary.includes(kw)) fields.push('commentary');
    if (fields.length === 0) continue;
    results.push(buildResult(v, fields, kw));
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

// 构建单条结果
function buildResult(
  v: VerseIndex | Verse,
  fields: MatchField[],
  kw: string
): SearchResult {
  const previewField = FIELD_PRIORITY.find(f => fields.includes(f)) || fields[0];
  const fullText = getFieldValue(v, previewField);
  return {
    id: v.id,
    chapterId: v.chapterId,
    order: v.order,
    original: v.original,
    matchFields: fields,
    previewField,
    previewText: extractContext(fullText, kw, PREVIEW_LEN),
  };
}

function getFieldValue(v: VerseIndex | Verse, field: MatchField): string {
  if (field === 'original') return v.original;
  if (field === 'translation') return (v as Verse).translation || '';
  return (v as Verse).commentary || '';
}

// 提取关键词上下文（前后各取一部分，用 … 标记省略）
export function extractContext(text: string, kw: string, maxLen: number): string {
  if (!text) return '';
  const idx = text.indexOf(kw);
  if (idx === -1) return truncate(text, maxLen);
  const half = Math.floor((maxLen - kw.length) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, start + maxLen);
  let result = text.substring(start, end);
  if (start > 0) result = '…' + result;
  if (end < text.length) result = result + '…';
  return result;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}
