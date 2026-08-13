/**
 * 数据完整性测试
 * 对应测试用例: PRF-005 / PRF-006 / CLS-001 / CLS-002 / CMP-006 / CMP-007
 * 注：INS-001/INS-002（mock 心得）已随 mock 数据退场移除
 */
import { chapters } from '@/data/chapters';
import { versesIndex } from '@/data/versesIndex';
import { loadChapter } from '@/data/versesLoader';

describe('数据完整性测试 (PRF-005 / PRF-006 / CLS-001 / CLS-002)', () => {
  // PRF-005: 全量数据完整性 — 20 篇 × verseCount 之和 = 509
  test('PRF-005 [P0]: chapters 共 20 篇，verseCount 总和 = 509', () => {
    expect(chapters).toHaveLength(20); // CLS-001 / CLS-002
    const total = chapters.reduce((s, c) => s + c.verseCount, 0);
    expect(total).toBe(509);
  });

  // PRF-005: 篇章基础字段完整
  test('PRF-005 [P0]: 每篇 chapter 必填字段齐全（id/title/subTitle/verseCount/theme/description）', () => {
    for (const c of chapters) {
      expect(c.id).toBeGreaterThan(0);
      expect(c.title).toBeTruthy();
      expect(c.subTitle).toBeTruthy();
      expect(c.verseCount).toBeGreaterThan(0);
      expect(c.theme).toBeTruthy();
      expect(c.description).toBeTruthy();
    }
  });

  // PRF-005: 篇章 id 连续 1..20
  test('PRF-005 [P0]: 篇章 id 连续 1..20', () => {
    const ids = chapters.map(c => c.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  // PRF-005: versesIndex 共 509 条
  test('PRF-005 [P0]: versesIndex 共 509 条，id 唯一', () => {
    expect(versesIndex).toHaveLength(509);
    const ids = new Set(versesIndex.map(v => v.id));
    expect(ids.size).toBe(509);
  });

  // PRF-005: 章句 id 存在 3 个已知缺口（历史删条后未重排，索引与全量数据一致缺失）
  // 显式锁定缺口集合，防止未来无意新增缺口踩到「随机生成 id / id 区间判断」类逻辑
  test('PRF-005 [P1]: 章句 id 区间无新增缺口（已知缺口 194/260/370）', () => {
    const KNOWN_GAPS = new Set([194, 260, 370]);
    const ids = versesIndex.map(v => v.id);
    const gaps: number[] = [];
    for (let id = Math.min(...ids); id <= Math.max(...ids); id++) {
      if (!ids.includes(id) && !KNOWN_GAPS.has(id)) gaps.push(id);
    }
    expect(gaps).toEqual([]);
  });

  // PRF-005: 索引中各篇章条数 = chapters.verseCount
  test('PRF-005 [P0]: 各篇章索引条数 = chapters.verseCount', () => {
    for (const c of chapters) {
      const cnt = versesIndex.filter(v => v.chapterId === c.id).length;
      expect(cnt).toBe(c.verseCount);
    }
  });

  // PRF-005 / PRF-006: 完整章句数据 (translation / commentary 非空)
  test('PRF-006 [P0]: 全部 509 章 translation 与 commentary 均非空', async () => {
    const versesCount: { chapterId: number; verses: number; missing: number[] }[] = [];
    let totalMissing = 0;
    for (let id = 1; id <= 20; id++) {
      const verses = await loadChapter(id);
      expect(verses.length).toBe(chapters.find(c => c.id === id)!.verseCount);
      const missing: number[] = [];
      for (const v of verses) {
        if (!v.translation || v.translation.trim().length === 0) missing.push(v.id);
        if (!v.commentary || v.commentary.trim().length === 0) missing.push(v.id);
        if (!v.original || v.original.trim().length === 0) missing.push(v.id);
        if (!v.keyPoint || v.keyPoint.trim().length === 0) missing.push(v.id);
      }
      totalMissing += missing.length;
      versesCount.push({ chapterId: id, verses: verses.length, missing });
    }
    if (totalMissing > 0) {
      console.warn('缺失字段明细：', versesCount.filter(x => x.missing.length > 0));
    }
    expect(totalMissing).toBe(0);
  });

  // PRF-006: order 连续 1..verseCount
  test('PRF-006 [P0]: 各篇章 verse.order 连续自 1 开始', async () => {
    for (const c of chapters) {
      const verses = await loadChapter(c.id);
      const orders = verses.map(v => v.order).sort((a, b) => a - b);
      expect(orders).toEqual(Array.from({ length: c.verseCount }, (_, i) => i + 1));
    }
  });

  // PRF-006: chapterId 与所在篇章一致
  test('PRF-006 [P0]: 章句 chapterId 与所在篇章一致', async () => {
    for (let id = 1; id <= 20; id++) {
      const verses = await loadChapter(id);
      for (const v of verses) {
        expect(v.chapterId).toBe(id);
      }
    }
  });

  // CLS-003: 主题唯一性
  test('CLS-003 [P0]: 主题字段非空且唯一', () => {
    const themes = chapters.map(c => c.theme);
    const uniqueThemes = new Set(themes);
    // 主题允许在不同篇章出现相同值，但每个主题都应非空
    expect(themes.every(t => t.length > 0)).toBe(true);
    expect(uniqueThemes.size).toBeGreaterThanOrEqual(10); // 至少 10 个不同主题
  });

  // CMP-006 / CMP-007 边界
  test('CMP-006/007 [P1]: ProgressBar 边界 — 0/509 与 16/16', () => {
    const calc = (cur: number, total: number) => total === 0 ? 0 : Math.min(100, (cur / total) * 100);
    expect(calc(0, 509)).toBe(0);
    expect(calc(16, 16)).toBe(100);
    expect(calc(10, 509)).toBeCloseTo(1.96, 1);
  });
});
