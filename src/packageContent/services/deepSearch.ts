import { loadAllVerses } from '@/data/versesLoader';
import {
  type MatchField,
  type SearchResult,
  MAX_RESULTS,
  buildResult,
  getFieldLabel,
  extractContext,
} from '@/services/searchCommon';

// 重新导出共享类型与工具，保持调用方 import 路径不变
export type { MatchField, SearchResult };
export { getFieldLabel, extractContext };

// ===== 深度搜索（译文 + 注释，加载完整章节数据）=====
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
