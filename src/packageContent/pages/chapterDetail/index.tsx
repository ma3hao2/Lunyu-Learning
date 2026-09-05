import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import VerseCard from '@/components/VerseCard';
import ProgressBar from '@/components/ProgressBar';
import BackHeader from '@/components/BackHeader';
import { chapters } from '@/data/chapters';
import { loadChapter } from '@/data/versesLoader';
import { loadChapterEn } from '@/data/versesEnLoader';
import type { Verse } from '@/types';
import { getProgress } from '@/utils/storage';
import { useI18n } from '@/i18n';

const ChapterDetailPage: React.FC = () => {
  const router = useRouter();
  const { t, theme, chapterTitle, chapterDescription, lang } = useI18n();
  const rawChapterId = Number(router.params.id || '1');
  // 无效 id 回退到第 1 篇，保证头部与列表一致
  const chapterId = chapters.some(c => c.id === rawChapterId) ? rawChapterId : 1;
  const [readVerseIds, setReadVerseIds] = useState<number[]>([]);
  const [noteVerseIds, setNoteVerseIds] = useState<number[]>([]);

  useDidShow(() => {
    // 导航栏标题随语言刷新
    Taro.setNavigationBarTitle({ title: t('chapter.title') });
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
        // 英文模式：用英文数据覆盖 keyPoint 等展示字段（缺失逐字段回退中文，原文共用）
        const enList = lang === 'en' ? await loadChapterEn(chapterId) : [];
        const enMap = new Map(enList.map(v => [v.id, v]));
        const sorted = [...verses]
          .map(v => {
            const en = enMap.get(v.id);
            return en ? { ...v, keyPoint: en.keyPoint || v.keyPoint } : v;
          })
          .sort((a, b) => a.order - b.order);
        if (!cancelled) {
          setChapterVerses(sorted);
          setLoading(false);
        }
      } catch (e) {
        console.error('[ChapterDetail] Load chapter failed:', e);
        if (!cancelled) {
          setLoading(false);
          setLoadFailed(true);
          Taro.showToast({ title: t('common.loadFailed'), icon: 'none', duration: 2000 });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId, retryTick, lang]);

  const readCount = useMemo(() => {
    return chapterVerses.filter(v => readVerseIds.includes(v.id)).length;
  }, [chapterVerses, readVerseIds]);

  const handleVerseClick = (verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <BackHeader title={t('chapter.title')} />
      {/* 篇章头部 */}
      <View className={styles.chapterHeader}>
        <Text className={styles.chapterTitle}>{chapterTitle(chapter.id, chapter.title)}</Text>
        <Text className={styles.chapterTheme}>{theme(chapter.theme)}</Text>
        <Text className={styles.chapterDesc}>{chapterDescription(chapter.id, chapter.description)}</Text>
      </View>

      {/* 进度 */}
      {chapterVerses.length > 0 && (
        <ProgressBar current={readCount} total={chapterVerses.length} label={t('chapter.progress')} />
      )}

      {/* 句子列表 */}
      <View className={styles.listTitle}>
        <Text className={styles.listTitleText}>{t('chapter.verseList')}</Text>
        <Text className={styles.listCount}>{t('chapter.countVerses', { n: chapterVerses.length })}</Text>
      </View>
      <View className={styles.verseList}>
        {loading ? (
          <Text className={styles.emptyTip}>{t('chapter.loadingList')}</Text>
        ) : loadFailed ? (
          <View className={styles.loadFailedWrap}>
            <Text className={styles.emptyTip}>{t('common.loadFailedNetwork')}</Text>
            <View
              className={styles.retryBtn}
              style={{ marginTop: 24 }}
              onClick={() => {
                setLoading(true);
                setRetryTick(t => t + 1);
              }}
            >
              <Text>{t('common.retry')}</Text>
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
          <Text className={styles.emptyTip}>{t('chapter.compiling')}</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default ChapterDetailPage;
