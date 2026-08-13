/**
 * syncProgress 云函数测试
 *
 * 覆盖：upload（新建/并集合并/笔记取较新版本/缺数据拒绝/超 900KB 拒绝）
 *       download（空/有数据）/ clear（清空云端进度）/ 未知操作
 *
 * wx-server-sdk 经 global 侧信道注入按用例配置的 fakeDb（模式同 publishNote.test.ts）
 */
let __syncFakeDb: any = null;
jest.mock('wx-server-sdk', () => ({
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: jest.fn(),
  getWXContext: () => ({ OPENID: 'openid_test' }),
  database: () => __syncFakeDb
}), { virtual: true });

/** 可配置的 progress 集合 fakeDb：existing 为云端已有记录，calls 记录 add/update */
function makeFakeDb(initialExisting: any[] = []) {
  let existing = [...initialExisting];
  const calls = { add: [] as any[], update: [] as any[] };
  const collection = () => ({
    where: () => ({
      get: async () => ({ data: existing })
    }),
    doc: (id: string) => ({
      update: async ({ data }: any) => {
        calls.update.push({ docId: id, data });
        return {};
      }
    }),
    add: async ({ data }: any) => {
      calls.add.push({ data });
      return { _id: 'doc1' };
    }
  });
  return {
    collection,
    serverDate: () => ({ __serverDate: true }),
    __setExisting: (rows: any[]) => { existing = rows; },
    __calls: calls
  };
}

const baseProgress = {
  readVerseIds: [],
  myNotes: [],
  totalReadDays: 1,
  deletedNoteIds: [],
  likedNoteIds: [],
  unlikedNoteIds: []
};

describe('syncProgress 云函数', () => {
  let main: any;
  let db: ReturnType<typeof makeFakeDb>;

  beforeEach(() => {
    db = makeFakeDb();
    __syncFakeDb = db;
    jest.resetModules();
    main = require('../cloudfunctions/syncProgress/index').main;
  });

  test('upload: 云端无记录时新建文档（_openid + progress 透传）', async () => {
    const res = await main({ action: 'upload', progress: { ...baseProgress, readVerseIds: [101] } }, {});
    expect(res.code).toBe(0);
    expect(res.message).toBe('上传成功');
    expect(db.__calls.add).toHaveLength(1);
    const doc = db.__calls.add[0].data;
    expect(doc._openid).toBe('openid_test');
    expect(doc.progress.readVerseIds).toEqual([101]);
    expect(doc.createTime).toEqual({ __serverDate: true });
  });

  test('upload: 云端已有记录时并集合并（readVerseIds 取并集）', async () => {
    db.__setExisting([{
      _id: 'd1',
      _openid: 'openid_test',
      progress: { ...baseProgress, readVerseIds: [101] }
    }]);
    const res = await main({ action: 'upload', progress: { ...baseProgress, readVerseIds: [102] } }, {});
    expect(res.code).toBe(0);
    expect(db.__calls.add).toHaveLength(0); // 走更新不新建
    const upd = db.__calls.update[0];
    expect(upd.docId).toBe('d1');
    expect(upd.data.progress.readVerseIds.sort((a: number, b: number) => a - b)).toEqual([101, 102]);
    expect(upd.data.updateTime).toEqual({ __serverDate: true });
  });

  test('upload: 笔记合并保留 updateTime 较新版本（跨设备编辑不丢更新）', async () => {
    db.__setExisting([{
      _id: 'd1',
      progress: {
        ...baseProgress,
        myNotes: [{ id: 1, verseId: 101, content: '云端旧版', createTime: '2026-08-10 09:00' }]
      }
    }]);
    const res = await main({
      action: 'upload',
      progress: {
        ...baseProgress,
        myNotes: [{ id: 1, verseId: 101, content: '本地新版', createTime: '2026-08-10 09:00', updateTime: '2026-08-11 10:30' }]
      }
    }, {});
    expect(res.code).toBe(0);
    expect(db.__calls.update[0].data.progress.myNotes).toEqual([
      expect.objectContaining({ id: 1, content: '本地新版' })
    ]);
  });

  test('upload: 缺 progress 拒绝', async () => {
    const res = await main({ action: 'upload' }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toBe('缺少进度数据');
    expect(db.__calls.add).toHaveLength(0);
  });

  test('upload: 超过 900KB 拒绝（云数据库单文档上限保护）', async () => {
    const big = 'x'.repeat(900 * 1024 + 1);
    const res = await main({ action: 'upload', progress: { ...baseProgress, myNotes: [{ id: 1, content: big }] } }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toContain('900KB');
    expect(db.__calls.add).toHaveLength(0);
  });

  test('download: 云端无记录返回 data=null', async () => {
    const res = await main({ action: 'download' }, {});
    expect(res.code).toBe(0);
    expect(res.data).toBeNull();
  });

  test('download: 返回云端进度', async () => {
    db.__setExisting([{ _id: 'd1', progress: { ...baseProgress, readVerseIds: [101, 102] } }]);
    const res = await main({ action: 'download' }, {});
    expect(res.code).toBe(0);
    expect(res.data.readVerseIds).toEqual([101, 102]);
  });

  test('clear: 清空云端进度为默认空进度', async () => {
    db.__setExisting([{ _id: 'd1', progress: { ...baseProgress, readVerseIds: [101] } }]);
    const res = await main({ action: 'clear' }, {});
    expect(res.code).toBe(0);
    const cleared = db.__calls.update[0].data.progress;
    expect(cleared.readVerseIds).toEqual([]);
    expect(cleared.myNotes).toEqual([]);
    expect(cleared.totalReadDays).toBe(1);
    expect(cleared.lastReadDate).toBeNull();
  });

  test('clear: 云端无记录时幂等返回', async () => {
    const res = await main({ action: 'clear' }, {});
    expect(res.code).toBe(0);
    expect(db.__calls.update).toHaveLength(0);
  });

  test('未知操作返回错误', async () => {
    const res = await main({ action: 'hack' }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toContain('未知操作');
  });
});
