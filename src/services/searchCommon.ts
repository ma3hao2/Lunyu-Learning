// 搜索服务共享层：类型定义与纯函数
// 主包 search.ts 与分包 deepSearch.ts 共同引用，避免重复定义
// 本模块不依赖任何章节数据，可安全被主包/分包引用

import type { Verse } from '@/types';
import type { VerseIndex } from '@/data/versesIndex';

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

export const MAX_RESULTS = 512;
export const PREVIEW_LEN = 50; // 上下文预览长度（字符）

// 字段优先级：原文 > 译文 > 注释
export const FIELD_PRIORITY: MatchField[] = ['original', 'translation', 'commentary'];

const FIELD_LABELS: Record<MatchField, string> = {
  original: '原文',
  translation: '译文',
  commentary: '注释',
};

export function getFieldLabel(field: MatchField): string {
  return FIELD_LABELS[field];
}

// 获取指定字段的文本（VerseIndex 仅有 original，Verse 含全部字段）
export function getFieldValue(v: VerseIndex | Verse, field: MatchField): string {
  if (field === 'original') return v.original;
  if (field === 'translation') return (v as Verse).translation || '';
  return (v as Verse).commentary || '';
}

// 构建单条搜索结果（按字段优先级选取预览字段）
export function buildResult(
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
