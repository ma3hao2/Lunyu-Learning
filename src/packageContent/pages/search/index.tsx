import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import type { InputProps, BaseEventOrig } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';
import { chapters } from '@/data/chapters';
import { loadAllVerses } from '@/data/versesLoader';
import { useDebounce } from '@/hooks/useDebounce';
import { searchDeep, getFieldLabel, type SearchResult } from '@/packageContent/services/deepSearch';
import { renderHighlighted } from '@/utils/highlight';
import { getSearchHistory, addSearchHistory, clearSearchHistory } from '@/utils/searchHistory';

const PAGE_SIZE = 20; // 每页显示条数

const SearchPage: React.FC = () => {
  const router = useRouter();
  const initialKeyword = decodeURIComponent(router.params.keyword || '');

  const [searchText, setSearchText] = useState(initialKeyword);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // 已显示的搜索结果条数（点击显示全部）
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  // 深度搜索请求序号：连续输入时只采纳最后一次请求的结果，防止旧请求覆盖新结果
  const searchSeqRef = useRef(0);
  // 重试计数：变化时重新触发预加载
  const [retryTick, setRetryTick] = useState(0);
  // 搜索历史（P2-1：最近 10 条，点击重搜、可清空）
  const [history, setHistory] = useState<string[]>(() => getSearchHistory());

  const debouncedSearchText = useDebounce(searchText, 300);

  // 预加载章节数据（searchDeep 内部 loadAllVerses 有缓存，此处预加载只为显示 loading 态）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    (async () => {
      try {
        await loadAllVerses();
        if (!cancelled) {
          setDataReady(true);
          setLoading(false);
        }
      } catch (e) {
        console.error('[Search] 加载章节数据失败:', e);
        if (!cancelled) {
          setLoading(false);
          setLoadFailed(true);
          Taro.showToast({ title: '加载失败，请重试', icon: 'none' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [retryTick]);

  // 深度搜索译文+注释（复用 deepSearch.ts，避免逻辑重复）
  useEffect(() => {
    const kw = debouncedSearchText.trim();
    if (!kw || !dataReady) {
      setResults([]);
      setDisplayCount(PAGE_SIZE);
      return;
    }
    // 有效搜索词写入历史（去重置顶，防抖后每词只写一次）
    setHistory(addSearchHistory(kw));
    let cancelled = false;
    const seq = ++searchSeqRef.current;
    (async () => {
      const res = await searchDeep(kw);
      // cancelled 防止卸载/依赖变更后 setState；seq 防止旧请求后返回覆盖新结果
      if (cancelled || seq !== searchSeqRef.current) return;
      setResults(res);
      setDisplayCount(PAGE_SIZE); // 新搜索重置分页
    })();
    return () => { cancelled = true; };
  }, [debouncedSearchText, dataReady]);

  const handleSearchInput = useCallback((e: BaseEventOrig<InputProps.inputEventDetail>) => {
    setSearchText(e.detail.value);
  }, []);

  const handleClear = useCallback(() => {
    setSearchText('');
  }, []);

  const handleVerseClick = useCallback((verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  }, []);

  // 点击显示全部搜索结果
  const handleShowAll = useCallback(() => {
    setDisplayCount(results.length);
  }, [results.length]);

  const isSearching = debouncedSearchText.trim().length > 0;

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 搜索栏 */}
      <View className={styles.searchBar}>
        <Text className={styles.searchIcon}>搜</Text>
        <Input
          className={styles.searchInput}
          placeholder="搜索译文、注释..."
          value={searchText}
          onInput={handleSearchInput}
          confirmType="search"
          focus={!initialKeyword}
        />
        {isSearching && (
          <Text className={styles.clearBtn} onClick={handleClear}>✕</Text>
        )}
      </View>

      {/* 搜索历史（无搜索词时展示，点击重搜/清空） */}
      {!loading && !loadFailed && !isSearching && history.length > 0 && (
        <View className={styles.historySection}>
          <View className={styles.historyHeader}>
            <Text className={styles.historyTitle}>搜索历史</Text>
            <Text className={styles.historyClear} onClick={() => { clearSearchHistory(); setHistory([]); }}>清空</Text>
          </View>
          <View className={styles.historyChips}>
            {history.map(kw => (
              <View key={kw} className={styles.historyChip} onClick={() => setSearchText(kw)}>
                <Text>{kw}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 状态提示 */}
      {loadFailed ? (
        <View className={styles.tipWrap}>
          <Text className={styles.tip}>章节数据加载失败，请检查网络</Text>
          <Text className={styles.retryBtn} onClick={() => setRetryTick(t => t + 1)}>重试</Text>
        </View>
      ) : loading ? (
        <Text className={styles.tip}>正在加载章节数据...</Text>
      ) : isSearching ? (
        <Text className={styles.tip}>找到 {results.length} 条匹配</Text>
      ) : (
        <Text className={styles.tip}>输入关键词，搜索《论语》的译文与注释</Text>
      )}

      {/* 搜索结果 */}
      {!loading && isSearching && results.length > 0 && (
        <View className={styles.resultList}>
          {results.slice(0, displayCount).map(result => {
            const chapter = chapters.find(c => c.id === result.chapterId);
            return (
              <View
                key={result.id}
                className={styles.resultCard}
                onClick={() => handleVerseClick(result.id)}
              >
                <View className={styles.resultHeader}>
                  <Text className={styles.resultChapter}>{chapter?.title} · {result.chapterId}-{result.order}</Text>
                  <View className={styles.matchBadges}>
                    {result.matchFields.map(f => (
                      <Text key={f} className={styles.matchBadge}>{getFieldLabel(f)}</Text>
                    ))}
                  </View>
                </View>
                <Text className={styles.resultOriginal}>{result.original}</Text>
                <Text className={styles.resultPreview}>
                  {renderHighlighted(result.previewText, debouncedSearchText, styles.highlight)}
                </Text>
              </View>
            );
          })}
          {/* 事件挂 View 而非 Text：避免 Taro 4.1.9 中 Text 节点复用导致 onClick 移除时
              读取不存在的 pure-text 别名而抛错（点击"显示全部"后切换为"已全部加载"场景） */}
          {results.length > PAGE_SIZE && (
            <View
              className={styles.resultMore}
              onClick={results.length > displayCount ? handleShowAll : undefined}
            >
              {results.length > displayCount
                ? `点击显示全部（共 ${results.length} 条，已显示 ${displayCount} 条）`
                : `已全部加载，共 ${results.length} 条`}
            </View>
          )}
        </View>
      )}

      {!loading && isSearching && results.length === 0 && (
        <Text className={styles.emptyTip}>未找到匹配内容，试试其他关键词</Text>
      )}
    </ScrollView>
  );
};

export default SearchPage;
