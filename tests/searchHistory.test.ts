/**
 * 搜索历史测试（P2-1）
 * 覆盖：去重置顶、限长裁剪、持久化、脏数据防御、清空
 */
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  MAX_SEARCH_HISTORY
} from '@/utils/searchHistory';

describe('搜索历史 (P2-1)', () => {
  beforeEach(() => {
    clearSearchHistory();
  });

  test('空历史返回空数组', () => {
    expect(getSearchHistory()).toEqual([]);
  });

  test('添加关键词：置顶 + 去重', () => {
    addSearchHistory('学而时习之');
    addSearchHistory('为政以德');
    addSearchHistory('学而时习之'); // 重复：移到最前
    expect(getSearchHistory()).toEqual(['学而时习之', '为政以德']);
  });

  test('空白关键词不记录', () => {
    addSearchHistory('  ');
    expect(getSearchHistory()).toEqual([]);
  });

  test('超过上限时裁剪最旧的', () => {
    for (let i = 1; i <= MAX_SEARCH_HISTORY + 3; i++) {
      addSearchHistory(`关键词${i}`);
    }
    const history = getSearchHistory();
    expect(history).toHaveLength(MAX_SEARCH_HISTORY);
    // 最新的在最前，最旧的（1-3）被裁掉
    expect(history[0]).toBe(`关键词${MAX_SEARCH_HISTORY + 3}`);
    expect(history).not.toContain('关键词1');
  });

  test('清空历史', () => {
    addSearchHistory('学而时习之');
    clearSearchHistory();
    expect(getSearchHistory()).toEqual([]);
  });

  test('脏数据防御：混入非字符串不崩溃', () => {
    // 直接向存储写入脏数据（模拟历史版本遗留的异常数据）
    const { setStorageSync } = require('@tarojs/taro');
    setStorageSync('searchHistory', ['正常关键词', 123, null, '', '   ']);
    expect(getSearchHistory()).toEqual(['正常关键词']);
  });
});
