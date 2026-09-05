import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import BackHeader from '@/components/BackHeader';
import { useI18n } from '@/i18n';

const PrivacyPage: React.FC = () => {
  const { t } = useI18n();
  // 导航栏标题随语言刷新
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: t('privacy.title') });
  });
  // 打开微信官方《小程序隐私保护指引》（需在小程序管理后台配置隐私保护指引后可用）
  const handleOpenContract = () => {
    Taro.openPrivacyContract({
      fail: () => {
        Taro.showToast({ title: t('privacy.contractUnavailable'), icon: 'none' });
      }
    });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* H5 端返回栏（页面自带标题，不重复传 title） */}
      <BackHeader />
      <View className={styles.section}>
        <Text className={styles.h2}>{t('privacy.title')}</Text>
        <Text className={styles.p}>{t('privacy.updatedAt')}</Text>
        <Text className={styles.p}>
          {t('privacy.intro')}
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s1')}</Text>
        <Text className={styles.p}>{t('privacy.s1p1')}</Text>
        <Text className={styles.p}>{t('privacy.s1p2')}</Text>
        <Text className={styles.p}>{t('privacy.s1p3')}</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s2')}</Text>
        <Text className={styles.p}>{t('privacy.s2p1')}</Text>
        <Text className={styles.p}>{t('privacy.s2p2')}</Text>
        <Text className={styles.p}>{t('privacy.s2p3')}</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s3')}</Text>
        <Text className={styles.p}>
          {t('privacy.s3p1')}
        </Text>
        <Text className={styles.p}>
          {t('privacy.s3p2')}
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s4')}</Text>
        <Text className={styles.p}>
          {t('privacy.s4p1')}
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s5')}</Text>
        <Text className={styles.p}>
          {t('privacy.s5p1')}
        </Text>
        <View className={styles.contractBtn} onClick={handleOpenContract}>
          <Text>{t('privacy.s5btn')}</Text>
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>{t('privacy.s6')}</Text>
        <Text className={styles.p}>
          {t('privacy.s6p1')}
        </Text>
      </View>
    </ScrollView>
  );
};

export default PrivacyPage;
