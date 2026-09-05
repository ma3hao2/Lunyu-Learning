import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

interface BackHeaderProps {
  /** 栏内居中展示的标题（可选；页面自身已带大标题时可不传） */
  title?: string;
}

// 顶部返回栏：微信端用原生导航栏（自带返回箭头），此组件仅在 H5（含桌面版）渲染
const BackHeader: React.FC<BackHeaderProps> = ({ title }) => {
  if (process.env.TARO_ENV !== 'h5') {
    return null;
  }

  const goBack = () => {
    // 直链打开（页面栈只有当前页）时无处可退，回首页兜底
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
    } else {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  };

  return (
    <>
      {/* 占位：撑起固定栏高度，避免页面首屏内容被遮挡 */}
      <View className={styles.placeholder} />
      <View className={styles.bar}>
        <View className={styles.backBtn} onClick={goBack}>
          <Text className={styles.backArrow}>‹</Text>
          <Text className={styles.backText}>返回</Text>
        </View>
        {title ? <Text className={styles.title}>{title}</Text> : null}
      </View>
    </>
  );
};

export default BackHeader;
