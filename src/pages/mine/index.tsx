import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import ProgressBar from '@/components/ProgressBar';
import { getProgress, saveProgress, mergeProgress, hasProgressData, clearAnonymousProgress, deleteNote, setNotePublic, setNotePrivate } from '@/utils/storage';
import { versesIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { getUserInfo, isLoggedIn, wxLogin, logout, downloadProgress, uploadProgress, unpublishNote, publishNote } from '@/services/auth';
import type { UserInfo, MyNote } from '@/types';

const MinePage: React.FC = () => {
  const [progress, setProgress] = useState(getProgress());
  const [user, setUser] = useState<UserInfo | null>(getUserInfo());
  const [logging, setLogging] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  useDidShow(() => {
    setProgress(getProgress());
    setUser(getUserInfo());
  });

  const readCount = progress.readVerseIds.length;
  const totalReadDays = progress.totalReadDays || 1;
  const totalVerses = useMemo(() => chapters.reduce((sum, c) => sum + c.verseCount, 0), []);

  const readChapterIds = useMemo(() => {
    return new Set(
      versesIndex.filter(v => progress.readVerseIds.includes(v.id)).map(v => v.chapterId)
    );
  }, [progress]);

  const loggedIn = isLoggedIn();

  // 微信一键登录
  const handleLogin = useCallback(async () => {
    if (logging) return;
    setLogging(true);
    try {
      // 登录前捕获未登录期间的本地进度（匿名 key：lunyu_progress）
      const localBeforeLogin = getProgress();
      const hasLocal = hasProgressData(localBeforeLogin);

      const u = await wxLogin();
      setUser(u);
      Taro.showToast({ title: '登录成功', icon: 'success' });

      // 登录后 getProgress 已切换为用户专属 key，读取上次登录期间未同步到云端的本地进度
      const userLocalProgress = getProgress();
      const hasUserLocal = hasProgressData(userLocalProgress);

      // 拉取云端数据
      const res = await downloadProgress();
      const cloudProgress = (res.success && res.data) ? res.data : null;

      // 三路合并：匿名进度 + 用户key本地进度 + 云端进度（取并集，避免任一端数据丢失）
      let merged = localBeforeLogin;
      if (userLocalProgress && hasUserLocal) {
        merged = mergeProgress(merged, userLocalProgress);
      }
      if (cloudProgress) {
        merged = mergeProgress(merged, cloudProgress);
      }

      // 合并结果写入用户专属 key
      if (hasLocal || hasUserLocal || cloudProgress) {
        saveProgress(merged);
        setProgress(getProgress());
      }
      // 有任何本地数据时：上传合并结果到云端，并清理匿名 key
      if (hasLocal || hasUserLocal) {
        await uploadProgress(merged);
        if (hasLocal) clearAnonymousProgress();
      }
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
    if (type === 'classics') {
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
              {user.avatarUrl ? (
                <Image className={styles.avatarImg} src={user.avatarUrl} mode="aspectFill" />
              ) : (
                <Text className={styles.avatarText}>
                  {(user.nickName || '学').charAt(0)}
                </Text>
              )}
            </View>
            <View className={styles.userMeta}>
              <Text className={styles.userName}>{user.nickName || '论语学习者'}</Text>
              <Text className={styles.userDesc}>学而时习之，不亦说乎</Text>
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
                        <Text key={idx} className={styles.noteTag}>{tag}</Text>
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
        <View className={styles.menuItem} onClick={() => handleMenuClick('classics')}>
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
    </ScrollView>
  );
};

export default MinePage;
