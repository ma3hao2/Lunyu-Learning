import type { Language } from '@/types';
import { loadAllVerses } from '@/data/versesLoader';
import { loadAllVersesEn } from '@/data/versesEnLoader';
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
// 此模块位于分包内，加载的完整章节数据进入分包而非主包。
// 双语：英文模式搜索英文字段（缺失逐字段回退中文），关键词命中取英文字段内容做预览；
// 中文模式行为与历史版本完全一致（懒加载 EN blob 仅在英文模式触发）。
export async function searchDeep(keyword: string, lang: Language = 'zh'): Promise<SearchResult[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const results: SearchResult[] = [];
  const allVerses = await loadAllVerses();

  // 英文模式：构建「生效字段」章句（英文字段覆盖中文，空值回退），预览与命中均用英文文本
  let enMap: Map<number, { translation: string; commentary: string }> | null = null;
  if (lang === 'en') {
    enMap = new Map((await loadAllVersesEn()).map(v => [v.id, v]));
  }

  for (const v of allVerses) {
    let eff = v;
    if (enMap) {
      const en = enMap.get(v.id);
      if (!en) continue; // 英文模式且该句无英文数据：跳过（理论不发生，blob 完整性测试保证）
      eff = { ...v, translation: en.translation || v.translation, commentary: en.commentary || v.commentary };
    }
    const fields: MatchField[] = [];
    if (eff.translation && eff.translation.includes(kw)) fields.push('translation');
    if (eff.commentary && eff.commentary.includes(kw)) fields.push('commentary');
    if (fields.length === 0) continue;
    results.push(buildResult(eff, fields, kw));
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}
