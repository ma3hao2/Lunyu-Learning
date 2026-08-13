import React from 'react';
import { View } from '@tarojs/components';
import type { CSSProperties } from 'react';
import styles from './index.module.scss';

interface SkeletonProps {
  width?: string;   // 宽度，默认 100%
  height?: string;  // 高度，默认 24px
  style?: CSSProperties;
}

/** 骨架屏占位块（P2-5）：灰色圆角块 + 流光动画，替代"加载中..."文字 */
const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '24px', style }) => {
  return (
    <View
      className={styles.skeleton}
      style={{ width, height, ...style }}
    />
  );
};

export default Skeleton;
