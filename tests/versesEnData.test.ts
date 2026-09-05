/**
 * 英文章句数据完整性测试
 *
 * 验证 scripts/sync-en-data.mjs 生成的 versesEnData.compressed.ts + chaptersEn.ts：
 * 1. 解压后 509 条，与中文 versesIndex 的 id 完全对齐（无缺漏/多余）
 * 2. 每条 translation / commentary / keyPoint 非空；commentary 保留 --- 分节结构
 * 3. chaptersEn 20 篇齐全，与中文 chapters 按 id 对齐、theme 一致（筛选关联键）
 */
import { VERSES_EN_BLOB_B64 } from '@/data/versesEnData.compressed';
import { base64ToBytes, inflateRaw, utf8Decode } from '@/utils/inflate';
import { versesIndex } from '@/data/versesIndex';
import { chapters } from '@/data/chapters';
import { chaptersEn } from '@/data/chaptersEn';
import { loadChapterEn, loadVerseEn, loadAllVersesEn } from '@/data/versesEnLoader';
import type { VerseEn } from '@/types';

function parseBlob(): VerseEn[] {
  const bytes = base64ToBytes(VERSES_EN_BLOB_B64);
  const json = utf8Decode(inflateRaw(bytes));
  return (JSON.parse(json) as { versesEn: VerseEn[] }).versesEn;
}

describe('英文章句 blob（versesEnData.compressed）', () => {
  const data = parseBlob();

  test('总量 509 条且按 id 升序', () => {
    expect(data).toHaveLength(509);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].id).toBeGreaterThan(data[i - 1].id);
    }
  });

  test('id 与中文 versesIndex 完全对齐（无缺漏/多余）', () => {
    const zhIds = versesIndex.map(v => v.id).sort((a, b) => a - b);
    const enIds = data.map(v => v.id);
    expect(enIds).toEqual(zhIds);
  });

  test('每条英文字段非空且无 HTML 实体残留', () => {
    for (const v of data) {
      expect(v.translation.trim()).not.toBe('');
      expect(v.commentary.trim()).not.toBe('');
      expect(v.keyPoint.trim()).not.toBe('');
      expect(v.translation).not.toMatch(/&(amp|lt|gt|quot|nbsp|#39);/);
    }
  });

  test('commentary 保留 --- 分节结构（字词注释 / 解读）', () => {
    for (const v of data) {
      expect(v.commentary).toContain('---');
      expect(v.commentary).toContain('【Interpretation】');
    }
  });

  test('英文要点用 ; 分隔且不含中文分号', () => {
    for (const v of data) {
      expect(v.keyPoint).not.toContain('；');
    }
  });
});

describe('英文章节（chaptersEn）', () => {
  test('20 篇齐全且与中文 chapters 按 id/theme 对齐', () => {
    expect(chaptersEn).toHaveLength(20);
    const zhById = new Map(chapters.map(c => [c.id, c]));
    for (const ce of chaptersEn) {
      const zh = zhById.get(ce.id);
      expect(zh).toBeDefined();
      expect(ce.theme).toBe(zh!.theme); // theme 是中文筛选关联键
      expect(ce.title.trim()).not.toBe('');
      expect(ce.description.trim()).not.toBe('');
    }
  });
});

describe('versesEnLoader（解压路径 API 行为）', () => {
  test('loadAllVersesEn 返回 509 条且缓存命中同引用', async () => {
    const a = await loadAllVersesEn();
    const b = await loadAllVersesEn();
    expect(a).toHaveLength(509);
    expect(b).toBe(a);
  });

  test('loadVerseEn 返回单条英文数据；不存在 id 返回 null', async () => {
    const first = versesIndex[0];
    const v = await loadVerseEn(first.id);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(first.id);
    expect(v!.translation.trim()).not.toBe('');
    expect(await loadVerseEn(-1)).toBeNull();
  });

  test('loadChapterEn 按篇过滤且二次加载同引用；与中文每篇句数一致', async () => {
    for (const ch of chapters.slice(0, 3)) {
      const zhCount = versesIndex.filter(v => v.chapterId === ch.id).length;
      const en = await loadChapterEn(ch.id);
      expect(en).toHaveLength(zhCount);
      expect(await loadChapterEn(ch.id)).toBe(en);
      for (const item of en) expect(chapterIdOf(item.id)).toBe(ch.id);
    }
  });
});

/** 由中文轻量索引反查章句归属（loader 的分组依据） */
function chapterIdOf(id: number): number {
  const hit = versesIndex.find(v => v.id === id);
  return hit ? hit.chapterId : -1;
}
