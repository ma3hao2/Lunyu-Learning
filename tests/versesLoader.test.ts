/**
 * 数据加载与搜索测试
 * 对应测试用例: PRF-001 / PRF-002 / PRF-003 / CLS-005 ~ CLS-012
 */
import { versesIndex, loadChapter, loadVerse } from '@/data/versesLoader';
import { chapters } from '@/data/chapters';

// 简易复刻 classics 页中的搜索逻辑（如不一致则以本测试为准）
function searchVerses(keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return [];
  return versesIndex
    .filter(v => v.original.toLowerCase().includes(k))
    .slice(0, 20);
}

function searchChapters(keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return [];
  return chapters.filter(c =>
    c.title.toLowerCase().includes(k) ||
    c.subTitle.toLowerCase().includes(k) ||
    c.description.toLowerCase().includes(k) ||
    c.theme.toLowerCase().includes(k)
  );
}

describe('懒加载与缓存 (PRF-001 / PRF-002)', () => {
  // PRF-001: 篇章分包数据存在
  test('PRF-001 [P0]: loadChapter(1) 返回学而篇 16 条数据', async () => {
    const v = await loadChapter(1);
    expect(v).toHaveLength(16);
    expect(v[0].id).toBe(101);
    expect(v[0].original).toContain('学而时习之');
  });

  test('PRF-001 [P0]: loadChapter(20) 返回尧曰篇 3 条数据', async () => {
    const v = await loadChapter(20);
    expect(v).toHaveLength(3);
  });

  test('PRF-001 [P0]: 无效篇章 id 返回空数组', async () => {
    const v = await loadChapter(99);
    expect(v).toEqual([]);
  });

  // PRF-002: 缓存命中
  test('PRF-002 [P1]: 同一篇章二次加载从缓存读取（返回同一引用）', async () => {
    const a = await loadChapter(2);
    const b = await loadChapter(2);
    expect(b).toBe(a); // 引用相等 → 命中缓存
  });

  // PRF-003: 单条经文加载
  test('PRF-003 [P0]: loadVerse(101) 返回正确章句', async () => {
    const v = await loadVerse(101);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(101);
    expect(v!.original).toContain('学而时习之');
    expect(v!.translation).toBeTruthy();
    expect(v!.commentary).toBeTruthy();
  });

  test('PRF-003 [P0]: loadVerse 无效 id 返回 null', async () => {
    const v = await loadVerse(99999);
    expect(v).toBeNull();
  });
});

describe('搜索功能 (CLS-005 ~ CLS-012)', () => {
  // CLS-005: 搜索章句原文
  test('CLS-005 [P0]: 搜索 "学而时习之" 命中 1 条', () => {
    const r = searchVerses('学而时习之');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].id).toBe(101);
  });

  // CLS-006: 搜索篇章名称
  test('CLS-006 [P0]: 搜索 "八佾" 命中篇章 1 条', () => {
    const r = searchChapters('八佾');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(3);
  });

  // CLS-007: 主题关键词
  test('CLS-007 [P1]: 搜索主题 "仁德" 命中篇章', () => {
    const r = searchChapters('仁德');
    expect(r.length).toBeGreaterThan(0);
    r.forEach(c => expect(c.theme).toContain('仁德'));
  });

  // CLS-009: 高频字搜索可全量收集（上限512），分页初始显示20条
  test('CLS-009 [P1]: 高频字 "子" 搜索全量收集不超过512，初始分页20', () => {
    const r = searchVerses('子');
    // searchVerses 复刻页面初始分页逻辑（slice 0,20），全量命中应 >= 初始页
    const allMatches = versesIndex.filter(v => v.original.toLowerCase().includes('子'));
    expect(r.length).toBeLessThanOrEqual(20); // 初始分页大小
    expect(allMatches.length).toBeLessThanOrEqual(512); // 收集上限
  });

  // CLS-010: 无结果
  test('CLS-010 [P0]: 搜索 "xyzabc" 无结果', () => {
    expect(searchVerses('xyzabc')).toEqual([]);
    expect(searchChapters('xyzabc')).toEqual([]);
  });

  // CLS-005: 大小写不敏感
  test('CLS-005 [P0]: 关键词前后空白自动 trim', () => {
    const r = searchVerses('  学而  ');
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  // CLS-005: 特殊字符
  test('EXC-008 [P1]: 搜索含特殊字符 "子曰" 正常匹配', () => {
    const r = searchVerses('子曰');
    expect(r.length).toBeGreaterThan(10);
  });

  // PRF-003: 搜索性能
  test('PRF-003 [P0]: 512 条索引搜索响应 < 100ms', () => {
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) searchVerses('学');
    const cost = Date.now() - t0;
    expect(cost).toBeLessThan(100);
  });

  // 章句 → 篇章跳转链路
  test('CLS-012 [P0]: 章句 id 能映射回篇章', () => {
    const verse = versesIndex.find(v => v.id === 101)!;
    const chapter = chapters.find(c => c.id === verse.chapterId)!;
    expect(chapter.title).toBe('学而第一');
  });

  // 篇章 → 章句列表 跳转
  test('CLS-013 [P0]: 篇章 id 能查到对应章句列表', async () => {
    const verses = await loadChapter(1);
    expect(verses.length).toBe(16);
    expect(verses.every(v => v.chapterId === 1)).toBe(true);
  });
});

describe('索引数据正确性', () => {
  // 索引与完整数据 id 一致
  test('索引 id 与完整章句 id 一致', async () => {
    for (let id = 1; id <= 20; id++) {
      const verses = await loadChapter(id);
      const indexVerses = versesIndex.filter(v => v.chapterId === id);
      expect(verses.map(v => v.id)).toEqual(indexVerses.map(v => v.id));
    }
  });

  // 索引中 original 字段非空
  test('索引中 original 字段非空', () => {
    const empty = versesIndex.filter(v => !v.original || v.original.length === 0);
    expect(empty).toEqual([]);
  });
});
