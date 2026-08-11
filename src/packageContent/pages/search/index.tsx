import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';
import { chapters } from '@/data/chapters';
import { loadAllVerses } from '@/data/versesLoader';
import { useDebounce } from '@/hooks/useDebounce';
import { searchDeep, getFieldLabel, type SearchResult } from '@/packageContent/services/deepSearch';

const PAGE_SIZE = 20; // 每页显示条数

// 高亮匹配文本
function renderHighlighted(text: string, keyword: string): React.ReactNode {
  const kw = (keyword || '').trim();
  if (!kw || !text) return text;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part === kw) {
      return <Text key={i} className={styles.highlight}>{part}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

const SearchPage: React.FC = () => {
  const router = useRouter();
  const initialKeyword = decodeURIComponent(router.params.keyword || '');

  const [searchText, setSearchText] = useState(initialKeyword);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  // 已显示的搜索结果条数（点击显示全部）
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  // 深度搜索请求序号：连续输入时只采纳最后一次请求的结果，防止旧请求覆盖新结果
  const searchSeqRef = useRef(0);

  const debouncedSearchText = useDebounce(searchText, 300);

  // 预加载章节数据（searchDeep 内部 loadAllVerses 有缓存，此处预加载只为显示 loading 态）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
          Taro.showToast({ title: '加载失败', icon: 'none' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 深度搜索译文+注释（复用 deepSearch.ts，避免逻辑重复）
  useEffect(() => {
    const kw = debouncedSearchText.trim();
    if (!kw || !dataReady) {
      setResults([]);
      setDisplayCount(PAGE_SIZE);
      return;
    }
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

  const handleSearchInput = useCallback((e: any) => {
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

      {/* 状态提示 */}
      {loading ? (
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
                  <Text className={styles.resultChapter}>{chapter?.title} · 第{result.order}章</Text>
                  <View className={styles.matchBadges}>
                    {result.matchFields.map(f => (
                      <Text key={f} className={styles.matchBadge}>{getFieldLabel(f)}</Text>
                    ))}
                  </View>
                </View>
                <Text className={styles.resultOriginal}>{result.original}</Text>
                <Text className={styles.resultPreview}>
                  {renderHighlighted(result.previewText, debouncedSearchText)}
                </Text>
              </View>
            );
          })}
          {results.length > displayCount ? (
            <Text className={styles.resultMore} onClick={handleShowAll}>点击显示全部（共 {results.length} 条，已显示 {displayCount} 条）</Text>
          ) : results.length > PAGE_SIZE ? (
            <Text className={styles.resultMore}>已全部加载，共 {results.length} 条</Text>
          ) : null}
        </View>
      )}

      {!loading && isSearching && results.length === 0 && (
        <Text className={styles.emptyTip}>未找到匹配内容，试试其他关键词</Text>
      )}
    </ScrollView>
  );
};

export default SearchPage;
