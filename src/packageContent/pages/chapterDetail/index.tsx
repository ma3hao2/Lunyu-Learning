import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import VerseCard from '@/components/VerseCard';
import ProgressBar from '@/components/ProgressBar';
import BackHeader from '@/components/BackHeader';
import { chapters } from '@/data/chapters';
import { loadChapter } from '@/data/versesLoader';
import type { Verse } from '@/types';
import { getProgress } from '@/utils/storage';

const ChapterDetailPage: React.FC = () => {
  const router = useRouter();
  const rawChapterId = Number(router.params.id || '1');
  // 无效 id 回退到第 1 篇，保证头部与列表一致
  const chapterId = chapters.some(c => c.id === rawChapterId) ? rawChapterId : 1;
  const [readVerseIds, setReadVerseIds] = useState<number[]>([]);
  const [noteVerseIds, setNoteVerseIds] = useState<number[]>([]);

  useDidShow(() => {
    const progress = getProgress();
    setReadVerseIds(progress.readVerseIds);
    setNoteVerseIds(progress.myNotes.map(n => n.verseId));
  });

  const chapter = useMemo(() => {
    return chapters.find(c => c.id === chapterId) || chapters[0];
  }, [chapterId]);

  const [chapterVerses, setChapterVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0); // 重试计数，变化时重新触发加载

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    (async () => {
      try {
        const verses = await loadChapter(chapterId);
        const sorted = [...verses].sort((a, b) => a.order - b.order);
        if (!cancelled) {
          setChapterVerses(sorted);
          setLoading(false);
        }
      } catch (e) {
        console.error('[ChapterDetail] Load chapter failed:', e);
        if (!cancelled) {
          setLoading(false);
          setLoadFailed(true);
          Taro.showToast({ title: '加载失败，请重试', icon: 'none', duration: 2000 });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId, retryTick]);

  const readCount = useMemo(() => {
    return chapterVerses.filter(v => readVerseIds.includes(v.id)).length;
  }, [chapterVerses, readVerseIds]);

  const handleVerseClick = (verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <BackHeader title="篇章详情" />
      {/* 篇章头部 */}
      <View className={styles.chapterHeader}>
        <Text className={styles.chapterTitle}>{chapter.title}</Text>
        <Text className={styles.chapterTheme}>{chapter.theme}</Text>
        <Text className={styles.chapterDesc}>{chapter.description}</Text>
      </View>

      {/* 进度 */}
      {chapterVerses.length > 0 && (
        <ProgressBar current={readCount} total={chapterVerses.length} label="本篇进度" />
      )}

      {/* 句子列表 */}
      <View className={styles.listTitle}>
        <Text className={styles.listTitleText}>章句列表</Text>
        <Text className={styles.listCount}>共{chapterVerses.length}章</Text>
      </View>
      <View className={styles.verseList}>
        {loading ? (
          <Text className={styles.emptyTip}>加载中...</Text>
        ) : loadFailed ? (
          <View className={styles.loadFailedWrap}>
            <Text className={styles.emptyTip}>加载失败，请检查网络</Text>
            <View
              className={styles.retryBtn}
              style={{ marginTop: 24 }}
              onClick={() => {
                setLoading(true);
                setRetryTick(t => t + 1);
              }}
            >
              <Text>重试</Text>
            </View>
          </View>
        ) : chapterVerses.length > 0 ? (
          chapterVerses.map(verse => (
            <VerseCard
              key={verse.id}
              verse={verse}
              isRead={readVerseIds.includes(verse.id)}
              hasNote={noteVerseIds.includes(verse.id)}
              onClick={handleVerseClick}
            />
          ))
        ) : (
          <Text className={styles.emptyTip}>本篇内容正在整理中...</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default ChapterDetailPage;
