import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import ProgressBar from '@/components/ProgressBar';
import { versesIndex, type VerseIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { getTodayRecommend } from '@/data/dailyRecommend';
import { getProgress } from '@/utils/storage';

const HomePage: React.FC = () => {
  const [readCount, setReadCount] = useState(0);
  const [totalReadDays, setTotalReadDays] = useState(1);
  const [noteCount, setNoteCount] = useState(() => getProgress().myNotes.length);
  const [dailyRecommend, setDailyRecommend] = useState(() => getTodayRecommend());

  const refreshProgress = useCallback(() => {
    const progress = getProgress();
    setReadCount(progress.readVerseIds.length);
    setTotalReadDays(progress.totalReadDays || 1);
    setNoteCount(progress.myNotes.length);
  }, []);

  useDidShow(() => {
    refreshProgress();
  });

  // 今日推荐：只用轻量索引（original 字段），避免加载完整章节数据进主包
  // dailyVerse 由 dailyRecommend 同步派生（useMemo），避免 state+useEffect 导致首帧 null 闪烁
  const dailyVerse = useMemo<VerseIndex | null>(
    () => versesIndex.find(v => v.id === dailyRecommend.verseId) || versesIndex[0] || null,
    [dailyRecommend]
  );

  // 下拉刷新：重新获取今日推荐与进度
  usePullDownRefresh(async () => {
    setDailyRecommend(getTodayRecommend());
    refreshProgress();
    Taro.stopPullDownRefresh();
  });

  // 经典名句（取前5条，仅展示原文索引）
  const classicVerses = useMemo(() => versesIndex.slice(0, 5), []);

  const totalVerses = useMemo(() => {
    return chapters.reduce((sum, c) => sum + c.verseCount, 0);
  }, []);

  const readChapters = useMemo(() => {
    const progress = getProgress();
    const readChapterIds = new Set(
      versesIndex.filter(v => progress.readVerseIds.includes(v.id)).map(v => v.chapterId)
    );
    return readChapterIds.size;
  }, [readCount]);

  const handleDailyClick = () => {
    if (!dailyVerse) return;
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${dailyVerse.id}` });
  };

  const handleClassicClick = (verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  };

  const handleNavigate = (path: string) => {
    Taro.switchTab({ url: path });
  };

  const handleMoreClassics = () => {
    Taro.switchTab({ url: '/pages/classics/index' });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 顶部标题 */}
      <View className={styles.header}>
        <Text className={styles.appTitle}>论语学习</Text>
        <Text className={styles.appSubtitle}>学而时习之，不亦说乎</Text>
      </View>

      {/* 今日推荐 */}
      <View className={styles.dailyCard} onClick={handleDailyClick}>
        <View className={styles.dailyLabel}>
          <Text className={styles.dailyLabelIcon}>日</Text>
          <Text className={styles.dailyLabelText}>今日推荐</Text>
        </View>
        {dailyVerse ? (
          <Text className={styles.dailyOriginal}>{dailyVerse.original}</Text>
        ) : (
          <Text className={styles.dailyOriginal}>加载中...</Text>
        )}
        <Text className={styles.dailyReason}>{dailyRecommend.reason}</Text>
        <View className={styles.dailyBtn}>
          <Text className={styles.dailyBtnText}>开始学习 ›</Text>
        </View>
      </View>

      {/* 学习进度 */}
      <View className={styles.progressSection}>
        <Text className={styles.progressTitle}>学习进度</Text>
        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount}</Text>
            <Text className={styles.statLabel}>已读章句</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readChapters}</Text>
            <Text className={styles.statLabel}>已读篇目</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount === 0 ? 0 : totalReadDays}</Text>
            <Text className={styles.statLabel}>连续学习</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{noteCount}</Text>
            <Text className={styles.statLabel}>我的笔记</Text>
          </View>
        </View>
        <ProgressBar current={readCount} total={totalVerses} label="总进度" />
      </View>

      {/* 快捷入口 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.sectionTitleText}>快捷入口</Text>
      </View>
      <View className={styles.quickGrid}>
        <View className={styles.quickItem} onClick={() => handleNavigate('/pages/classics/index')}>
          <View className={styles.quickIcon}>
            <Text className={styles.quickIconText}>书</Text>
          </View>
          <View className={styles.quickInfo}>
            <Text className={styles.quickName}>篇章阅读</Text>
            <Text className={styles.quickDesc}>二十篇全文</Text>
          </View>
        </View>
        <View className={styles.quickItem} onClick={() => handleNavigate('/pages/insights/index')}>
          <View className={styles.quickIcon}>
            <Text className={styles.quickIconText}>悟</Text>
          </View>
          <View className={styles.quickInfo}>
            <Text className={styles.quickName}>学习心得</Text>
            <Text className={styles.quickDesc}>交流感悟</Text>
          </View>
        </View>
        <View className={styles.quickItem} onClick={() => handleNavigate('/pages/mine/index')}>
          <View className={styles.quickIcon}>
            <Text className={styles.quickIconText}>记</Text>
          </View>
          <View className={styles.quickInfo}>
            <Text className={styles.quickName}>我的笔记</Text>
            <Text className={styles.quickDesc}>记录心得</Text>
          </View>
        </View>
        <View className={styles.quickItem} onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <View className={styles.quickIcon}>
            <Text className={styles.quickIconText}>设</Text>
          </View>
          <View className={styles.quickInfo}>
            <Text className={styles.quickName}>设置</Text>
            <Text className={styles.quickDesc}>数据管理</Text>
          </View>
        </View>
      </View>

      {/* 经典名句 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.sectionTitleText}>经典名句</Text>
        <Text className={styles.sectionMore} onClick={handleMoreClassics}>查看全部 ›</Text>
      </View>
      <View className={styles.classicList}>
        {classicVerses.map(verse => (
          <View
            key={verse.id}
            className={styles.classicCard}
            onClick={() => handleClassicClick(verse.id)}
          >
            <Text className={styles.classicOriginal}>{verse.original}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default HomePage;
