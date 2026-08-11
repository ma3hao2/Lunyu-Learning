import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDidShow } from '@tarojs/taro';
import { LearningProgress } from '@/types';
import { getProgress, markVerseRead } from '@/utils/storage';

// 学习进度管理 Hook
export function useProgress() {
  const [progress, setProgress] = useState<LearningProgress>(getProgress());

  // 预构建已读 Set，isRead 查表 O(1)，避免每次 includes 全表扫描
  const readSet = useMemo(
    () => new Set(progress.readVerseIds),
    [progress.readVerseIds]
  );

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  // 标记已读
  const handleMarkRead = useCallback((verseId: number) => {
    const newProgress = markVerseRead(verseId);
    setProgress({ ...newProgress });
  }, []);

  // 重新从存储读取最新进度（页面 useDidShow 时调用，避免跨页状态过期）
  const refresh = useCallback(() => {
    setProgress(getProgress());
  }, []);

  // 页面每次展示（含跨页返回）时重新读取存储，避免 isRead 状态过期。
  // 注意：useDidShow 依赖 Taro 页面上下文（PageContext），本 hook 只能用于页面组件，
  // 用在普通子组件时会回退到 App 级 onShow 导致刷新时机不准。
  useDidShow(() => {
    refresh();
  });

  // 检查是否已读（依赖 readSet，Set 仅在 readVerseIds 变化时重建）
  const isRead = useCallback((verseId: number) => {
    return readSet.has(verseId);
  }, [readSet]);

  return {
    progress,
    markRead: handleMarkRead,
    refresh,
    isRead
  };
}
