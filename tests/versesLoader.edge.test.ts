/**
 * versesLoader 防御分支测试
 *
 * 覆盖 loadVerse 在「索引命中、但完整数据缺失」时的兜底逻辑：
 * 用 mock 的 versesIndex 构造一个 id 指向真实 chapter1 中不存在的章句，
 * 验证返回 null（对应 versesLoader.ts 第 47 行 `|| null` 分支）。
 */
describe('loadVerse 数据缺失兜底 (PRF-003)', () => {
  test('索引存在但对应章节数据中无该章句时返回 null', async () => {
    jest.resetModules();
    jest.doMock('@/data/versesIndex', () => ({
      versesIndex: [{ id: 99901, chapterId: 1, original: '索引存在但数据缺失' }]
    }));

    const { loadVerse } = require('@/data/versesLoader') as {
      loadVerse: (id: number) => Promise<unknown>;
    };

    const verse = await loadVerse(99901);
    expect(verse).toBeNull();
  });

  test('索引不存在时直接返回 null（无需加载章节）', async () => {
    jest.resetModules();
    jest.doMock('@/data/versesIndex', () => ({
      versesIndex: []
    }));

    const { loadVerse } = require('@/data/versesLoader') as {
      loadVerse: (id: number) => Promise<unknown>;
    };

    expect(await loadVerse(404)).toBeNull();
  });
});
