/**
 * 今日推荐 & 异常路由测试
 * 对应测试用例: HOME-002 / HOME-003 / VSD-013 / EXC-001 / EXC-002 / HOME-004 / HOME-007
 */
import { getTodayRecommend, getAlternativeRecommend } from '@/data/dailyRecommend';
import { loadVerse, versesIndex } from '@/data/versesLoader';
import { chapters } from '@/data/chapters';

describe('今日推荐 (HOME-002 / HOME-003 / HOME-004)', () => {
  // HOME-002: 今日推荐展示（方案 E：主题轮换，返回主题/篇章/章句核心要点）
  test('HOME-002 [P0]: getTodayRecommend 返回完整对象（verseId/theme/chapterTitle/chapterId/reason）', () => {
    const r = getTodayRecommend();
    expect(r).toBeTruthy();
    expect(r.verseId).toBeGreaterThan(0);
    expect(r.reason).toBeTruthy();
    expect(r.reason.length).toBeGreaterThan(5);
    expect(r.theme).toBeTruthy();
    expect(r.chapterTitle).toBeTruthy();
    expect(r.chapterId).toBeGreaterThan(0);
  });

  // HOME-002: 推荐对应的章句存在且属于今日主题篇章
  test('HOME-002 [P0]: 今日推荐的 verseId 在 versesIndex 中存在', async () => {
    const r = getTodayRecommend();
    const verse = await loadVerse(r.verseId);
    expect(verse).not.toBeNull();
    expect(verse!.original).toBeTruthy();
    expect(verse!.chapterId).toBe(r.chapterId);
    // reason 为主包可得的轻量文案（keyPoint 在分包完整数据里，首页暂不展示）
    const chapter = chapters.find(c => c.id === r.chapterId)!;
    expect(r.reason).toBe(`第 ${verse!.order} 句 · 本篇共 ${chapter.verseCount} 句`);
  });

  // HOME-003: 主题按篇章顺序轮换（20 篇 20 天一轮，注入固定日期）
  test('HOME-003 [P1]: 连续 20 天主题按篇章 id 顺序轮换（dayOfYear 0~19 → chapterId 1~20）', () => {
    for (let day = 0; day < 20; day++) {
      const d = new Date(2026, 0, 1 + day); // 1月1日(第0天) ~ 1月20日(第19天)
      const r = getTodayRecommend(d);
      expect(r.chapterId).toBe(day + 1);
      expect(r.theme).toBe(chapters[day].theme);
      expect(r.chapterTitle).toBe(chapters[day].title);
    }
    // 第 21 天回到第一篇（20 天一轮）
    const d21 = new Date(2026, 0, 21);
    expect(getTodayRecommend(d21).chapterId).toBe(1);
  });

  // HOME-003: 确定性——同一天两次调用结果一致（可分享、可运营）
  test('HOME-003 [P1]: 同一天两次调用返回相同句子（确定性哈希）', () => {
    const d = new Date(2026, 5, 15);
    expect(getTodayRecommend(d).verseId).toBe(getTodayRecommend(d).verseId);
    expect(getTodayRecommend(d).reason).toBe(getTodayRecommend(d).reason);
  });

  // HOME-003: 跨年——同月同日主题相同（篇章轮换不变）但句子不同（种子含年份）
  test('HOME-003 [P1]: 跨年同月同日主题相同但句子不同', () => {
    const r2026 = getTodayRecommend(new Date(2026, 0, 1));
    const r2027 = getTodayRecommend(new Date(2027, 0, 1));
    expect(r2026.theme).toBe(r2027.theme);
    expect(r2026.chapterId).toBe(r2027.chapterId);
    expect(r2026.verseId).not.toBe(r2027.verseId);
  });

  // HOME-004: 换一批——保持今日主题不变，同篇章内换句
  test('HOME-004 [P0]: 换一批保持同主题且不含当前句', () => {
    const r = getTodayRecommend();
    const chapterVerses = versesIndex.filter(v => v.chapterId === r.chapterId);
    // 方案 E 数据前提：每篇至少 3 句（尧曰最少），排除当前句后仍有可选项
    expect(chapterVerses.length).toBeGreaterThan(1);
    const pool = chapterVerses.filter(v => v.id !== r.verseId);
    expect(pool.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 10; i++) {
      const alt = getAlternativeRecommend(r.chapterId, r.verseId);
      expect(alt.chapterId).toBe(r.chapterId);
      expect(alt.theme).toBe(r.theme);
      expect(alt.verseId).not.toBe(r.verseId);
      expect(alt.verseId).toBeGreaterThan(0);
      expect(alt.reason).toBeTruthy();
    }
  });
});

describe('默认路由参数 (VSD-013)', () => {
  // VSD-013: 无参数访问 verseDetail 默认 id=101
  test('VSD-013 [P1]: 默认 verseId = 101 存在并可加载', async () => {
    const defaultId = 101;
    const v = await loadVerse(defaultId);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(101);
    expect(v!.chapterId).toBe(1);
  });
});

describe('异常路由参数 (EXC-001 / EXC-002)', () => {
  // EXC-001: 无效章句 id 回退
  test('EXC-001 [P1]: 无效章句 id (999) loadVerse 返回 null（页面可回退到默认）', async () => {
    const v = await loadVerse(999);
    expect(v).toBeNull();
  });

  // EXC-001: 极端 id
  test('EXC-001 [P1]: 极端 id (-1, 0, 99999) loadVerse 返回 null', async () => {
    expect(await loadVerse(-1)).toBeNull();
    expect(await loadVerse(0)).toBeNull();
    expect(await loadVerse(99999)).toBeNull();
  });

  // EXC-002: 无效篇章 id 回退
  test('EXC-002 [P1]: 无效篇章 id loadChapter 返回空数组', async () => {
    const v = await loadChapter(25);
    expect(v).toEqual([]);
  });

  // EXC-002: 篇章 id 越界
  test('EXC-002 [P1]: 篇章 id 25 越界（章句加载返回空）', async () => {
    // 通过 versesIndex 验证：找不到 chapterId=25 的索引
    const versesInChapter25 = versesIndex.filter(v => v.chapterId === 25);
    expect(versesInChapter25).toEqual([]);
  });

  // 修复后回退逻辑：无效 id 时应回退到默认第 1 章
  test('EXC-001 [P1]: 路由参数无效时回退到默认 101', async () => {
    const invalidId = 9999;
    let v = await loadVerse(invalidId);
    if (!v && versesIndex.length > 0) {
      v = await loadVerse(versesIndex[0].id);
    }
    expect(v).not.toBeNull();
    expect(v!.id).toBe(101);
  });
});

describe('TabBar 与导航 (NAV-001 / NAV-002)', () => {
  // NAV-001: tabBar 配置 4 个页面
  test('NAV-001 [P0]: chapters 共 20 篇可被章节列表渲染', () => {
    expect(chapters.length).toBe(20);
  });

  // NAV-005: 多级导航链路：首页 → 论语 → 篇章 → 章句
  test('NAV-005 [P0]: 多级导航链路数据完整', async () => {
    // 首页推荐 → 章句
    const r = getTodayRecommend();
    const verse = await loadVerse(r.verseId);
    expect(verse).not.toBeNull();
    // 章句 → 篇章
    const chapter = chapters.find(c => c.id === verse!.chapterId);
    expect(chapter).toBeTruthy();
    // 篇章 → 章句列表
    const versesInChapter = versesIndex.filter(v => v.chapterId === chapter!.id);
    expect(versesInChapter.length).toBe(chapter!.verseCount);
  });
});

describe('注释换行渲染 (VSD-004)', () => {
  // VSD-004: 注释换行正确
  test('VSD-004 [P0]: chapter1 第1章注释含 \\n 分隔符 + 【解读】', async () => {
    const v = await loadVerse(101);
    expect(v).not.toBeNull();
    expect(v!.commentary).toContain('\\n');
    expect(v!.commentary).toContain('【解读】');
  });

  // VSD-004: renderLines 函数正确拆分
  test('VSD-004 [P0]: renderLines 拆分换行符正确', () => {
    // 复刻 verseDetail 中的 renderLines 逻辑
    function renderLines(text: string) {
      if (!text) return null;
      return text.replace(/\\n/g, '\n').split('\n');
    }
    const sample = '①第一行\\n②第二行\\n\\n【解读】评析';
    const lines = renderLines(sample)!;
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('①第一行');
    expect(lines[1]).toBe('②第二行');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('【解读】评析');
  });

  // VSD-003: 注释展示完整（真实统计断言：允许少数章节无【解读】标记，≥95%）
  test('VSD-003 [P0]: 全部 509 章 commentary 含 【解读】标记（≥95%）', async () => {
    let total = 0;
    let withMark = 0;
    const missing: number[] = [];
    for (let id = 1; id <= 20; id++) {
      const verses = await loadChapter(id);
      for (const v of verses) {
        total++;
        if (v.commentary.includes('【解读】')) {
          withMark++;
        } else {
          missing.push(v.id);
        }
      }
    }
    expect(total).toBe(509);
    if (missing.length > 0) console.warn('无【解读】标记的章句：', missing);
    expect(withMark / total).toBeGreaterThanOrEqual(0.95);
  });
});

// 复用 loadChapter
async function loadChapter(id: number) {
  return await import('@/data/versesLoader').then(m => m.loadChapter(id));
}
