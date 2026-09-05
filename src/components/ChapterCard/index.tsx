import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import { Chapter } from '@/types';
import { useI18n } from '@/i18n';
import styles from './index.module.scss';

interface ChapterCardProps {
  chapter: Chapter;
  readCount?: number;
  onClick?: (chapterId: number) => void;
}

const ChapterCard: React.FC<ChapterCardProps> = ({ chapter, readCount = 0, onClick }) => {
  const { t, theme, chapterTitle, chapterDescription } = useI18n();
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
          <Text className={styles.title}>{chapterTitle(chapter.id, chapter.title)}</Text>
          {isCompleted && <Text className={styles.statusBadge}>{t('chapter.readAll')}</Text>}
          {isInProgress && (
            <Text className={styles.statusBadgeProgress}>
              {t('chapter.readProgress', { n: readCount, m: chapter.verseCount })}
            </Text>
          )}
        </View>
        <Text className={styles.description}>{chapterDescription(chapter.id, chapter.description)}</Text>
        <View className={styles.tagRow}>
          <Text className={styles.tag}>{theme(chapter.theme)}</Text>
          <Text className={styles.count}>{t('chapter.verseCount', { n: chapter.verseCount })}</Text>
        </View>
      </View>
    </View>
  );
};

export default ChapterCard;
