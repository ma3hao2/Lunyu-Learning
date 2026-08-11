import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';
import styles from './index.module.scss';
import NoteCard from '@/components/NoteCard';
import { fetchPublishedNotes, likePublishedNote, unlikePublishedNote } from '@/services/auth';
import { togglePublishedNoteLike } from '@/utils/storage';
import { useDebounce } from '@/hooks/useDebounce';
import { isLoggedIn } from '@/services/auth';
import type { PublishedNote } from '@/types';

const PAGE_SIZE = 20;

const InsightsPage: React.FC = () => {
  const [notes, setNotes] = useState<PublishedNote[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 分享：邀请好友一起学习论语心得
  useShareAppMessage(() => ({
    title: '论语学习心得 · 以文会友，以友辅仁',
    path: '/pages/insights/index'
  }));

  const debouncedSearchText = useDebounce(searchText, 300);

  // 请求序号：防止快速切换关键词时旧请求覆盖新结果（竞态保护）
  const reqSeqRef = useRef(0);
  // 首屏初始化标记：避免 useEffect 与 useDidShow 首次双发请求
  const initedRef = useRef(false);

  // 拉取公开心得列表（关键词搜索由云函数 RegExp 处理）
  const loadNotes = useCallback(async (keyword = '', skip = 0, append = false) => {
    const seq = ++reqSeqRef.current;
    try {
      const { list, hasMore: more } = await fetchPublishedNotes({
        skip,
        limit: PAGE_SIZE,
        keyword: keyword || undefined
      });
      // 丢弃过期请求的结果（期间已发起新的搜索/翻页）
      if (seq !== reqSeqRef.current) return;
      setNotes(prev => append ? [...prev, ...list] : list);
      setHasMore(more);
      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      if (seq !== reqSeqRef.current) return;
      console.error('[Insights] 加载公开心得失败:', e);
      setLoading(false);
      setRefreshing(false);
      Taro.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  }, []);

  // 首次加载 + 搜索变化时重新加载
  useEffect(() => {
    loadNotes(debouncedSearchText.trim(), 0, false);
  }, [debouncedSearchText, loadNotes]);

  // tabBar 页每次显示时刷新：跨页点赞/编辑后回到本页能拉到最新数据
  // 首屏跳过（useEffect 已触发），避免首次挂载双发请求
  useDidShow(() => {
    if (!initedRef.current) {
      initedRef.current = true;
      return;
    }
    loadNotes(debouncedSearchText.trim(), 0, false);
  });

  // 下拉刷新：重置列表从第一页加载
  usePullDownRefresh(async () => {
    setLoading(true);
    setHasMore(true);
    await loadNotes(debouncedSearchText.trim(), 0, false);
    Taro.stopPullDownRefresh();
  });

  // 下滑加载更多
  const handleScrollToLower = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      setRefreshing(true);
      loadNotes(debouncedSearchText.trim(), notes.length, true);
    }
  }, [hasMore, loading, refreshing, debouncedSearchText, notes.length, loadNotes]);

  // 点赞/取消点赞（云端联动 + 本地记录）
  const handleLike = useCallback(async (noteId: string) => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const { liked } = togglePublishedNoteLike(noteId);
    // 乐观更新本地显示
    setNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, likedByMe: liked, likeCount: n.likeCount + (liked ? 1 : -1) }
        : n
    ));
    try {
      if (liked) {
        await likePublishedNote(noteId);
      } else {
        await unlikePublishedNote(noteId);
      }
    } catch (e) {
      console.warn('[Insights] 点赞同步失败:', e);
      // 回滚本地状态
      setNotes(prev => prev.map(n =>
        n.id === noteId
          ? { ...n, likedByMe: !liked, likeCount: n.likeCount + (liked ? -1 : 1) }
          : n
      ));
      Taro.showToast({ title: '点赞失败，请重试', icon: 'none' });
    }
  }, []);

  // 点击心得卡片：跳到对应章句详情
  const handleClick = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${note.verseId}` });
    }
  }, [notes]);

  const isSearching = debouncedSearchText.trim().length > 0;

  return (
    <ScrollView
      className={styles.container}
      scrollY
      enhanced
      bounces
      lowerThreshold={100}
      onScrollToLower={handleScrollToLower}
    >
      {/* 标题 */}
      <View className={styles.header}>
        <Text className={styles.title}>学习心得</Text>
        <Text className={styles.subtitle}>以文会友，以友辅仁</Text>
      </View>

      {/* 搜索栏 */}
      <View className={styles.searchBar}>
        <Text className={styles.searchIcon}>搜</Text>
        <Input
          className={styles.searchInput}
          placeholder="搜索心得内容、作者..."
          value={searchText}
          onInput={(e) => setSearchText(e.detail.value)}
          confirmType="search"
        />
        {isSearching && (
          <Text className={styles.clearBtn} onClick={() => setSearchText('')}>✕</Text>
        )}
      </View>

      {/* 心得列表 */}
      {loading ? (
        <Text className={styles.tip}>加载中...</Text>
      ) : notes.length > 0 ? (
        <>
          <View className={styles.noteList}>
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onLike={handleLike}
                onClick={handleClick}
              />
            ))}
          </View>
          {hasMore && <Text className={styles.tip}>{refreshing ? '加载中...' : '下滑加载更多'}</Text>}
          {!hasMore && notes.length > PAGE_SIZE && <Text className={styles.tip}>已全部加载</Text>}
        </>
      ) : (
        <Text className={styles.emptyTip}>
          {isSearching ? '未找到匹配心得' : '还没有公开心得，去写第一条吧'}
        </Text>
      )}
    </ScrollView>
  );
};

export default InsightsPage;
