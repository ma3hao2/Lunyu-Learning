import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import NoteCard from '@/components/NoteCard';
import { loadVerse, versesIndex } from '@/data/versesLoader';
import type { Verse, MyNote, PublishedNote } from '@/types';
import { chapters } from '@/data/chapters';
import { useProgress } from '@/hooks/useProgress';
import { getProgress, deleteNote, togglePublishedNoteLike } from '@/utils/storage';
import { unpublishNote, fetchPublishedNotes, likePublishedNote, unlikePublishedNote, isLoggedIn } from '@/services/auth';
import { getSettings, type FontSize } from '@/utils/settings';

// 将文本中的换行符（支持 \n 字面量和真实换行）拆分为行数组渲染
function renderLines(text: string) {
  if (!text) return null;
  const lines = text.replace(/\\n/g, '\n').split('\n');
  return lines.map((line, i) => (
    <Text key={i} selectable style={{ display: 'block' }}>
      {line || '\u00A0'}
    </Text>
  ));
}

const VerseDetailPage: React.FC = () => {
  const router = useRouter();
  const verseId = Number(router.params.id || '101');
  const { isRead, markRead } = useProgress();

  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [myNotes, setMyNotes] = useState<MyNote[]>([]);
  const [fontSize, setFontSize] = useState<FontSize>(() => getSettings().fontSize);

  // 刷新笔记列表
  const refreshNotes = useCallback(() => {
    const progress = getProgress();
    setMyNotes(progress.myNotes.filter(n => n.verseId === verseId));
  }, [verseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let v = await loadVerse(verseId);
        if (!v && versesIndex.length > 0) {
          v = await loadVerse(versesIndex[0].id);
        }
        if (!cancelled) {
          setVerse(v);
          setLoading(false);
          // 章句加载完成后也刷新一次笔记
          refreshNotes();
        }
      } catch (error) {
        console.error('[VerseDetail] Load verse failed:', error);
        if (!cancelled) {
          setLoading(false);
          Taro.showToast({
            title: '加载失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [verseId, refreshNotes]);

  const chapter = useMemo(() => {
    if (!verse) return null;
    return chapters.find(c => c.id === verse.chapterId);
  }, [verse]);

  // 该章句的公开心得（从云端拉取）
  const [relatedNotes, setRelatedNotes] = useState<PublishedNote[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  const loadRelatedNotes = useCallback(async () => {
    try {
      const { list } = await fetchPublishedNotes({ verseId, limit: 50 });
      setRelatedNotes(list);
    } catch (e) {
      console.warn('[VerseDetail] 加载相关心得失败:', e);
    } finally {
      setRelatedLoading(false);
    }
  }, [verseId]);

  useDidShow(() => {
    refreshNotes();
    loadRelatedNotes();
    setFontSize(getSettings().fontSize);
  });

  const handleMarkRead = useCallback(() => {
    // 用点击前的已读状态决定文案（markRead 对已读章句是幂等操作，不会重复标记）
    const wasRead = isRead(verseId);
    markRead(verseId);
    Taro.showToast({
      title: wasRead ? '已读过啦' : '已标记为已读',
      icon: 'success',
      duration: 1500
    });
  }, [verseId, isRead, markRead]);

  // 上一句 / 下一句（versesIndex 为全局排序，跨篇章自然衔接）
  const verseIdx = useMemo(() => versesIndex.findIndex(v => v.id === verseId), [verseId]);
  const prevVerseId = verseIdx > 0 ? versesIndex[verseIdx - 1].id : null;
  const nextVerseId = verseIdx >= 0 && verseIdx < versesIndex.length - 1
    ? versesIndex[verseIdx + 1].id
    : null;

  const goPrevVerse = useCallback(() => {
    if (prevVerseId === null) return;
    Taro.redirectTo({ url: `/packageContent/pages/verseDetail/index?id=${prevVerseId}` });
  }, [prevVerseId]);

  const goNextVerse = useCallback(() => {
    if (nextVerseId === null) return;
    Taro.redirectTo({ url: `/packageContent/pages/verseDetail/index?id=${nextVerseId}` });
  }, [nextVerseId]);

  // 跳转到所属篇章
  const goChapter = useCallback(() => {
    if (!verse) return;
    Taro.navigateTo({ url: `/packageContent/pages/chapterDetail/index?id=${verse.chapterId}` });
  }, [verse]);

  const handleWriteNote = useCallback(() => {
    Taro.navigateTo({ url: `/packageContent/pages/writeNote/index?verseId=${verseId}` });
  }, [verseId]);

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
            // 已发布到社区的笔记：同步删除云端文档
            if (note.cloudNoteId) {
              unpublishNote(note.cloudNoteId).catch(e => {
                console.warn('[VerseDetail] 云端删除失败（本地已删除）:', e);
                Taro.showToast({ title: '本地已删除，云端删除失败', icon: 'none' });
              });
            }
            Taro.showToast({ title: '已删除', icon: 'success' });
            refreshNotes();
          } catch (e: any) {
            Taro.showToast({ title: e?.message || '删除失败', icon: 'none' });
          }
        }
      }
    });
  }, [refreshNotes]);

  // 点赞/取消点赞公开心得（云端联动 + 本地记录）
  const handleLike = useCallback(async (noteId: string) => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const { liked } = togglePublishedNoteLike(noteId);
    // 乐观更新
    setRelatedNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, likedByMe: liked, likeCount: n.likeCount + (liked ? 1 : -1) }
        : n
    ));
    try {
      if (liked) {
        await likePublishedNote(noteId);
      } else {
        await unlikePublishedNote(noteId);
      }
    } catch (e) {
      console.warn('[VerseDetail] 点赞同步失败:', e);
      setRelatedNotes(prev => prev.map(n =>
        n.id === noteId
          ? { ...n, likedByMe: !liked, likeCount: n.likeCount + (liked ? -1 : 1) }
          : n
      ));
      Taro.showToast({ title: '点赞失败，请重试', icon: 'none' });
    }
  }, []);

  const handleInsightClick = useCallback((_noteId: string) => {
    // 相关心得即当前章句的公开心得，点击无需跳转（避免同页自引用堆叠页面栈）
  }, []);

  if (loading || !verse) {
    return (
      <ScrollView
        className={classnames(styles.container, fontSize === 'large' && styles.fontLarge, fontSize === 'xl' && styles.fontXl)}
        scrollY
        enhanced
        bounces
      >
        <View className={styles.originalCard}>
          <Text className={styles.originalText}>加载中...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className={classnames(styles.container, fontSize === 'large' && styles.fontLarge, fontSize === 'xl' && styles.fontXl)}
      scrollY
      enhanced
      bounces
    >
      {/* 原文卡片 */}
      <View className={styles.originalCard}>
        {chapter && (
          <Text className={styles.chapterTag} onClick={goChapter}>
            {chapter.title} · 第{verse.order}章 ›
          </Text>
        )}
        <Text className={styles.originalText} selectable>{verse.original}</Text>
        <Text className={styles.keyPointText} selectable>核心要点：{verse.keyPoint}</Text>
      </View>

      {/* 译文 */}
      <View className={styles.sectionCard}>
        <View className={styles.sectionTitle}>
          <View className={styles.sectionTitleIcon} />
          <Text className={styles.sectionTitleText}>白话译文</Text>
        </View>
        <View className={styles.sectionContent}>{renderLines(verse.translation)}</View>
      </View>

      {/* 注释解读 */}
      <View className={styles.sectionCard}>
        <View className={styles.sectionTitle}>
          <View className={styles.sectionTitleIcon} />
          <Text className={styles.sectionTitleText}>注释解读</Text>
        </View>
        <View className={styles.sectionContent}>{renderLines(verse.commentary)}</View>
      </View>

      {/* 操作栏 */}
      <View className={styles.actionBar}>
        <View
          className={classnames(styles.actionBtn, styles.actionBtnRead, isRead(verseId) && styles.read)}
          onClick={handleMarkRead}
        >
          <Text>{isRead(verseId) ? '已读 ✓' : '标记已读'}</Text>
        </View>
        <View
          className={classnames(styles.actionBtn, styles.actionBtnSecondary)}
          onClick={handleWriteNote}
        >
          <Text>写心得</Text>
        </View>
      </View>

      {/* 上一句 / 下一句 */}
      <View className={styles.navBar}>
        <View
          className={classnames(styles.navBtn, prevVerseId === null && styles.navBtnDisabled)}
          onClick={goPrevVerse}
        >
          <Text>‹ 上一句</Text>
        </View>
        <View
          className={classnames(styles.navBtn, nextVerseId === null && styles.navBtnDisabled)}
          onClick={goNextVerse}
        >
          <Text>下一句 ›</Text>
        </View>
      </View>

      {/* 内容来源 */}
      <View className={styles.sourceBar}>
        <Text className={styles.sourceText}>内容来源：和合文化屋公众号</Text>
      </View>

      {/* 我的笔记 */}
      <View className={styles.insightSection}>
        <View className={styles.insightSectionTitle}>
          <Text className={styles.insightSectionText}>我的笔记</Text>
          <Text className={styles.insightSectionCount}>共{myNotes.length}条</Text>
        </View>
        {myNotes.length > 0 ? (
          myNotes.map(note => (
            <View key={note.id} className={styles.myNoteCard}>
              <Text className={styles.myNoteContent} selectable>{note.content}</Text>
              {note.tags && note.tags.length > 0 && (
                <View className={styles.myNoteTags}>
                  {note.tags.map((tag, idx) => (
                    <Text key={`${tag}-${idx}`} className={styles.myNoteTag}>{tag}</Text>
                  ))}
                </View>
              )}
              <View className={styles.myNoteFooter}>
                <Text className={styles.myNoteTime}>{note.createTime}</Text>
                <View className={styles.myNoteActions}>
                  <Text className={styles.myNoteAction} onClick={() => handleEditNote(note)}>编辑</Text>
                  <Text className={styles.myNoteActionDelete} onClick={() => handleDeleteNote(note)}>删除</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className={styles.emptyTip}>
            <Text>还没有笔记，点击上方"写心得"记录你的感悟</Text>
          </View>
        )}
      </View>

      {/* 相关心得（云端公开心得） */}
      <View className={styles.insightSection}>
        <View className={styles.insightSectionTitle}>
          <Text className={styles.insightSectionText}>学习心得</Text>
          <Text className={styles.insightSectionCount}>共{relatedNotes.length}条</Text>
        </View>
        {relatedLoading ? (
          <View className={styles.emptyTip}>
            <Text>加载中...</Text>
          </View>
        ) : relatedNotes.length > 0 ? (
          relatedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onLike={handleLike}
              onClick={handleInsightClick}
            />
          ))
        ) : (
          <View className={styles.emptyTip}>
            <Text>暂无心得，快来分享第一条吧</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default VerseDetailPage;
