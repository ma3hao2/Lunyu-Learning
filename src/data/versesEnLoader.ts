import type { VerseEn } from '@/types';
import { versesIndex } from './versesIndex';
import { VERSES_EN_BLOB_B64 } from './versesEnData.compressed';
import { base64ToBytes, inflateRaw, utf8Decode } from '@/utils/inflate';

// 英文章句数据：懒解压（英文模式首次取值时解码一次，之后命中缓存）
// 落位说明：中文 851KB blob 保持在分包（versesLoader），英文 316KB blob 随主包——
// 首页（主包）在英文模式下需即时展示每日推荐/续读/经典名句的英文译文，跨包异步加载不可行；
// 英文模式外不解压不占内存。英文数据与中文按 id 对齐（id 照抄中文源），chapterId 由中文 versesIndex 提供。
let fullData: VerseEn[] | null = null;
// 单条查询索引（id → verseEn）
let verseMap: Map<number, VerseEn> | null = null;
// 篇章缓存（与 loadChapter 语义对齐：同一篇章二次加载返回同一引用）
const chapterCache = new Map<number, VerseEn[]>();
// 篇章归属（id → chapterId，来自中文轻量索引，主包已有无重复体积）
const chapterIdMap = new Map(versesIndex.map(v => [v.id, v.chapterId]));

/** 解压并解析全量英文章句（首次调用执行） */
function getFullData(): VerseEn[] {
  if (!fullData) {
    const bytes = base64ToBytes(VERSES_EN_BLOB_B64);
    const json = utf8Decode(inflateRaw(bytes));
    const data = JSON.parse(json) as { versesEn: VerseEn[] };
    fullData = data.versesEn;
  }
  return fullData;
}

// 异步加载某篇英文数据（保持异步签名，调用方无需改动）
export async function loadChapterEn(chapterId: number): Promise<VerseEn[]> {
  if (chapterCache.has(chapterId)) {
    return chapterCache.get(chapterId)!;
  }
  const verses = getFullData().filter(v => chapterIdMap.get(v.id) === chapterId);
  chapterCache.set(chapterId, verses);
  return verses;
}

// 异步加载单条英文经文
export async function loadVerseEn(verseId: number): Promise<VerseEn | null> {
  if (!verseMap) {
    const map = new Map<number, VerseEn>();
    for (const v of getFullData()) {
      map.set(v.id, v);
    }
    verseMap = map;
  }
  return verseMap.get(verseId) || null;
}

// 异步加载全部英文数据（用于深度搜索英文注释），利用缓存
export async function loadAllVersesEn(): Promise<VerseEn[]> {
  return getFullData();
}
