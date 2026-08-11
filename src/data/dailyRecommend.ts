import { DailyRecommend } from '@/types';

// 每日推荐（按日期取模轮换：dayOfMonth % dailyRecommends.length）
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

// 获取今日推荐
export function getTodayRecommend(): DailyRecommend {
  const today = new Date();
  // 按日期取模轮换
  const dayIndex = today.getDate() % dailyRecommends.length;
  return dailyRecommends[dayIndex];
}
