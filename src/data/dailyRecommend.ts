import { DailyRecommend, Chapter } from '@/types';
import { chapters } from '@/data/chapters';
import { versesIndex, type VerseIndex } from '@/data/versesIndex';

// 主题内章句列表缓存（每篇句数固定，避免换一批高频 filter 重复扫描 O(509)）
const chapterVersesCache = new Map<number, VerseIndex[]>();

function getChapterVerses(chapterId: number): VerseIndex[] {
  let verses = chapterVersesCache.get(chapterId);
  if (!verses) {
    verses = versesIndex.filter(v => v.chapterId === chapterId);
    chapterVersesCache.set(chapterId, verses);
  }
  return verses;
}

// 计算一年中的第几天（0-365，按本地时区；1月1日为第0天）。
// 修复 off-by-one：原实现 new Date(y, 0, 0) 使第0天落在去年12-31，导致 dailyRecommends[0] 全年不被推荐
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// 方案 E：按主题（篇章）轮换——20 篇 20 天一轮，每天主题不同，用户顺着二十篇走
function getTodayChapter(date: Date): Chapter {
  const themeIndex = getDayOfYear(date) % chapters.length;
  return chapters[themeIndex];
}

// 主题内确定性选句：同一天所有用户看到同一句（可分享、可运营）；
// 种子含年份，跨年同月同日句子不同；相邻天主题不同天然不重复
function pickVerseByDate(chapterId: number, date: Date): VerseIndex {
  const verses = getChapterVerses(chapterId);
  const seed = date.getFullYear() * 1000 + getDayOfYear(date);
  let h = seed;
  h = (h ^ (h >>> 13)) * 0x5bd1e995; // 简单整数混淆，保证相邻天结果跳变
  h = (h ^ (h >>> 15)) >>> 0;
  return verses[h % verses.length];
}

function toDailyRecommend(verse: VerseIndex, chapter: Chapter): DailyRecommend {
  return {
    verseId: verse.id,
    // 推荐理由：keyPoint 在分包完整数据里，主包首页拿不到（会破坏分包体积设计），
    // 首页暂不展示该字段，用轻量索引可得的篇内位置文案填充，预留给未来
    reason: `第 ${verse.order} 句 · 本篇共 ${chapter.verseCount} 句`,
    theme: chapter.theme,
    chapterTitle: chapter.title,
    chapterId: chapter.id
  };
}

// 获取今日推荐（date 可选参数仅供测试注入固定日期，默认今天）
export function getTodayRecommend(date?: Date): DailyRecommend {
  const today = date || new Date();
  const chapter = getTodayChapter(today);
  return toDailyRecommend(pickVerseByDate(chapter.id, today), chapter);
}

// 换一批：保持今日主题不变，同篇章内换一句（用户主动行为，允许随机）
export function getAlternativeRecommend(chapterId: number, excludeVerseId?: number): DailyRecommend {
  const all = getChapterVerses(chapterId);
  const pool = all.filter(v => v.id !== excludeVerseId);
  const candidates = pool.length > 0 ? pool : all; // 篇内仅 1 句时回退全池
  const verse = candidates[Math.floor(Math.random() * candidates.length)];
  const chapter = chapters.find(c => c.id === chapterId);
  // 非法 chapterId 兜底（防御）：回退今日推荐
  if (!verse || !chapter) return getTodayRecommend();
  return toDailyRecommend(verse, chapter);
}
