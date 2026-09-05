import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import { Verse } from '@/types';
import { useI18n } from '@/i18n';
import styles from './index.module.scss';

interface VerseCardProps {
  verse: Verse;
  isRead?: boolean;
  hasNote?: boolean;
  onClick?: (verseId: number) => void;
}

const VerseCard: React.FC<VerseCardProps> = ({ verse, isRead = false, hasNote = false, onClick }) => {
  const { t } = useI18n();
  return (
    <View
      className={classnames(styles.card, isRead && styles.read)}
      onClick={() => onClick?.(verse.id)}
    >
      <View className={styles.header}>
        <Text className={styles.order}>{verse.chapterId}-{verse.order}</Text>
        <View className={styles.badges}>
          {hasNote && <Text className={styles.noteBadge}>{t('verse.badgeNote')}</Text>}
          {isRead && <Text className={styles.badge}>{t('verse.badgeRead')}</Text>}
        </View>
      </View>
      <Text className={styles.original}>{verse.original}</Text>
      <Text className={styles.keyPoint}>{verse.keyPoint}</Text>
      <View className={styles.footer}>
        <Text className={styles.arrow}>{t('verse.viewDetail')}</Text>
      </View>
    </View>
  );
};

export default VerseCard;
