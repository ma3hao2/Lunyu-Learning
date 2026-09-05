import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Image, Button, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import ProgressBar from '@/components/ProgressBar';
import { getProgress } from '@/utils/storage';
import { versesIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { getUserInfo, silentLoginAndMerge, logout, updateProfile, ensurePrivacyAuthorized } from '@/services/auth';
import { useI18n } from '@/i18n';
import type { UserInfo } from '@/types';

const MinePage: React.FC = () => {
  const { t } = useI18n();
  const [progress, setProgress] = useState(getProgress());
  const [user, setUser] = useState<UserInfo | null>(getUserInfo());
  const [logging, setLogging] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // 资料编辑弹层
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editNickName, setEditNickName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // 打开资料编辑（预填当前昵称/头像）
  const openProfileEditor = () => {
    setEditNickName(user?.nickName && user.nickName !== t('mine.defaultNick') ? user.nickName : '');
    setEditAvatarUrl(user?.avatarUrl || '');
    setShowProfileEditor(true);
  };

  // 保存资料（云函数 updateProfile + 本地缓存）
  const handleSaveProfile = async () => {
    const nickName = editNickName.trim() || t('mine.defaultNick');
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const u = await updateProfile({ nickName, avatarUrl: editAvatarUrl });
      setUser(u);
      setAvatarFailed(false);
      setShowProfileEditor(false);
      Taro.showToast({ title: t('mine.profileSaved'), icon: 'success' });
    } catch (e: any) {
      console.error('[Mine] 更新资料失败:', e);
      Taro.showToast({ title: e?.message || t('mine.profileSaveFailed'), icon: 'none' });
    } finally {
      setSavingProfile(false);
    }
  };

  useDidShow(() => {
    // 导航栏标题随语言刷新（tab 页标题走原生导航栏）
    Taro.setNavigationBarTitle({ title: t('tab.mine') });
    setProgress(getProgress());
    const u = getUserInfo();
    setUser(u);
    // 用户信息刷新（换头像等）时重置头像加载失败标记
    setAvatarFailed(false);
  });

  const readCount = progress.readVerseIds.length;
  const totalReadDays = progress.totalReadDays || 1;
  const totalVerses = useMemo(() => chapters.reduce((sum, c) => sum + c.verseCount, 0), []);

  const readChapterIds = useMemo(() => {
    return new Set(
      versesIndex.filter(v => progress.readVerseIds.includes(v.id)).map(v => v.chapterId)
    );
  }, [progress]);

  const loggedIn = user !== null;

  // 登录（App 启动已静默自动登录；此处按钮保留兜底：登录 + 合并数据）
  const handleLogin = useCallback(async () => {
    if (logging) return;
    setLogging(true);
    try {
      // 隐私合规：登录（云同步数据上传）前先确保用户同意隐私政策，未授权则弹官方授权框
      const authorized = await ensurePrivacyAuthorized();
      if (!authorized) {
        Taro.showToast({ title: t('mine.privacyNeededLogin'), icon: 'none' });
        return;
      }
      const u = await silentLoginAndMerge();
      if (!u) throw new Error(t('mine.loginFailed'));
      setUser(u);
      setProgress(getProgress());
      Taro.showToast({ title: t('mine.loginSuccess'), icon: 'success' });
    } catch (e: any) {
      console.error('[Mine] login failed:', e);
      Taro.showToast({ title: e?.message || t('mine.loginFailed'), icon: 'none' });
    } finally {
      setLogging(false);
    }
  }, [logging]);

  // 退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: t('mine.logoutTitle'),
      content: t('mine.logoutContent'),
      success: (res) => {
        if (res.confirm) {
          logout();
          setUser(null);
          setProgress(getProgress());
          Taro.showToast({ title: t('mine.loggedOut'), icon: 'none' });
        }
      }
    });
  }, []);

  const handleMenuClick = (type: string) => {
    if (type === 'continue') {
      // 真正续读：有上次阅读位置直接进章句详情，否则去论语列表
      const lastReadVerseId = getProgress().lastReadVerseId;
      if (lastReadVerseId) {
        Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${lastReadVerseId}` });
      } else {
        Taro.switchTab({ url: '/pages/classics/index' });
      }
    } else if (type === 'classics') {
      Taro.switchTab({ url: '/pages/classics/index' });
    } else if (type === 'insights') {
      // 我的笔记：内容已移至「心得」tab
      Taro.switchTab({ url: '/pages/insights/index' });
    } else if (type === 'settings') {
      Taro.navigateTo({ url: '/pages/settings/index' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      {/* 用户卡片 */}
      <View className={styles.userCard}>
        {loggedIn && user ? (
          <View className={styles.userInfo}>
            <View className={styles.avatar}>
              {user.avatarUrl && !avatarFailed ? (
                <Image
                  className={styles.avatarImg}
                  src={user.avatarUrl}
                  mode="aspectFill"
                  lazyLoad
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <Text className={styles.avatarText}>
                  {(user.nickName || '学').charAt(0)}
                </Text>
              )}
            </View>
            <View className={styles.userMeta}>
              <Text className={styles.userName}>{user.nickName || t('mine.defaultNick')}</Text>
              <Text className={styles.userDesc} onClick={openProfileEditor}>{t('mine.editProfile')}</Text>
            </View>
            <View className={styles.logoutBtn} onClick={handleLogout}>
              <Text className={styles.logoutText}>{t('mine.logoutBtn')}</Text>
            </View>
          </View>
        ) : (
          <View className={styles.loginArea} onClick={handleLogin}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>学</Text>
            </View>
            <View className={styles.userMeta}>
              <Text className={styles.userName}>
                {logging ? t('mine.loggingIn') : t('mine.tapToLogin')}
              </Text>
              <Text className={styles.userDesc}>{t('mine.loginDesc')}</Text>
            </View>
            <View className={styles.loginBtn}>
              <Text className={styles.loginBtnText}>{t('mine.loginBtn')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* 统计数据 */}
      <View className={styles.statsCard}>
        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount}</Text>
            <Text className={styles.statLabel}>{t('home.statVerses')}</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readChapterIds.size}</Text>
            <Text className={styles.statLabel}>{t('home.statChapters')}</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount === 0 ? 0 : totalReadDays} 🔥</Text>
            <Text className={styles.statLabel}>{t('home.statStreak')}</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{progress.myNotes.length}</Text>
            <Text className={styles.statLabel}>{t('home.statNotes')}</Text>
          </View>
        </View>
      </View>

      {/* 学习进度 */}
      <View className={styles.progressSection}>
        <Text className={styles.progressTitle}>{t('mine.progress')}</Text>
        <ProgressBar current={readCount} total={totalVerses} label={t('mine.progressLabel')} />
      </View>

      {/* 功能菜单 */}
      <View className={styles.menuSection}>
        <View className={styles.menuItem} onClick={() => handleMenuClick('continue')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>读</Text>
          </View>
          <Text className={styles.menuText}>{t('mine.menuContinue')}</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => handleMenuClick('insights')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>记</Text>
          </View>
          <Text className={styles.menuText}>{t('home.qNotes')}</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => handleMenuClick('settings')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>置</Text>
          </View>
          <Text className={styles.menuText}>{t('settings.title')}</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 资料编辑弹层（头像昵称填写能力：chooseAvatar 按钮 + nickname 输入框） */}
      {showProfileEditor && (
        <View className={styles.profileMask} onClick={() => setShowProfileEditor(false)}>
          <View className={styles.profilePanel} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.profileTitle}>{t('mine.profileTitle')}</Text>

            {/* 头像选择：微信头像昵称填写能力 */}
            {/* chooseAvatar 返回临时路径（wxfile://tmp_*），会被微信随时清理，须先上传云存储拿 fileID 再保存，否则重启/换设备后头像失效 */}
            <Button
              className={styles.avatarPicker}
              openType="chooseAvatar"
              onChooseAvatar={async (e) => {
                const tempPath = e.detail.avatarUrl;
                if (!tempPath) return;
                if (process.env.TARO_ENV !== 'weapp') {
                  // 非小程序环境（H5 调试）无云存储，直接使用临时路径
                  setEditAvatarUrl(tempPath);
                  return;
                }
                try {
                  const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                  const res = await Taro.cloud.uploadFile({ cloudPath, filePath: tempPath });
                  setEditAvatarUrl(res.fileID);
                } catch (err) {
                  console.error('[Mine] 头像上传失败:', err);
                  Taro.showToast({ title: t('mine.avatarUploadFailed'), icon: 'none' });
                }
              }}
            >
              {editAvatarUrl ? (
                <Image className={styles.avatarPickerImg} src={editAvatarUrl} mode="aspectFill" />
              ) : (
                <Text className={styles.avatarPickerText}>{t('mine.chooseAvatar')}</Text>
              )}
            </Button>

            {/* 昵称输入：微信昵称联想输入 */}
            <Input
              className={styles.nicknameInput}
              type="nickname"
              placeholder={t('mine.nicknamePlaceholder')}
              value={editNickName}
              maxlength={20}
              onInput={(e) => setEditNickName(e.detail.value)}
            />

            <View className={styles.profileActions}>
              <View className={styles.profileCancel} onClick={() => setShowProfileEditor(false)}>
                <Text>{t('common.cancel')}</Text>
              </View>
              <View
                className={classnames(styles.profileSave, savingProfile && styles.profileSaveDisabled)}
                onClick={handleSaveProfile}
              >
                <Text>{savingProfile ? t('common.saving') : t('common.save')}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default MinePage;
