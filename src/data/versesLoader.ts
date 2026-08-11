import { Verse } from '@/types';
import { versesIndex, VerseIndex } from './versesIndex';
import { chapters } from './chapters';

// 缓存已加载的篇章数据
const chapterCache = new Map<number, Verse[]>();
// 缓存全量合并数据（深度搜索每次输入都会调用，避免重复拼装 509 元素数组）
let allVersesCache: Verse[] | null = null;

// 异步加载某篇完整数据
export async function loadChapter(chapterId: number): Promise<Verse[]> {
  if (chapterCache.has(chapterId)) {
    return chapterCache.get(chapterId)!;
  }
  let module: any;
  switch (chapterId) {
    case 1: module = await import('./verses/chapter1'); break;
    case 2: module = await import('./verses/chapter2'); break;
    case 3: module = await import('./verses/chapter3'); break;
    case 4: module = await import('./verses/chapter4'); break;
    case 5: module = await import('./verses/chapter5'); break;
    case 6: module = await import('./verses/chapter6'); break;
    case 7: module = await import('./verses/chapter7'); break;
    case 8: module = await import('./verses/chapter8'); break;
    case 9: module = await import('./verses/chapter9'); break;
    case 10: module = await import('./verses/chapter10'); break;
    case 11: module = await import('./verses/chapter11'); break;
    case 12: module = await import('./verses/chapter12'); break;
    case 13: module = await import('./verses/chapter13'); break;
    case 14: module = await import('./verses/chapter14'); break;
    case 15: module = await import('./verses/chapter15'); break;
    case 16: module = await import('./verses/chapter16'); break;
    case 17: module = await import('./verses/chapter17'); break;
    case 18: module = await import('./verses/chapter18'); break;
    case 19: module = await import('./verses/chapter19'); break;
    case 20: module = await import('./verses/chapter20'); break;
    default: return [];
  }
  const verses = module[`chapter${chapterId}Verses`] as Verse[];
  chapterCache.set(chapterId, verses);
  return verses;
}

// 异步加载单条经文
export async function loadVerse(verseId: number): Promise<Verse | null> {
  const index = versesIndex.find(v => v.id === verseId);
  if (!index) return null;
  const verses = await loadChapter(index.chapterId);
  return verses.find(v => v.id === verseId) || null;
}

// 异步加载全部篇章完整数据（用于深度搜索 commentary），利用已有缓存
// 并行加载 20 个篇章（loadChapter 内部有 chapterCache 防重复，并行安全）
export async function loadAllVerses(): Promise<Verse[]> {
  if (allVersesCache) {
    return allVersesCache;
  }
  const results = await Promise.all(chapters.map(ch => loadChapter(ch.id)));
  const all: Verse[] = results.flat();
  allVersesCache = all;
  return all;
}

// 轻量索引（同步，用于列表和搜索）
export { versesIndex };
export type { VerseIndex };
