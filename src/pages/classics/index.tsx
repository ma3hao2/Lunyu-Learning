import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import type { InputProps, BaseEventOrig } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import ChapterCard from '@/components/ChapterCard';
import { chapters } from '@/data/chapters';
import { versesIndex } from '@/data/versesIndex';
import { getProgress } from '@/utils/storage';
import { useDebounce } from '@/hooks/useDebounce';
import {
  searchInstant,
  getFieldLabel,
  type SearchResult
} from '@/services/search';
import { renderHighlighted } from '@/utils/highlight';
import { useI18n, applyTabBarLang, getLang } from '@/i18n';

const PAGE_SIZE = 20; // 下滑加载每页条数

const ClassicsPage: React.FC = () => {
  const { t, theme: themeOf } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [activeTheme, setActiveTheme] = useState('全部');
  const [readVerseIds, setReadVerseIds] = useState<number[]>([]);
  // 搜索框聚焦控制（P2-1：「搜原文」tab 点击后聚焦本页搜索框；
  // 微信 Input 的 focus 需 false→true 切换才会重复聚焦，故点击时先关再开）
  const [searchFocus, setSearchFocus] = useState(false);

  // 即时搜索结果（原文，来自轻量索引）
  const [instantResults, setInstantResults] = useState<SearchResult[]>([]);
  // 已显示的搜索结果条数（下滑分页加载）
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // 使用防抖优化搜索性能
  const debouncedSearchText = useDebounce(searchText, 300);

  useDidShow(() => {
    // 导航栏标题随语言刷新（tab 页标题走原生导航栏）；tabBar 文案兜底刷新
    Taro.setNavigationBarTitle({ title: t('tab.classics') });
    applyTabBarLang(getLang());
    const progress = getProgress();
    setReadVerseIds(progress.readVerseIds);
  });

  // 即时搜索原文（本页始终为原文搜索；译文/注释搜索是独立入口，跳转分包页）
  useEffect(() => {
    const kw = debouncedSearchText.trim();
    if (!kw) {
      setInstantResults([]);
      return;
    }
    setInstantResults(searchInstant(kw));
    setDisplayCount(PAGE_SIZE); // 新搜索重置分页
  }, [debouncedSearchText]);

  // 点击显示全部搜索结果
  const handleShowAll = useCallback(() => {
    setDisplayCount(instantResults.length);
  }, [instantResults.length]);

  // 主题分类
  const themes = useMemo(() => {
    const uniqueThemes = Array.from(new Set(chapters.map(c => c.theme)));
    return ['全部', ...uniqueThemes];
  }, []);

  // 预构建篇章 id -> Chapter 映射（搜索结果渲染时避免反复 chapters.find）
  const chapterMap = useMemo(() => {
    const m = new Map<number, typeof chapters[number]>();
    chapters.forEach(c => m.set(c.id, c));
    return m;
  }, []);

  // 预构建每篇已读句数（用 Set 加速 includes，避免每篇章全量扫描 versesIndex）
  const readCountMap = useMemo(() => {
    const readSet = new Set(readVerseIds);
    const m = new Map<number, number>();
    for (const v of versesIndex) {
      if (readSet.has(v.id)) {
        m.set(v.chapterId, (m.get(v.chapterId) || 0) + 1);
      }
    }
    return m;
  }, [readVerseIds]);

  // 计算每篇已读句数（O(1) 查 Map）
  const getReadCount = (chapterId: number): number => readCountMap.get(chapterId) || 0;

  // 过滤篇章（按关键词和主题）
  const filteredChapters = useMemo(() => {
    let result = chapters;
    if (activeTheme !== '全部') {
      result = result.filter(c => c.theme === activeTheme);
    }
    if (debouncedSearchText) {
      const text = debouncedSearchText.trim();
      result = result.filter(c =>
        c.title.includes(text) ||
        c.subTitle.includes(text) ||
        c.theme.includes(text) ||
        c.description.includes(text)
      );
    }
    return result;
  }, [debouncedSearchText, activeTheme]);

  const handleChapterClick = useCallback((chapterId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/chapterDetail/index?id=${chapterId}` });
  }, []);

  const handleVerseClick = useCallback((verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  }, []);

  const handleSearchInput = useCallback((e: BaseEventOrig<InputProps.inputEventDetail>) => {
    setSearchText(e.detail.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
  }, []);

  // 「搜原文」tab：聚焦本页搜索框（先置 false 再置 true，确保重复点击仍能聚焦）
  const handleFocusSearch = useCallback(() => {
    setSearchFocus(false);
    setTimeout(() => setSearchFocus(true), 60);
  }, []);

  // 译文/注释搜索：独立入口，跳转分包搜索页（加载完整章节数据，不进主包）
  const handleOpenDeepSearch = useCallback(() => {
    const kw = searchText.trim();
    Taro.navigateTo({ url: `/packageContent/pages/search/index?keyword=${encodeURIComponent(kw)}` });
  }, [searchText]);

  const isSearching = debouncedSearchText.trim().length > 0;
  const showChapterList = !isSearching || filteredChapters.length > 0;

  // 原文搜索结果
  const allResults = instantResults;
  const totalVerseMatches = allResults.length;

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 简介 */}
      <View className={styles.introCard}>
        <Text className={styles.introTitle}>{t('classics.title')}</Text>
        <Text className={styles.introText}>{t('classics.desc')}</Text>
      </View>

      {/* 搜索模式切换 */}
      <View className={styles.modeTabs}>
        <Text
          className={classnames(styles.modeTab, styles.modeTabActive)}
          onClick={handleFocusSearch}
        >
          {t('classics.tabOriginal')}
        </Text>
        <Text className={styles.modeTab} onClick={handleOpenDeepSearch}>{t('classics.tabDeep')}</Text>
      </View>

      {/* 搜索栏 */}
      <View className={styles.searchBar}>
        <Text className={styles.searchIcon}>搜</Text>
        <Input
          className={styles.searchInput}
          placeholder={t('classics.searchPlaceholder')}
          value={searchText}
          onInput={handleSearchInput}
          confirmType="search"
          focus={searchFocus}
        />
        {isSearching && (
          <Text className={styles.clearBtn} onClick={handleClearSearch}>✕</Text>
        )}
      </View>

      {/* 搜索结果概览 */}
      {isSearching && (
        <View className={styles.searchStats}>
          <Text className={styles.searchStatsText}>
            {t('classics.found', { verses: totalVerseMatches, chapters: filteredChapters.length })}
          </Text>
        </View>
      )}

      {/* 搜索匹配的章句 */}
      {isSearching && allResults.length > 0 && (
        <View className={styles.verseSection}>
          <View className={styles.sectionTitleRow}>
            <Text className={styles.sectionTitle}>{t('classics.matchedVerses')}</Text>
            <Text className={styles.sectionCount}>{t('classics.countVerses', { n: totalVerseMatches })}</Text>
          </View>
          {allResults.slice(0, displayCount).map(result => {
            const chapter = chapterMap.get(result.chapterId);
            return (
              <View
                key={result.id}
                className={styles.searchResultCard}
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
                {/* 原文展示 */}
                <Text className={styles.resultOriginal} selectable>
                  {renderHighlighted(result.original, debouncedSearchText, styles.highlight)}
                </Text>
                {/* 匹配上下文预览（非原文命中时展示） */}
                {result.previewField !== 'original' && (
                  <Text className={styles.resultPreview} selectable>
                    {renderHighlighted(result.previewText, debouncedSearchText, styles.highlight)}
                  </Text>
                )}
              </View>
            );
          })}
          {/* 事件挂 View 而非 Text：避免 Taro 4.1.9 中 Text 节点复用导致 onClick 移除时
              读取不存在的 pure-text 别名而抛错（点击"显示全部"后切换为"已全部加载"场景） */}
          {allResults.length > PAGE_SIZE && (
            <View
              className={styles.resultMore}
              onClick={allResults.length > displayCount ? handleShowAll : undefined}
            >
              {allResults.length > displayCount
                ? t('common.showAllMore', { total: allResults.length, shown: displayCount })
                : t('common.showAllDone', { total: allResults.length })}
            </View>
          )}
        </View>
      )}

      {/* 主题分类 */}
      {!isSearching && (
        <ScrollView className={styles.tagScroll} scrollX enhanced showScrollbar={false}>
          {themes.map(theme => (
            <View
              key={theme}
              className={classnames(styles.tagItem, activeTheme === theme && styles.active)}
              onClick={() => setActiveTheme(theme)}
            >
              <Text>{theme === '全部' ? t('classics.all') : themeOf(theme)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 篇章列表 */}
      {showChapterList && (
        <>
          <View className={styles.listHeader}>
            <Text className={styles.listTitle}>{isSearching ? t('classics.matchedChapters') : t('classics.chapterList')}</Text>
            <Text className={styles.listCount}>{t('classics.countChapters', { n: filteredChapters.length })}</Text>
          </View>
          <View className={styles.chapterList}>
            {filteredChapters.map(chapter => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                readCount={getReadCount(chapter.id)}
                onClick={handleChapterClick}
              />
            ))}
          </View>
        </>
      )}

      {isSearching && filteredChapters.length === 0 && allResults.length === 0 && (
        <Text className={styles.emptyTip}>{t('classics.empty')}</Text>
      )}
    </ScrollView>
  );
};

export default ClassicsPage;
