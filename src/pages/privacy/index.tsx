import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import styles from './index.module.scss';

const PrivacyPage: React.FC = () => {
  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <View className={styles.section}>
        <Text className={styles.h2}>隐私政策</Text>
        <Text className={styles.p}>更新日期：2026-08-11</Text>
        <Text className={styles.p}>
          本小程序（「论语学习」）由论语学习团队提供。我们重视你的隐私，本政策说明我们收集和使用哪些信息。
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>1. 我们收集的信息</Text>
        <Text className={styles.p}>- 学习进度（已读章句、点赞、笔记），默认仅保存在你的设备本地；</Text>
        <Text className={styles.p}>- 微信登录信息（openId、昵称），用于云端同步学习进度；</Text>
        <Text className={styles.p}>- 你主动选择「公开发布」的心得内容、标签与昵称，将展示给其他用户。</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>2. 信息的使用</Text>
        <Text className={styles.p}>- 本地数据仅用于在你设备上展示学习进度与笔记；</Text>
        <Text className={styles.p}>- 云端数据用于多设备同步与公开心得展示；</Text>
        <Text className={styles.p}>- 我们不会将你的个人信息出售给任何第三方。</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>3. 你的权利</Text>
        <Text className={styles.p}>
          你可以在「设置 → 清空学习数据」清除本地学习数据；已发布的公开心得可在「我的」中取消公开或删除。
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>4. 联系我们</Text>
        <Text className={styles.p}>
          如有隐私相关问题，可通过微信小程序客服或意见反馈渠道联系我们（联系方式将在上线前补充）。
        </Text>
      </View>
    </ScrollView>
  );
};

export default PrivacyPage;
