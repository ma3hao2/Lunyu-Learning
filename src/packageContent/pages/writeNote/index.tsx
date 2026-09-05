import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Textarea, Input } from '@tarojs/components';
import type { TextareaProps, BaseEventOrig } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import BackHeader from '@/components/BackHeader';
import { loadVerse, versesIndex } from '@/data/versesLoader';
import type { Verse } from '@/types';
import { addNote, updateNote, getNoteById } from '@/utils/storage';
import { getSettings, type FontSize } from '@/utils/settings';
import { useI18n } from '@/i18n';

const WriteNotePage: React.FC = () => {
  const router = useRouter();
  const { t } = useI18n();
  // verseId 归一化：非法参数（如 abc）会得 NaN，导致笔记归属错乱，统一回退到第一篇（101）
  const [verseId, setVerseId] = useState(() => {
    const id = Number(router.params.verseId || '101');
    return Number.isInteger(id) && id > 0 ? id : 101;
  });
  // noteId 归一化（云端审查 B5 修复）：非法参数（abc → NaN、0、负数、小数）一律回退为
  // 新建态，避免 NaN 进入编辑态导致空编辑框 + 提交报「笔记不存在」
  const rawNoteId = router.params.noteId ? Number(router.params.noteId) : NaN;
  const noteId = Number.isInteger(rawNoteId) && rawNoteId > 0 ? rawNoteId : null;
  const isEditing = noteId !== null;

  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
          }
        }
        // 加载章句原文
        let v = await loadVerse(verseId);
        if (!v && versesIndex.length > 0) {
          // 同步修正 verseId，避免提交时笔记归属错乱（显示第一篇但 verseId 存旧值）
          setVerseId(versesIndex[0].id);
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
            title: t('common.loadFailed'),
            icon: 'none',
            duration: 2000
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [verseId, noteId, isEditing]);

  // 常用标签快捷选择（点击即选/取消），用户也可通过输入框添加自定义标签（标签随界面语言展示）
  const presetTags = [t('note.tagSelfCultivation'), t('note.tagLearning'), t('note.tagConduct'), t('note.tagEducation'), t('note.tagManagement')];
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
      Taro.showToast({ title: t('note.tagMaxLen'), icon: 'none' });
      return;
    }
    if (selectedTags.includes(tag)) {
      setTagInput('');
      return;
    }
    if (selectedTags.length >= 5) {
      Taro.showToast({ title: t('note.tagMaxCount'), icon: 'none' });
      return;
    }
    setSelectedTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const handleSubmit = async () => {
    // 从 ref 取最新内容，避免 state 未刷新
    const text = contentRef.current.trim();
    if (!text) {
      Taro.showToast({ title: t('note.emptyContent'), icon: 'none' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    // 本地保存（笔记仅存本机，登录与否均可写）
    try {
      if (isEditing && noteId !== null) {
        updateNote(noteId, text, selectedTags);
      } else {
        addNote(verseId, text, selectedTags);
      }
    } catch (e: any) {
      console.error('[WriteNote] 本地保存失败:', e);
      Taro.showToast({
        title: e?.message || t('note.saveFailed'),
        icon: 'none',
        duration: 2000
      });
      setSubmitting(false);
      return;
    }

    Taro.showToast({
      title: isEditing ? t('note.updated') : t('note.saved'),
      icon: 'success'
    });

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
      <BackHeader title={t('note.title')} />
      {/* 原文引用 */}
      <View className={styles.quoteCard}>
        <Text className={styles.quoteLabel}>{t('note.quoteLabel')}</Text>
        {loading || !verse ? (
          <Text className={styles.quoteText}>{t('app.loading')}</Text>
        ) : (
          <Text className={styles.quoteText}>{verse.original}</Text>
        )}
      </View>

      {/* 编辑区 */}
      <View className={styles.editorCard}>
        <Text className={styles.editorTitle}>{isEditing ? t('note.editTitle') : t('note.editorTitle')}</Text>
        <Textarea
          className={styles.textarea}
          placeholder={t('note.placeholder')}
          value={content}
          onInput={handleContentInput}
          maxlength={500}
          autoHeight
        />
        <Text className={styles.charCount}>{content.length}/500</Text>
      </View>

      {/* 标签选择 */}
      <View className={styles.tagSection}>
        <Text className={styles.tagLabel}>{t('note.tagLabel')}</Text>
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
            placeholder={t('note.tagCustomPlaceholder')}
            value={tagInput}
            maxlength={8}
            onInput={(e) => setTagInput(e.detail.value)}
            onConfirm={handleAddTag}
            confirmType="done"
          />
          <Text className={styles.tagAddBtn} onClick={handleAddTag}>{t('note.tagAdd')}</Text>
        </View>
      </View>

      {/* 提交按钮 */}
      <View className={styles.submitBtn} onClick={handleSubmit}>
        <Text className={styles.submitBtnText}>
          {submitting ? t('common.saving') : isEditing ? t('note.updateBtn') : t('note.saveBtn')}
        </Text>
      </View>
    </View>
  );
};

export default WriteNotePage;
