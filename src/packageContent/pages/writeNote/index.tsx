import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Textarea, Input, Switch } from '@tarojs/components';
import type { TextareaProps, BaseEventOrig } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { loadVerse, versesIndex } from '@/data/versesLoader';
import { chapters } from '@/data/chapters';
import type { Verse } from '@/types';
import { addNote, updateNote, getNoteById, setNotePublic, setNotePrivate } from '@/utils/storage';
import { isLoggedIn, publishNote, unpublishNote, editPublishedNote } from '@/services/auth';
import { getSettings, type FontSize } from '@/utils/settings';

const WriteNotePage: React.FC = () => {
  const router = useRouter();
  const verseId = Number(router.params.verseId || '101');
  const noteId = router.params.noteId ? Number(router.params.noteId) : null;
  const isEditing = noteId !== null;

  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // 是否公开发布到社区
  const [isPublic, setIsPublic] = useState<boolean>(() => getSettings().defaultPublic);
  const [fontSize] = useState<FontSize>(() => getSettings().fontSize);
  // 用 ref 同步保存最新内容，避免 React state 异步更新导致提交时取到旧值
  const contentRef = useRef('');
  const [submitting, setSubmitting] = useState(false);

  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载章句原文 + 编辑模式时加载已有笔记
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 编辑模式：先加载已有笔记内容
        if (isEditing && noteId !== null) {
          const existingNote = getNoteById(noteId);
          if (existingNote && !cancelled) {
            contentRef.current = existingNote.content;
            setContent(existingNote.content);
            setSelectedTags(existingNote.tags || []);
            setIsPublic(!!existingNote.isPublic);
          }
        }
        // 加载章句原文
        let v = await loadVerse(verseId);
        if (!v && versesIndex.length > 0) {
          v = await loadVerse(versesIndex[0].id);
        }
        if (!cancelled) {
          setVerse(v);
          setLoading(false);
        }
      } catch (error) {
        console.error('[WriteNote] Load failed:', error);
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
  }, [verseId, noteId, isEditing]);

  // 常用标签快捷选择（点击即选/取消），用户也可通过输入框添加自定义标签
  const presetTags = ['修身', '学习', '处世', '教育', '管理'];
  const [tagInput, setTagInput] = useState('');

  const handleContentInput = (e: BaseEventOrig<TextareaProps.onInputEventDetail>) => {
    const val = e.detail.value;
    contentRef.current = val;  // ref 即时同步
    setContent(val);           // state 异步更新（驱动重渲染）
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      return [...prev, tag];
    });
  };

  // 添加自定义标签（回车或点击「添加」）
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (tag.length > 8) {
      Taro.showToast({ title: '标签最多8个字', icon: 'none' });
      return;
    }
    if (selectedTags.includes(tag)) {
      setTagInput('');
      return;
    }
    if (selectedTags.length >= 5) {
      Taro.showToast({ title: '最多添加5个标签', icon: 'none' });
      return;
    }
    setSelectedTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const handleSubmit = async () => {
    // 从 ref 取最新内容，避免 state 未刷新
    const text = contentRef.current.trim();
    if (!text) {
      Taro.showToast({ title: '请输入心得内容', icon: 'none' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    // 未登录却勾选了公开发布：提示需先登录
    if (isPublic && !isLoggedIn()) {
      Taro.showToast({ title: '公开发布需先登录', icon: 'none' });
      setSubmitting(false);
      return;
    }

    // 1. 本地保存（必须成功，不因云端失败而回滚）
    let savedNoteId: number;
    try {
      if (isEditing && noteId !== null) {
        updateNote(noteId, text, selectedTags);
        savedNoteId = noteId;
      } else {
        const progress = addNote(verseId, text, selectedTags);
        savedNoteId = progress.myNotes[0].id;
      }
    } catch (e: any) {
      console.error('[WriteNote] 本地保存失败:', e);
      Taro.showToast({
        title: e?.message || '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
      setSubmitting(false);
      return;
    }

    // 2. 云端联动（发布/取消/编辑已发布内容）：失败不阻塞本地保存，仅提示
    let cloudError: string | null = null;
    if (isLoggedIn()) {
      try {
        const existingNote = getNoteById(savedNoteId);
        const cloudNoteId = existingNote?.cloudNoteId;
        if (isPublic) {
          if (cloudNoteId) {
            // 已是公开：更新云端内容
            await editPublishedNote(cloudNoteId, text, selectedTags);
          } else {
            // 新发布：创建云端文档
            const verseInfo = versesIndex.find(v => v.id === verseId);
            const chapterTitle = verseInfo
              ? (chapters.find(c => c.id === verseInfo.chapterId)?.title || '')
              : '';
            const newId = await publishNote({
              verseId,
              verseOriginal: verseInfo?.original || '',
              chapterTitle,
              content: text,
              tags: selectedTags
            });
            setNotePublic(savedNoteId, newId);
          }
        } else if (cloudNoteId) {
          // 取消公开：删除云端文档
          await unpublishNote(cloudNoteId);
          setNotePrivate(savedNoteId);
        }
      } catch (e: any) {
        console.warn('[WriteNote] 云端发布失败（已保存到本地）:', e);
        cloudError = e?.message || '发布失败';
      }
    }

    // 3. 提示：本地已保存成功；云端若失败则透传具体原因（如内容安全检查未通过）
    Taro.showToast({
      title: cloudError
        ? `已保存到本地：${cloudError}`
        : (isEditing ? '更新成功' : '保存成功'),
      icon: cloudError ? 'none' : 'success'
    });

    // 4. 引导（P2-4）：新公开发布成功后询问是否去社区查看
    if (isPublic && !cloudError && !isEditing) {
      setTimeout(() => {
        Taro.showModal({
          title: '发布成功',
          content: '已发布到社区，去看看？',
          confirmText: '去看看',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              Taro.switchTab({ url: '/pages/insights/index' });
            } else if (Taro.getCurrentPages().length > 1) {
              Taro.navigateBack();
            }
          }
        });
      }, 400);
      return;
    }

    setTimeout(() => {
      // 用户可能已手动返回，栈深不足时不重复导航
      if (Taro.getCurrentPages().length > 1) {
        Taro.navigateBack();
      }
    }, 1500);
  };

  return (
    <View
      className={classnames(styles.container, fontSize === 'large' && styles.fontLarge, fontSize === 'xl' && styles.fontXl)}
    >
      {/* 原文引用 */}
      <View className={styles.quoteCard}>
        <Text className={styles.quoteLabel}>引用原文</Text>
        {loading || !verse ? (
          <Text className={styles.quoteText}>加载中...</Text>
        ) : (
          <Text className={styles.quoteText}>{verse.original}</Text>
        )}
      </View>

      {/* 编辑区 */}
      <View className={styles.editorCard}>
        <Text className={styles.editorTitle}>{isEditing ? '编辑心得' : '我的心得'}</Text>
        <Textarea
          className={styles.textarea}
          placeholder="写下你对这段论语的学习感悟..."
          value={content}
          onInput={handleContentInput}
          maxlength={500}
          autoHeight
        />
        <Text className={styles.charCount}>{content.length}/500</Text>
      </View>

      {/* 标签选择 */}
      <View className={styles.tagSection}>
        <Text className={styles.tagLabel}>添加标签（最多5个）</Text>
        {/* 已选标签（可点击删除） */}
        {selectedTags.length > 0 && (
          <View className={styles.tagRow}>
            {selectedTags.map(tag => (
              <View
                key={tag}
                className={classnames(styles.tagItem, styles.active)}
                onClick={() => handleTagToggle(tag)}
              >
                <Text>{tag} ✕</Text>
              </View>
            ))}
          </View>
        )}
        {/* 常用标签快捷选择 */}
        <View className={styles.tagRow}>
          {presetTags.map(tag => (
            <View
              key={tag}
              className={classnames(styles.tagItem, selectedTags.includes(tag) && styles.active)}
              onClick={() => handleTagToggle(tag)}
            >
              <Text>{tag}</Text>
            </View>
          ))}
        </View>
        {/* 自定义标签输入 */}
        <View className={styles.tagInputRow}>
          <Input
            className={styles.tagInput}
            placeholder="自定义标签..."
            value={tagInput}
            maxlength={8}
            onInput={(e) => setTagInput(e.detail.value)}
            onConfirm={handleAddTag}
            confirmType="done"
          />
          <Text className={styles.tagAddBtn} onClick={handleAddTag}>添加</Text>
        </View>
      </View>

      {/* 公开发布开关 */}
      <View className={styles.publishRow}>
        <View className={styles.publishInfo}>
          <Text className={styles.publishLabel}>公开发布到社区</Text>
          <Text className={styles.publishDesc}>其他用户可在"学习心得"中看到并点赞你的心得</Text>
        </View>
        <Switch
          checked={isPublic}
          onChange={(e) => setIsPublic(e.detail.value)}
          color="#B8612D"
        />
      </View>

      {/* 提交按钮 */}
      <View className={styles.submitBtn} onClick={handleSubmit}>
        <Text className={styles.submitBtnText}>
          {submitting ? '保存中...' : isEditing ? '更新心得' : '保存心得'}
        </Text>
      </View>
    </View>
  );
};

export default WriteNotePage;
