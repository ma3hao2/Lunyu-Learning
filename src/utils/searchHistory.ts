/**
 * 搜索历史（本地存储最近 N 条关键词，去重置顶）
 * P2-1：搜索页展示历史、点击重搜、可清空
 */
import Taro from '@tarojs/taro';

const HISTORY_KEY = 'searchHistory';
export const MAX_SEARCH_HISTORY = 10;

export function getSearchHistory(): string[] {
  try {
    const raw = Taro.getStorageSync(HISTORY_KEY);
    if (!Array.isArray(raw)) return [];
    // 防御：过滤非字符串、去空、限长（兼容历史脏数据）
    return raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_SEARCH_HISTORY);
  } catch (e) {
    return [];
  }
}

/** 记录一次搜索：去重置顶，裁剪到上限，返回最新列表 */
export function addSearchHistory(keyword: string): string[] {
  const kw = keyword.trim();
  if (!kw) return getSearchHistory();
  const next = [kw, ...getSearchHistory().filter(item => item !== kw)].slice(0, MAX_SEARCH_HISTORY);
  try {
    Taro.setStorageSync(HISTORY_KEY, next);
  } catch (e) {
    // 存储失败静默：历史只是锦上添花，不影响搜索
  }
  return next;
}

export function clearSearchHistory(): void {
  try {
    Taro.removeStorageSync(HISTORY_KEY);
  } catch (e) {
    // 同上
  }
}
