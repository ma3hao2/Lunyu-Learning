import { DailyRecommend } from '@/types';

// 每日推荐（按一年中的第几天取模轮换：dayOfYear % dailyRecommends.length）
export const dailyRecommends: DailyRecommend[] = [
  { verseId: 101, reason: '开篇明义，学习的三重境界，值得每日品读。' },
  { verseId: 127, reason: '温故知新，在学习中不断获得新感悟。' },
  { verseId: 272, reason: '三人行必有我师，保持谦逊的学习心态。' },
  { verseId: 183, reason: '见贤思齐，以人为镜可以明得失。' },
  { verseId: 326, reason: '逝者如斯夫，珍惜时光，自强不息。' },
  { verseId: 395, reason: '己所不欲勿施于人，恕道是终身可行的准则。' },
  { verseId: 131, reason: '学思结合，避免迷惘与空想。' },
  { verseId: 240, reason: '以学为乐，达到学习的最高境界。' }
];

// 计算一年中的第几天（1-366，按本地时区）
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// 获取今日推荐
export function getTodayRecommend(): DailyRecommend {
  const today = new Date();
  // 按一年中的第几天取模轮换（分布均匀，跨月不重复，跨年才循环）
  const dayIndex = getDayOfYear(today) % dailyRecommends.length;
  return dailyRecommends[dayIndex];
}
