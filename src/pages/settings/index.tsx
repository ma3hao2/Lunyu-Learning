import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import BackHeader from '@/components/BackHeader';
import { saveProgress, clearPendingSync } from '@/utils/storage';
import { getSettings, saveSettings, type AppSettings, type FontSize } from '@/utils/settings';
import { syncProgressNow } from '@/services/sync';
import { isLoggedIn, getUserInfo, clearCloudProgress, ensurePrivacyAuthorized } from '@/services/auth';
import { useI18n } from '@/i18n';
import type { Language, UserInfo } from '@/types';

const FONT_OPTIONS: { value: FontSize }[] = [
  { value: 'normal' },
  { value: 'large' },
  { value: 'xl' }
];

// 界面语言选项（label 经 t() 取值：英文模式下「中文」选项保持原样，便于切回）
const LANGUAGE_OPTIONS: { value: Language }[] = [
  { value: 'zh' },
  { value: 'en' }
];

const FONT_LABEL_KEYS = {
  normal: 'settings.fontNormal',
  large: 'settings.fontLarge',
  xl: 'settings.fontXl'
} as const;

// 数据来源：和合文化屋公众号（文章专辑链接，小程序内无法直接打开外链，采用复制方式提供）
const DATA_SOURCE_URL = 'https://mp.weixin.qq.com/mp/appmsgalbum?action=getalbum&__biz=MzUzNTkyNjQyMA==&scene=1&album_id=1337086542606696448&count=3#wechat_redirect';

const SettingsPage: React.FC = () => {
  const { t, setLang } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [user, setUser] = useState<UserInfo | null>(() => getUserInfo());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 从设置页返回时同步最新状态；导航栏标题随语言刷新
  useDidShow(() => {
    setSettings(getSettings());
    setUser(getUserInfo());
    Taro.setNavigationBarTitle({ title: t('settings.title') });
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
      Taro.showToast({ title: t('settings.pleaseLogin'), icon: 'none' });
      return;
    }
    Taro.showLoading({ title: t('settings.syncing') });
    try {
      const res = await syncProgressNow();
      Taro.hideLoading();
      Taro.showToast({ title: res.message, icon: res.success ? 'success' : 'none' });
    } catch (e) {
      Taro.hideLoading();
      Taro.showToast({ title: t('settings.syncFailed'), icon: 'none' });
    }
  }, [t]);

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
      lastReadVerseId: undefined,
      deletedNoteIds: [],
      likedNoteIds: [],
      unlikedNoteIds: []
    });
    // 取消 saveProgress 触发的 3 秒防抖上传，避免「清空云端」意图与自动上传时序冲突
    clearPendingSync();
    let message = t('settings.cleared');
    let icon: 'success' | 'none' = 'success';
    // 已登录则同步清空云端，避免旧数据在下次同步时复活
    if (isLoggedIn()) {
      try {
        const res = await clearCloudProgress();
        if (!res.success) {
          message = t('settings.clearedCloudFailed');
          icon = 'none';
        }
      } catch (e) {
        message = t('settings.clearedCloudFailed');
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
  }, [t]);

  const cancelClear = () => {
    setShowClearConfirm(false);
  };

  const handlePrivacy = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' });
  };

  const handleAbout = () => {
    Taro.showModal({
      title: t('settings.aboutTitle'),
      content: t('settings.aboutContent'),
      showCancel: false,
      confirmText: t('common.known')
    });
  };

  // 复制数据来源链接到剪贴板（小程序无法直接打开公众号外链）
  // setClipboardData 属微信隐私接口：先确保用户已同意隐私协议（未声明/未授权会 errno 112 失败）
  // 注意：须在微信后台「用户隐私保护指引」声明「剪贴板（用于复制数据来源链接）」，否则走 fail 兜底
  const handleDataSource = async () => {
    const authorized = await ensurePrivacyAuthorized();
    if (!authorized) {
      Taro.showToast({ title: t('settings.privacyNeededCopy'), icon: 'none' });
      return;
    }
    Taro.setClipboardData({
      data: DATA_SOURCE_URL,
      success: () => {
        Taro.showToast({ title: t('settings.linkCopied'), icon: 'success' });
      },
      fail: () => {
        // 后台隐私指引未声明剪贴板 scope 时微信直接拒绝（errno 112），静默提示不崩溃
        Taro.showToast({ title: t('settings.copyFailed'), icon: 'none' });
      }
    });
  };

  // 切换界面语言（设置持久化在 applySettings 内完成，Provider 的 setLang 负责状态与 tabBar 刷新）
  const handleLanguageChange = (next: Language) => {
    if (next === settings.language) return;
    setLang(next);
    applySettings({ language: next });
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* H5 端返回栏（页面自带标题，不重复传 title） */}
      <BackHeader />
      {/* 页面标题 */}
      <View className={styles.header}>
        <Text className={styles.title}>{t('settings.title')}</Text>
      </View>

      {/* 账号与同步 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>{t('settings.sectionAccount')}</Text>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>{user ? (user.nickName || '学').charAt(0) : '未'}</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{user ? (user.nickName || t('mine.defaultNick')) : t('settings.notLoggedIn')}</Text>
            <Text className={styles.menuDesc}>{user ? t('settings.cloudSyncOn') : t('mine.loginDesc')}</Text>
          </View>
          {!user && (
            <Text className={styles.menuAction} onClick={goLogin}>{t('settings.goLogin')}</Text>
          )}
        </View>
        <View className={styles.menuItem} onClick={handleSync}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>同</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.syncNow')}</Text>
            <Text className={styles.menuDesc}>{t('settings.syncNowDesc')}</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>自</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.autoSync')}</Text>
            <Text className={styles.menuDesc}>{t('settings.autoSyncDesc')}</Text>
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
        <Text className={styles.sectionTitle}>{t('settings.sectionReading')}</Text>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>字</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.fontSize')}</Text>
            <Text className={styles.menuDesc}>{t('settings.fontSizeDesc')}</Text>
          </View>
          <View className={styles.fontOptions}>
            {FONT_OPTIONS.map(opt => (
              <Text
                key={opt.value}
                className={classnames(styles.fontOption, settings.fontSize === opt.value && styles.fontOptionActive)}
                onClick={() => applySettings({ fontSize: opt.value })}
              >
                {t(FONT_LABEL_KEYS[opt.value])}
              </Text>
            ))}
          </View>
        </View>
        <View className={styles.menuItem}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>语</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.language')}</Text>
            <Text className={styles.menuDesc}>{t('settings.languageDesc')}</Text>
          </View>
          <View className={styles.fontOptions}>
            {LANGUAGE_OPTIONS.map(opt => (
              <Text
                key={opt.value}
                className={classnames(styles.fontOption, settings.language === opt.value && styles.fontOptionActive)}
                onClick={() => handleLanguageChange(opt.value)}
              >
                {opt.value === 'zh' ? t('settings.langZh') : t('settings.langEn')}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 隐私 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>{t('settings.sectionPrivacy')}</Text>
        <View className={styles.menuItem} onClick={handlePrivacy}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>隐</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.privacyPolicy')}</Text>
            <Text className={styles.menuDesc}>{t('settings.privacyDesc')}</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 数据管理 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>{t('settings.sectionData')}</Text>
        <View className={styles.menuItem} onClick={handleClearData}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>清</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.clearData')}</Text>
            <Text className={styles.menuDesc}>{t('settings.clearDataDesc')}</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 关于 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>{t('settings.sectionAbout')}</Text>
        <View className={styles.menuItem} onClick={handleDataSource}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>源</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.dataSource')}</Text>
            <Text className={styles.menuDesc}>{t('settings.dataSourceDesc')}</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={handleAbout}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>关</Text>
          </View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuText}>{t('settings.aboutApp')}</Text>
            <Text className={styles.menuDesc}>{t('settings.aboutDesc')}</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 版本信息 */}
      <View className={styles.versionInfo}>
        <Text className={styles.versionText}>{t('settings.version')}</Text>
        <Text className={styles.copyright}>{t('settings.copyright')}</Text>
      </View>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <View className={styles.modalOverlay} onClick={cancelClear}>
          <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>{t('settings.clearTitle')}</Text>
            <Text className={styles.modalContent}>
              {t('settings.clearContent')}
            </Text>
            <View className={styles.modalActions}>
              <View className={styles.modalBtnCancel} onClick={cancelClear}>
                <Text>{t('common.cancel')}</Text>
              </View>
              <View className={styles.modalBtnConfirm} onClick={confirmClear}>
                <Text>{t('settings.clearConfirmBtn')}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default SettingsPage;
