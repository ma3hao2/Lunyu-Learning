import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import { Verse } from '@/types';
import styles from './index.module.scss';

interface VerseCardProps {
  verse: Verse;
  isRead?: boolean;
  hasNote?: boolean;
  onClick?: (verseId: number) => void;
}

const VerseCard: React.FC<VerseCardProps> = ({ verse, isRead = false, hasNote = false, onClick }) => {
  return (
    <View
      className={classnames(styles.card, isRead && styles.read)}
      onClick={() => onClick?.(verse.id)}
    >
      <View className={styles.header}>
        <Text className={styles.order}>第{verse.order}章</Text>
        <View className={styles.badges}>
          {hasNote && <Text className={styles.noteBadge}>笔记</Text>}
          {isRead && <Text className={styles.badge}>已读</Text>}
        </View>
      </View>
      <Text className={styles.original}>{verse.original}</Text>
      <Text className={styles.keyPoint}>{verse.keyPoint}</Text>
      <View className={styles.footer}>
        <Text className={styles.arrow}>查看详情 ›</Text>
      </View>
    </View>
  );
};

export default VerseCard;
