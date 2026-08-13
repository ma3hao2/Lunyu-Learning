/**
 * 压缩章句数据一致性测试
 *
 * 验证 scripts/compress_verses.cjs 生成的 versesData.compressed.ts：
 * 1. 解压结果与 20 个源文件逐字段完全一致（拦截"改了数据忘了重新生成"）
 * 2. versesLoader 走解压路径后 API 行为不变
 */
import { VERSES_BLOB_B64 } from '@/data/versesData.compressed';
import { base64ToBytes, inflateRaw, utf8Decode } from '@/utils/inflate';
import { loadChapter, loadVerse, loadAllVerses } from '@/data/versesLoader';
import { versesIndex } from '@/data/versesIndex';
import { chapter1Verses } from '@/data/verses/chapter1';
import { chapter2Verses } from '@/data/verses/chapter2';
import { chapter3Verses } from '@/data/verses/chapter3';
import { chapter4Verses } from '@/data/verses/chapter4';
import { chapter5Verses } from '@/data/verses/chapter5';
import { chapter6Verses } from '@/data/verses/chapter6';
import { chapter7Verses } from '@/data/verses/chapter7';
import { chapter8Verses } from '@/data/verses/chapter8';
import { chapter9Verses } from '@/data/verses/chapter9';
import { chapter10Verses } from '@/data/verses/chapter10';
import { chapter11Verses } from '@/data/verses/chapter11';
import { chapter12Verses } from '@/data/verses/chapter12';
import { chapter13Verses } from '@/data/verses/chapter13';
import { chapter14Verses } from '@/data/verses/chapter14';
import { chapter15Verses } from '@/data/verses/chapter15';
import { chapter16Verses } from '@/data/verses/chapter16';
import { chapter17Verses } from '@/data/verses/chapter17';
import { chapter18Verses } from '@/data/verses/chapter18';
import { chapter19Verses } from '@/data/verses/chapter19';
import { chapter20Verses } from '@/data/verses/chapter20';

const sourceVerses = [
  ...chapter1Verses, ...chapter2Verses, ...chapter3Verses, ...chapter4Verses, ...chapter5Verses,
  ...chapter6Verses, ...chapter7Verses, ...chapter8Verses, ...chapter9Verses, ...chapter10Verses,
  ...chapter11Verses, ...chapter12Verses, ...chapter13Verses, ...chapter14Verses, ...chapter15Verses,
  ...chapter16Verses, ...chapter17Verses, ...chapter18Verses, ...chapter19Verses, ...chapter20Verses
];

describe('压缩数据一致性（compress_verses.cjs）', () => {
  test('解压得到 509 条且与源文件逐字段一致', () => {
    const json = utf8Decode(inflateRaw(base64ToBytes(VERSES_BLOB_B64)));
    const data = JSON.parse(json) as { verses: typeof sourceVerses };
    expect(data.verses).toHaveLength(509);
    expect(data.verses).toEqual(sourceVerses);
  });

  test('压缩产物占位合理（base64 长度 < 源数据字节数，否则压缩无意义）', () => {
    const json = JSON.stringify({ verses: sourceVerses });
    expect(VERSES_BLOB_B64.length).toBeLessThan(Buffer.byteLength(json, 'utf8'));
  });
});

describe('versesLoader 走解压路径后 API 不变', () => {
  test('loadAllVerses 返回 509 条完整数据', async () => {
    const all = await loadAllVerses();
    expect(all).toHaveLength(509);
    // 首条/末条与源数据一致（压缩数据按 id 全局连续编号，与源文件顺序一致）
    expect(all[0]).toEqual(chapter1Verses[0]);
    expect(all[all.length - 1]).toEqual(chapter20Verses[chapter20Verses.length - 1]);
  });

  test('loadChapter/loadVerse 与解压数据一致', async () => {
    const ch2 = await loadChapter(2);
    expect(ch2).toEqual(chapter2Verses);
    // id 为全局连续编号：201 属于第 5 篇（公冶长），不属于第 2 篇
    const v = await loadVerse(201);
    expect(v).toEqual(chapter5Verses.find(x => x.id === 201));
  });

  test('versesIndex 与压缩数据一致（id/chapterId/original）', async () => {
    const map = new Map((await loadAllVerses()).map(v => [v.id, v]));
    expect(versesIndex).toHaveLength(509);
    for (const idx of versesIndex) {
      const v = map.get(idx.id);
      expect(v).toBeTruthy();
      expect(v!.chapterId).toBe(idx.chapterId);
      expect(v!.original).toBe(idx.original);
    }
  });
});
