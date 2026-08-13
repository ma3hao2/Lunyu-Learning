import type { Verse } from '@/types';
import { versesIndex, type VerseIndex } from './versesIndex';
import { VERSES_BLOB_B64 } from './versesData.compressed';
import { base64ToBytes, inflateRaw, utf8Decode } from '@/utils/inflate';

// 全量章句数据：懒解压（首次调用时解码一次，之后命中缓存）
// 背景：20 个篇章 TS 编译后 ~2.9MB 撑爆分包上限，改为构建时 deflate 压缩（~0.8MB），
// 运行时用 src/utils/inflate.ts 解压（纯 JS 极简实现，首解压仅一次）
let fullData: Verse[] | null = null;
// 单条查询索引（id → verse）
let verseMap: Map<number, Verse> | null = null;
// 篇章缓存（保持 loadChapter 的"同一篇章二次加载返回同一引用"语义）
const chapterCache = new Map<number, Verse[]>();

/** 解压并解析全量章句数据（首次调用执行） */
function getFullData(): Verse[] {
  if (!fullData) {
    const bytes = base64ToBytes(VERSES_BLOB_B64);
    const json = utf8Decode(inflateRaw(bytes));
    const data = JSON.parse(json) as { verses: Verse[] };
    fullData = data.verses;
  }
  return fullData;
}

// 异步加载某篇完整数据（保持异步签名，调用方无需改动）
export async function loadChapter(chapterId: number): Promise<Verse[]> {
  if (chapterCache.has(chapterId)) {
    return chapterCache.get(chapterId)!;
  }
  const verses = getFullData().filter(v => v.chapterId === chapterId);
  chapterCache.set(chapterId, verses);
  return verses;
}

// 异步加载单条经文
export async function loadVerse(verseId: number): Promise<Verse | null> {
  if (!verseMap) {
    const map = new Map<number, Verse>();
    for (const v of getFullData()) {
      map.set(v.id, v);
    }
    verseMap = map;
  }
  return verseMap.get(verseId) || null;
}

// 异步加载全部篇章完整数据（用于深度搜索 commentary），利用缓存
export async function loadAllVerses(): Promise<Verse[]> {
  return getFullData();
}

// 轻量索引（同步，用于列表和搜索）
export { versesIndex };
export type { VerseIndex };
