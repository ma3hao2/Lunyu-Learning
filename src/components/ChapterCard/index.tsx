import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import { Chapter } from '@/types';
import styles from './index.module.scss';

interface ChapterCardProps {
  chapter: Chapter;
  readCount?: number;
  onClick?: (chapterId: number) => void;
}

const ChapterCard: React.FC<ChapterCardProps> = ({ chapter, readCount = 0, onClick }) => {
  const isCompleted = readCount >= chapter.verseCount && readCount > 0;
  const isInProgress = readCount > 0 && readCount < chapter.verseCount;

  return (
    <View
      className={classnames(styles.card, isCompleted && styles.completed)}
      onClick={() => onClick?.(chapter.id)}
    >
      <View className={styles.leftSection}>
        <View className={styles.indexBox}>
          <Text className={styles.indexText}>{chapter.id}</Text>
        </View>
      </View>
      <View className={styles.content}>
        <View className={styles.titleRow}>
          <Text className={styles.title}>{chapter.title}</Text>
          {isCompleted && <Text className={styles.statusBadge}>已读完</Text>}
          {isInProgress && <Text className={styles.statusBadgeProgress}>已读{readCount}/{chapter.verseCount}</Text>}
        </View>
        <Text className={styles.description}>{chapter.description}</Text>
        <View className={styles.tagRow}>
          <Text className={styles.tag}>{chapter.theme}</Text>
          <Text className={styles.count}>{chapter.verseCount}章</Text>
        </View>
      </View>
    </View>
  );
};

export default ChapterCard;
