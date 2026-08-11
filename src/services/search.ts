import { versesIndex } from '@/data/versesIndex';
import {
  type MatchField,
  type SearchResult,
  MAX_RESULTS,
  buildResult,
  getFieldLabel,
  extractContext,
} from './searchCommon';

// 重新导出共享类型与工具，保持调用方 import 路径不变
export type { MatchField, SearchResult };
export { getFieldLabel, extractContext };

// ===== 即时搜索（原文，来自轻量索引，主包内执行）=====
// 注意：深度搜索（译文/注释）需加载完整章节数据，已移至分包
// src/packageContent/services/deepSearch.ts，避免章节数据进入主包
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
