import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
  const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <View className={styles.container}>
      {label && (
        <View className={styles.labelRow}>
          <Text className={styles.label}>{label}</Text>
          <Text className={styles.percent}>{percent.toFixed(0)}%</Text>
        </View>
      )}
      <View className={styles.track}>
        <View className={styles.fill} style={{ width: `${percent}%` }} />
      </View>
      <Text className={styles.count}>{current} / {total}</Text>
    </View>
  );
};

export default ProgressBar;
