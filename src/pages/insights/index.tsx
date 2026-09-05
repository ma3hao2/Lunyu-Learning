import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { getProgress, deleteNote } from '@/utils/storage';
import { versesIndex } from '@/data/versesIndex';
import { useI18n, applyTabBarLang, getLang } from '@/i18n';
import type { MyNote } from '@/types';

// 我的笔记（本地笔记列表，去 UGC 后承载原「心得」tab）
const InsightsPage: React.FC = () => {
  const { t } = useI18n();
  const [myNotes, setMyNotes] = useState<MyNote[]>(() => getProgress().myNotes);

  useDidShow(() => {
    // 导航栏标题随语言刷新；tabBar 文案兜底刷新（非 tab 页切语言时被跳过）
    Taro.setNavigationBarTitle({ title: t('notes.title') });
    applyTabBarLang(getLang());
    // 每次进入刷新（写笔记/编辑后返回时同步最新列表）
    setMyNotes(getProgress().myNotes);
  });

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
      title: t('verse.deleteNoteTitle'),
      content: t('verse.deleteNoteContent'),
      confirmColor: '#B8612D',
      success: (res) => {
        if (res.confirm) {
          try {
            deleteNote(note.id);
            Taro.showToast({ title: t('common.deleted'), icon: 'success' });
            setMyNotes(getProgress().myNotes);
          } catch (e: any) {
            Taro.showToast({ title: e?.message || t('common.deleteFailed'), icon: 'none' });
          }
        }
      }
    });
  }, [t]);

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <View className={styles.header}>
        <Text className={styles.title}>{t('notes.title')}</Text>
        <Text className={styles.subtitle}>{t('notes.subtitle')}</Text>
      </View>

      {myNotes.length > 0 ? (
        myNotes.map(note => {
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
                {verse && <Text className={styles.noteSource}>{t('verse.noteFrom', { text: verse.original.substring(0, 12) })}</Text>}
              </View>
              <View className={styles.noteActions}>
                <Text className={styles.noteAction} onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>{t('common.edit')}</Text>
                <Text className={styles.noteActionDelete} onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }}>{t('common.delete')}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View className={styles.emptyNotes}>
          <Text>{t('notes.empty')}</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default InsightsPage;
