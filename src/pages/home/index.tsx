import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import ProgressBar from '@/components/ProgressBar';
import Skeleton from '@/components/Skeleton';
import { versesIndex, type VerseIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { getTodayRecommend, getAlternativeRecommend } from '@/data/dailyRecommend';
import { getProgress } from '@/utils/storage';

const HomePage: React.FC = () => {
  const [readCount, setReadCount] = useState(0);
  const [totalReadDays, setTotalReadDays] = useState(1);
  const [noteCount, setNoteCount] = useState(() => getProgress().myNotes.length);
  const [readVerseIds, setReadVerseIds] = useState<number[]>([]);
  const [lastReadVerseId, setLastReadVerseId] = useState<number | undefined>(undefined);
  const [dailyRecommend, setDailyRecommend] = useState(() => getTodayRecommend());

  const refreshProgress = useCallback(() => {
    const progress = getProgress();
    setReadCount(progress.readVerseIds.length);
    setReadVerseIds(progress.readVerseIds);
    setLastReadVerseId(progress.lastReadVerseId);
    setTotalReadDays(progress.totalReadDays || 1);
    setNoteCount(progress.myNotes.length);
  }, []);

  useDidShow(() => {
    refreshProgress();
    // 每次进入首页轮换经典名句
    setClassicVerses(pickRandomVerses());
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

  // 经典名句：随机取 5 条（每次进入页面轮换，避免老用户看腻固定内容）
  const pickRandomVerses = useCallback((): VerseIndex[] => {
    const shuffled = [...versesIndex].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, []);
  const [classicVerses, setClassicVerses] = useState<VerseIndex[]>(() => pickRandomVerses());

  const totalVerses = useMemo(() => {
    return chapters.reduce((sum, c) => sum + c.verseCount, 0);
  }, []);

  const readChapters = useMemo(() => {
    // 先建 Set 再过滤（对齐 classics 页写法），避免 filter 内 includes 线性扫描 O(n×m)
    const readSet = new Set(readVerseIds);
    const readChapterIds = new Set(
      versesIndex.filter(v => readSet.has(v.id)).map(v => v.chapterId)
    );
    return readChapterIds.size;
  }, [readVerseIds]);

  // 接着读：最后阅读的章句（含篇章信息，仅用轻量索引）
  const lastReadVerse = useMemo(() => {
    if (!lastReadVerseId) return null;
    const v = versesIndex.find(item => item.id === lastReadVerseId);
    if (!v) return null;
    const chapter = chapters.find(c => c.id === v.chapterId);
    return { ...v, chapterTitle: chapter?.title || '' };
  }, [lastReadVerseId]);

  const handleContinueRead = () => {
    if (!lastReadVerse) return;
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${lastReadVerse.id}` });
  };

  const handleDailyClick = () => {
    if (!dailyVerse) return;
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${dailyVerse.id}` });
  };

  // 换一批：从推荐池随机换一条（不重复当前）
  const handleShuffle = useCallback(() => {
    setDailyRecommend(getAlternativeRecommend(dailyRecommend.verseId));
  }, [dailyRecommend.verseId]);

  const handleClassicClick = (verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  };

  const handleNavigate = (path: string) => {
    Taro.switchTab({ url: path });
  };

  const handleMoreClassics = () => {
    Taro.switchTab({ url: '/pages/classics/index' });
  };

  // 搜索框入口：跳转分包搜索页（译文/注释全库搜索，含搜索历史）
  const handleOpenSearch = () => {
    Taro.navigateTo({ url: '/packageContent/pages/search/index' });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 顶部标题 */}
      <View className={styles.header}>
        <Text className={styles.appTitle}>论语学习</Text>
        <Text className={styles.appSubtitle}>学而时习之，不亦说乎</Text>
      </View>

      {/* 搜索入口（P2-1：最常驻页面提供搜索） */}
      <View className={styles.searchBar} onClick={handleOpenSearch}>
        <Text className={styles.searchIcon}>搜</Text>
        <Text className={styles.searchPlaceholder}>搜索译文、注释...（支持全库搜索）</Text>
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
          /* 骨架屏（P2-5）：数据未就绪时的加载占位 */
          <View className={styles.dailySkeleton}>
            <Skeleton height="44rpx" />
            <Skeleton height="44rpx" width="70%" style={{ marginTop: '16rpx' }} />
          </View>
        )}
        <Text className={styles.dailyReason}>{dailyRecommend.reason}</Text>
        <View className={styles.dailyActions}>
          <View className={styles.dailyBtn} onClick={(e) => { e.stopPropagation(); handleShuffle(); }}>
            <Text className={styles.dailyBtnText}>换一批</Text>
          </View>
          <View className={styles.dailyBtn} onClick={(e) => { e.stopPropagation(); handleDailyClick(); }}>
            <Text className={styles.dailyBtnText}>开始学习 ›</Text>
          </View>
        </View>
      </View>

      {/* 继续学习（上次阅读位置，点击续读） */}
      {lastReadVerse && (
        <View className={styles.continueCard} onClick={handleContinueRead}>
          <View className={styles.dailyLabel}>
            <Text className={styles.dailyLabelIcon}>续</Text>
            <Text className={styles.dailyLabelText}>继续学习</Text>
          </View>
          <Text className={styles.dailyOriginal} numberOfLines={2}>{lastReadVerse.original}</Text>
          <View className={styles.dailyBtn}>
            <Text className={styles.dailyBtnText}>{lastReadVerse.chapterTitle} · {lastReadVerse.chapterId}-{lastReadVerse.order} ›</Text>
          </View>
        </View>
      )}

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
            <Text className={styles.statNumber}>{readCount === 0 ? 0 : totalReadDays} 🔥</Text>
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
            <Text className={styles.quickName}>个人中心</Text>
            <Text className={styles.quickDesc}>学习数据</Text>
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
