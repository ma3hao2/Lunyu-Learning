/**
 * versesLoader 防御分支测试
 *
 * 2026-08-13 起 loadVerse 改为直接查「解压后的全量数据」（不再经 versesIndex 定位章节），
 * 行为更直接：id 不存在于全量数据时返回 null，与索引状态无关。
 * 本文件验证该兜底分支：
 * 1. 不存在的 id（数据外编号）→ null
 * 2. mock 空索引下行为不变（索引不再参与查询路径，但 API 语义保持）
 */
describe('loadVerse 数据缺失兜底 (PRF-003)', () => {
  test('不存在的 id 返回 null', async () => {
    jest.resetModules();
    const { loadVerse } = require('@/data/versesLoader') as {
      loadVerse: (id: number) => Promise<unknown>;
    };

    expect(await loadVerse(99901)).toBeNull();
    expect(await loadVerse(0)).toBeNull();
  });

  test('mock 空索引时行为不变（查询不依赖 versesIndex）', async () => {
    jest.resetModules();
    jest.doMock('@/data/versesIndex', () => ({
      versesIndex: []
    }));

    const { loadVerse } = require('@/data/versesLoader') as {
      loadVerse: (id: number) => Promise<unknown>;
    };

    // 404 是真实存在的章句（全局编号 101-609），新实现直接命中全量数据
    expect(await loadVerse(404)).not.toBeNull();
    // 数据外的 id 仍返回 null
    expect(await loadVerse(99901)).toBeNull();
  });
});
