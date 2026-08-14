import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

const PrivacyPage: React.FC = () => {
  // 打开微信官方《小程序隐私保护指引》（需在小程序管理后台配置隐私保护指引后可用）
  const handleOpenContract = () => {
    Taro.openPrivacyContract({
      fail: () => {
        Taro.showToast({ title: '暂不可用，请稍后再试', icon: 'none' });
      }
    });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <View className={styles.section}>
        <Text className={styles.h2}>隐私政策</Text>
        <Text className={styles.p}>更新日期：2026-08-14</Text>
        <Text className={styles.p}>
          本小程序（「论语学习」）由论语学习团队提供。我们重视你的隐私，本政策说明我们收集和使用哪些信息。
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>1. 我们收集的信息</Text>
        <Text className={styles.p}>- 学习进度（已读章句、笔记），默认仅保存在你的设备本地；</Text>
        <Text className={styles.p}>- 微信登录信息（openId、昵称、头像），用于云端同步学习进度与笔记；</Text>
        <Text className={styles.p}>- 剪贴板：在「设置 → 数据来源」复制链接时使用（仅在你点击复制时写入，本小程序不读取剪贴板内容）；</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>2. 信息的使用</Text>
        <Text className={styles.p}>- 本地数据仅用于在你设备上展示学习进度与笔记；</Text>
        <Text className={styles.p}>- 云端数据用于多设备同步；</Text>
        <Text className={styles.p}>- 我们不会将你的个人信息出售给任何第三方。</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>3. 云同步与用户行为统计</Text>
        <Text className={styles.p}>
          - 云同步：登录后，你的学习进度与本地笔记会上传至云端，仅用于多设备同步。在你同意隐私授权之前，本小程序不会上传任何数据；
        </Text>
        <Text className={styles.p}>
          - 用户行为统计：未征得你的同意前，我们不会开启行为数据统计。你首次登录时，系统会弹出微信官方隐私授权框，你可以在其中选择同意或拒绝。
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>4. 你的权利</Text>
        <Text className={styles.p}>
          你可以在「设置 → 清空学习数据」清除本地学习数据。
        </Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>5. 微信官方隐私保护指引</Text>
        <Text className={styles.p}>
          除本政策外，微信平台对小程序还有统一的隐私保护要求，可点击下方按钮查看官方指引。
        </Text>
        <View className={styles.contractBtn} onClick={handleOpenContract}>
          <Text>查看《微信小程序隐私保护指引》</Text>
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.h3}>6. 联系我们</Text>
        <Text className={styles.p}>
          如有隐私相关问题，可通过微信小程序客服或意见反馈渠道联系我们（联系方式将在上线前补充）。
        </Text>
      </View>
    </ScrollView>
  );
};

export default PrivacyPage;
