import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Image, Button, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import ProgressBar from '@/components/ProgressBar';
import { getProgress, deleteNote, setNotePublic, setNotePrivate } from '@/utils/storage';
import { versesIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { getUserInfo, silentLoginAndMerge, logout, updateProfile, unpublishNote, publishNote } from '@/services/auth';
import type { UserInfo, MyNote } from '@/types';

const MinePage: React.FC = () => {
  const [progress, setProgress] = useState(getProgress());
  const [user, setUser] = useState<UserInfo | null>(getUserInfo());
  const [logging, setLogging] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // 资料编辑弹层
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editNickName, setEditNickName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // 打开资料编辑（预填当前昵称/头像）
  const openProfileEditor = () => {
    setEditNickName(user?.nickName && user.nickName !== '论语学习者' ? user.nickName : '');
    setEditAvatarUrl(user?.avatarUrl || '');
    setShowProfileEditor(true);
  };

  // 保存资料（云函数 updateProfile + 本地缓存）
  const handleSaveProfile = async () => {
    const nickName = editNickName.trim() || '论语学习者';
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const u = await updateProfile({ nickName, avatarUrl: editAvatarUrl });
      setUser(u);
      setAvatarFailed(false);
      setShowProfileEditor(false);
      Taro.showToast({ title: '资料已更新', icon: 'success' });
    } catch (e: any) {
      console.error('[Mine] 更新资料失败:', e);
      Taro.showToast({ title: e?.message || '更新失败，请重试', icon: 'none' });
    } finally {
      setSavingProfile(false);
    }
  };

  useDidShow(() => {
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
      const u = await silentLoginAndMerge();
      if (!u) throw new Error('登录失败，请重试');
      setUser(u);
      setProgress(getProgress());
      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (e: any) {
      console.error('[Mine] login failed:', e);
      Taro.showToast({ title: e?.message || '登录失败', icon: 'none' });
    } finally {
      setLogging(false);
    }
  }, [logging]);

  // 退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后本地数据仍会保留，确定退出吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
          setUser(null);
          setProgress(getProgress());
          Taro.showToast({ title: '已退出登录', icon: 'none' });
        }
      }
    });
  }, []);

  const handleNoteClick = (verseId: number) => {
    Taro.navigateTo({ url: `/packageContent/pages/verseDetail/index?id=${verseId}` });
  };

  // 编辑笔记
  const handleEditNote = useCallback((note: MyNote) => {
    Taro.navigateTo({ url: `/packageContent/pages/writeNote/index?verseId=${note.verseId}&noteId=${note.id}` });
  }, []);

  // 删除笔记
  const handleDeleteNote = useCallback((note: MyNote) => {
    Taro.showModal({
      title: '删除笔记',
      content: '确定要删除这条心得吗？删除后不可恢复。',
      confirmColor: '#B8612D',
      success: (res) => {
        if (res.confirm) {
          try {
            deleteNote(note.id);
            // 已发布到社区的笔记：同步删除云端文档，避免"本地删了社区还在"
            if (note.cloudNoteId) {
              unpublishNote(note.cloudNoteId).catch(e => {
                console.warn('[Mine] 云端删除失败（本地已删除）:', e);
                Taro.showToast({ title: '本地已删除，云端删除失败', icon: 'none' });
              });
            }
            Taro.showToast({ title: '已删除', icon: 'success' });
            setProgress(getProgress());
          } catch (e: any) {
            Taro.showToast({ title: e?.message || '删除失败', icon: 'none' });
          }
        }
      }
    });
  }, []);

  // 切换笔记公开状态（云端联动：公开→发布，取消公开→删除云端文档）
  const handleTogglePublic = useCallback((note: MyNote) => {
    if (note.isPublic) {
      // 取消公开
      if (note.cloudNoteId) {
        unpublishNote(note.cloudNoteId)
          .then(() => {
            setNotePrivate(note.id);
            setProgress(getProgress());
            Taro.showToast({ title: '已设为私密', icon: 'success' });
          })
          .catch(e => {
            console.warn('[Mine] 取消公开失败:', e);
            Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
      }
    } else {
      // 转为公开
      const verse = versesIndex.find(v => v.id === note.verseId);
      if (!verse) {
        Taro.showToast({ title: '关联章句不存在', icon: 'none' });
        return;
      }
      const chapter = chapters.find(c => c.id === verse.chapterId);
      publishNote({
        verseId: note.verseId,
        verseOriginal: verse.original,
        chapterTitle: chapter?.title || '',
        content: note.content,
        tags: note.tags || []
      })
        .then(cloudNoteId => {
          setNotePublic(note.id, cloudNoteId);
          setProgress(getProgress());
          Taro.showToast({ title: '已公开发布', icon: 'success' });
        })
        .catch(e => {
          console.warn('[Mine] 公开发布失败:', e);
          Taro.showToast({ title: '发布失败，请检查网络', icon: 'none' });
        });
    }
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
              <Text className={styles.userName}>{user.nickName || '论语学习者'}</Text>
              <Text className={styles.userDesc} onClick={openProfileEditor}>学而时习之，不亦说乎 · 编辑资料 ›</Text>
            </View>
            <View className={styles.logoutBtn} onClick={handleLogout}>
              <Text className={styles.logoutText}>退出</Text>
            </View>
          </View>
        ) : (
          <View className={styles.loginArea} onClick={handleLogin}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>学</Text>
            </View>
            <View className={styles.userMeta}>
              <Text className={styles.userName}>
                {logging ? '登录中...' : '点击登录'}
              </Text>
              <Text className={styles.userDesc}>登录后同步学习进度到云端</Text>
            </View>
            <View className={styles.loginBtn}>
              <Text className={styles.loginBtnText}>登录 ›</Text>
            </View>
          </View>
        )}
      </View>

      {/* 统计数据 */}
      <View className={styles.statsCard}>
        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount}</Text>
            <Text className={styles.statLabel}>已读章句</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readChapterIds.size}</Text>
            <Text className={styles.statLabel}>已读篇目</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{readCount === 0 ? 0 : totalReadDays}</Text>
            <Text className={styles.statLabel}>连续学习</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{progress.myNotes.length}</Text>
            <Text className={styles.statLabel}>我的笔记</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{progress.likedNoteIds?.length || 0}</Text>
            <Text className={styles.statLabel}>点赞心得</Text>
          </View>
        </View>
      </View>

      {/* 学习进度 */}
      <View className={styles.progressSection}>
        <Text className={styles.progressTitle}>学习总进度</Text>
        <ProgressBar current={readCount} total={totalVerses} label="论语二十篇" />
      </View>

      {/* 我的笔记 */}
      <View className={styles.notesSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>我的笔记</Text>
          <Text className={styles.sectionCount}>共{progress.myNotes.length}条</Text>
        </View>
        {progress.myNotes.length > 0 ? (
          <>
            {(showAllNotes ? progress.myNotes : progress.myNotes.slice(0, 5)).map(note => {
              const verse = versesIndex.find(v => v.id === note.verseId);
              return (
                <View
                  key={note.id}
                  className={styles.noteCard}
                  onClick={() => handleNoteClick(note.verseId)}
                >
                  <Text className={styles.noteContent}>{note.content}</Text>
                  {note.tags && note.tags.length > 0 && (
                    <View className={styles.noteTags}>
                      {note.tags.map((tag, idx) => (
                        <Text key={`${tag}-${idx}`} className={styles.noteTag}>{tag}</Text>
                      ))}
                    </View>
                  )}
                  <View className={styles.noteFooter}>
                    <Text className={styles.noteTime}>{note.createTime}</Text>
                    {note.isPublic && <Text className={styles.notePublicBadge}>公开</Text>}
                    {verse && <Text className={styles.noteSource}>出自：{verse.original.substring(0, 12)}...</Text>}
                  </View>
                  <View className={styles.noteActions}>
                    <Text className={styles.noteAction} onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>编辑</Text>
                    <Text
                      className={classnames(styles.noteAction, note.isPublic && styles.noteActionPublic)}
                      onClick={(e) => { e.stopPropagation(); handleTogglePublic(note); }}
                    >
                      {note.isPublic ? '取消公开' : '公开'}
                    </Text>
                    <Text className={styles.noteActionDelete} onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }}>删除</Text>
                  </View>
                </View>
              );
            })}
            {progress.myNotes.length > 5 && (
              <Text className={styles.noteMore} onClick={() => setShowAllNotes(v => !v)}>
                {showAllNotes ? '收起笔记' : `查看全部 ${progress.myNotes.length} 条笔记`}
              </Text>
            )}
          </>
        ) : (
          <View className={styles.emptyNotes}>
            <Text>还没有笔记，去学习后写第一条心得吧</Text>
          </View>
        )}
      </View>

      {/* 功能菜单 */}
      <View className={styles.menuSection}>
        <View className={styles.menuItem} onClick={() => handleMenuClick('continue')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>读</Text>
          </View>
          <Text className={styles.menuText}>继续阅读</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => handleMenuClick('insights')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>悟</Text>
          </View>
          <Text className={styles.menuText}>浏览心得</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => handleMenuClick('settings')}>
          <View className={styles.menuIcon}>
            <Text className={styles.menuIconText}>置</Text>
          </View>
          <Text className={styles.menuText}>设置</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 资料编辑弹层（头像昵称填写能力：chooseAvatar 按钮 + nickname 输入框） */}
      {showProfileEditor && (
        <View className={styles.profileMask} onClick={() => setShowProfileEditor(false)}>
          <View className={styles.profilePanel} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.profileTitle}>编辑资料</Text>

            {/* 头像选择：微信头像昵称填写能力 */}
            <Button
              className={styles.avatarPicker}
              openType="chooseAvatar"
              onChooseAvatar={(e) => setEditAvatarUrl(e.detail.avatarUrl)}
            >
              {editAvatarUrl ? (
                <Image className={styles.avatarPickerImg} src={editAvatarUrl} mode="aspectFill" />
              ) : (
                <Text className={styles.avatarPickerText}>选择头像</Text>
              )}
            </Button>

            {/* 昵称输入：微信昵称联想输入 */}
            <Input
              className={styles.nicknameInput}
              type="nickname"
              placeholder="输入昵称（可联想微信昵称）"
              value={editNickName}
              maxlength={20}
              onInput={(e) => setEditNickName(e.detail.value)}
            />

            <View className={styles.profileActions}>
              <View className={styles.profileCancel} onClick={() => setShowProfileEditor(false)}>
                <Text>取消</Text>
              </View>
              <View
                className={classnames(styles.profileSave, savingProfile && styles.profileSaveDisabled)}
                onClick={handleSaveProfile}
              >
                <Text>{savingProfile ? '保存中...' : '保存'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default MinePage;
