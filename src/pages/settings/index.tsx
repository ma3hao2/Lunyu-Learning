import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { saveProgress } from '@/utils/storage';
import { getSettings, saveSettings, type AppSettings, type FontSize } from '@/utils/settings';
import { syncProgressNow } from '@/services/sync';
import { isLoggedIn, getUserInfo, clearCloudProgress } from '@/services/auth';
import type { UserInfo } from '@/types';

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'normal', label: '标准' },
  { value: 'large', label: '大' },
  { value: 'xl', label: '特大' }
];

// 数据来源：和合文化屋公众号（文章专辑链接，小程序内无法直接打开外链，采用复制方式提供）
const DATA_SOURCE_URL = 'https://mp.weixin.qq.com/mp/appmsgalbum?action=getalbum&__biz=MzUzNTkyNjQyMA==&scene=1&album_id=1337086542606696448&count=3#wechat_redirect';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [user, setUser] = useState<UserInfo | null>(() => getUserInfo());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 从设置页返回时同步最新状态
  useDidShow(() => {
    setSettings(getSettings());
    setUser(getUserInfo());
  });

  const applySettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...getSettings(), ...patch };
    saveSettings(next);
    setSettings(next);
  }, []);

  const goLogin = () => {
    Taro.switchTab({ url: '/pages/mine/index' });
  };

  // 手动双向同步（下载 → 合并写回本地 → 上传）
  const handleSync = useCallback(async () => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    Taro.showLoading({ title: '同步中...' });
    try {
      const res = await syncProgressNow();
      Taro.hideLoading();
      Taro.showToast({ title: res.message, icon: res.success ? 'success' : 'none' });
    } catch (e) {
      Taro.hideLoading();
      Taro.showToast({ title: '同步失败', icon: 'none' });
    }
  }, []);

  const handleClearData = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = useCallback(async () => {
    setShowClearConfirm(false);
    // 清空本地学习数据（应用设置不受影响）
    saveProgress({
      readVerseIds: [],
      myNotes: [],
      totalReadDays: 1,
      lastReadDate: undefined,
      deletedNoteIds: [],
      likedNoteIds: [],
      unlikedNoteIds: []
    });
    let message = '数据已清空';
    let icon: 'success' | 'none' = 'success';
    // 已登录则同步清空云端，避免旧数据在下次同步时复活
    if (isLoggedIn()) {
      try {
        const res = await clearCloudProgress();
        if (!res.success) {
          message = '本地已清空\n云端清理失败';
          icon = 'none';
        }
      } catch (e) {
        message = '本地已清空\n云端清理失败';
        icon = 'none';
      }
    }
    Taro.showToast({ title: message, icon, duration: 2000 });
    setTimeout(() => {
      // 用户可能已手动返回，栈深不足时不重复导航
      if (Taro.getCurrentPages().length > 1) {
        Taro.navigateBack();
      }
    }, 2000);
  }, []);

  const cancelClear = () => {
    setShowClearConfirm(false);
  };

  const handlePrivacy = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' });
  };

  const handleAbout = () => {
    Taro.showModal({
      title: '关于论语学习',
      content: '版本：1.0.0\n\n一款专注于《论语》学习的微信小程序，提供原文、译文、注释解读及学习心得功能。\n\n数据来源：和合文化屋公众号（见「数据来源」入口复制链接）',
      showCancel: false,
      confirmText: '知道了'
    });
  };

  // 复制数据来源链接到剪贴板（小程序无法直接打开公众号外链）
  const handleDataSource = () => {
    Taro.setClipboardData({
      data: DATA_SOURCE_URL,
      success: () => {
        Taro.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 页面标题 */}
      <View className={styles.header}>
        <Text className={styles.title}>设置</Text>
      </View>

      {/* 账号与同步 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>账号与同步</Text>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>{user ? (user.nickName || '学').charAt(0) : '未'}</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{user ? (user.nickName || '论语学习者') : '未登录'}</Text>
            <Text className={styles.menuDesc}>{user ? '已开启云端同步' : '登录后同步学习进度到云端'}</Text>
          </View>
          {!user && (
            <Text className={styles.menuAction} onClick={goLogin}>去登录</Text>
          )}
        </View>
        <View className={styles.menuItem} onClick={handleSync}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>同</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>同步学习进度</Text>
            <Text className={styles.menuDesc}>下载并上传合并云端数据</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>自</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>自动同步</Text>
            <Text className={styles.menuDesc}>保存进度后自动上传云端</Text>
          </View>
          <Switch
            checked={settings.autoSync}
            onChange={(e) => applySettings({ autoSync: e.detail.value })}
            color="#b8612d"
          />
        </View>
      </View>

      {/* 阅读体验 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>阅读体验</Text>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>字</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>正文字号</Text>
            <Text className={styles.menuDesc}>影响原文、译文与注释</Text>
          </View>
          <View className={styles.fontOptions}>
            {FONT_OPTIONS.map(opt => (
              <Text
                key={opt.value}
                className={classnames(styles.fontOption, settings.fontSize === opt.value && styles.fontOptionActive)}
                onClick={() => applySettings({ fontSize: opt.value })}
              >
                {opt.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 隐私与社区 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>隐私与社区</Text>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>公</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>新心得默认公开发布</Text>
            <Text className={styles.menuDesc}>写心得时发布开关的默认值</Text>
          </View>
          <Switch
            checked={settings.defaultPublic}
            onChange={(e) => applySettings({ defaultPublic: e.detail.value })}
            color="#b8612d"
          />
        </View>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>匿</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>公开心得使用匿名昵称</Text>
            <Text className={styles.menuDesc}>开启后显示「论语学习者」</Text>
          </View>
          <Switch
            checked={settings.anonymousNickname}
            onChange={(e) => applySettings({ anonymousNickname: e.detail.value })}
            color="#b8612d"
          />
        </View>
        <View className={styles.menuItem} onClick={handlePrivacy}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>隐</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>隐私政策</Text>
            <Text className={styles.menuDesc}>了解我们如何收集和使用数据</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 数据管理 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>数据管理</Text>
        <View className={styles.menuItem} onClick={handleClearData}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>清</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>清空学习数据</Text>
            <Text className={styles.menuDesc}>已读、点赞与本地笔记</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 关于 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>关于</Text>
        <View className={styles.menuItem} onClick={handleDataSource}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>源</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>数据来源</Text>
            <Text className={styles.menuDesc}>和合文化屋公众号</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={handleAbout}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>关</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>关于论语学习</Text>
            <Text className={styles.menuDesc}>版本与数据来源</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 版本信息 */}
      <View className={styles.versionInfo}>
        <Text className={styles.versionText}>论语学习 v1.0.0</Text>
        <Text className={styles.copyright}>© 2026 论语学习团队</Text>
      </View>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <View className={styles.modalOverlay} onClick={cancelClear}>
          <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>确认清空</Text>
            <Text className={styles.modalContent}>
              将清空已读记录、点赞与本地笔记，且无法恢复。已发布的公开心得不受影响，如需删除请先取消公开。确定继续吗？
            </Text>
            <View className={styles.modalActions}>
              <View className={styles.modalBtnCancel} onClick={cancelClear}>
                <Text>取消</Text>
              </View>
              <View className={styles.modalBtnConfirm} onClick={confirmClear}>
                <Text>确认清空</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default SettingsPage;
