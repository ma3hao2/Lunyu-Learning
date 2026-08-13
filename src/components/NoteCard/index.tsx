import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import { PublishedNote } from '@/types';
import styles from './index.module.scss';

interface NoteCardProps {
  note: PublishedNote;
  onLike: (noteId: string) => void;
  onClick?: (noteId: string) => void;
}

// 社区公开心得卡片
const NoteCard: React.FC<NoteCardProps> = ({ note, onLike, onClick }) => {
  return (
    <View className={styles.card} onClick={() => onClick?.(note.id)}>
      <View className={styles.header}>
        <View className={styles.authorInfo}>
          <Text className={styles.author}>{note.authorName}</Text>
          <Text className={styles.time}>{note.createTime.slice(0, 10)}</Text>
        </View>
        <View
          className={classnames(styles.likeBtn, note.likedByMe && styles.liked)}
          onClick={(e) => {
            e.stopPropagation();
            onLike(note.id);
          }}
        >
          <Text className={styles.likeIcon}>{note.likedByMe ? '♥' : '♡'}</Text>
          <Text className={styles.likeCount}>{note.likeCount}</Text>
        </View>
      </View>
      <Text className={styles.content} selectable>{note.content}</Text>
      {(note.tags || []).length > 0 && (
        <View className={styles.tagRow}>
          {(note.tags || []).map((tag, idx) => (
            <Text key={`${tag}-${idx}`} className={styles.tag}>{tag}</Text>
          ))}
        </View>
      )}
      {(note.chapterTitle || note.verseOriginal) && (
        <View className={styles.source}>
          <Text className={styles.sourceText} selectable>
            {note.chapterTitle ? `${note.chapterTitle} · ` : ''}{note.verseOriginal.slice(0, 20)}...
          </Text>
        </View>
      )}
    </View>
  );
};

export default NoteCard;
