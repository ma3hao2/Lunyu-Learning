import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { getProgress, deleteNote } from '@/utils/storage';
import { versesIndex } from '@/data/versesIndex';
import type { MyNote } from '@/types';

// 我的笔记（本地笔记列表，去 UGC 后承载原「心得」tab）
const InsightsPage: React.FC = () => {
  const [myNotes, setMyNotes] = useState<MyNote[]>(() => getProgress().myNotes);

  useDidShow(() => {
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
      title: '删除笔记',
      content: '确定要删除这条笔记吗？删除后不可恢复。',
      confirmColor: '#B8612D',
      success: (res) => {
        if (res.confirm) {
          try {
            deleteNote(note.id);
            Taro.showToast({ title: '已删除', icon: 'success' });
            setMyNotes(getProgress().myNotes);
          } catch (e: any) {
            Taro.showToast({ title: e?.message || '删除失败', icon: 'none' });
          }
        }
      }
    });
  }, []);

  return (
    <ScrollView className={styles.container} scrollY enhanced bounces>
      <View className={styles.header}>
        <Text className={styles.title}>我的笔记</Text>
        <Text className={styles.subtitle}>记录你的学习感悟</Text>
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
                {verse && <Text className={styles.noteSource}>出自：{verse.original.substring(0, 12)}...</Text>}
              </View>
              <View className={styles.noteActions}>
                <Text className={styles.noteAction} onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>编辑</Text>
                <Text className={styles.noteActionDelete} onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }}>删除</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View className={styles.emptyNotes}>
          <Text>还没有笔记，去学习后写第一条笔记吧</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default InsightsPage;
