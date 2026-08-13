/**
 * publishNote 云函数纯逻辑单测（COM-023）
 * 覆盖：发布校验（内容长度/标签数量/标签长度/verseId 有效性）
 *       list 分页 / _openid 剔除 / 点赞状态 / 点赞与取消点赞查重（logic.js）
 *       index.js 入口：publish 分支 verseId 必填拦截 + authorName 截断（P2-1）
 */
import { validateNote } from '../cloudfunctions/publishNote/validate';
import { listNotes, likeNote, unlikeNote } from '../cloudfunctions/publishNote/logic';

// P2-1：index.js 入口测试用的 wx-server-sdk mock（db 经 global 侧信道按用例注入，避免模块加载时序问题）
let __publishFakeDb: any = null;
let __msgSecResult: any = { result: { suggest: 'pass' } };
jest.mock('wx-server-sdk', () => ({
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: jest.fn(),
  getWXContext: () => ({ OPENID: 'me' }),
  database: () => __publishFakeDb,
  openapi: {
    security: {
      msgSecCheck: jest.fn(() => Promise.resolve(__msgSecResult))
    }
  }
}), { virtual: true });

/**
 * 构造可配置的 mock 云数据库。
 * collections 里的 key 为集合名，值为行为配置：
 *   - list: 该集合 get() 返回的 data 数组
 *   - addCalls / updateCalls / removeCalls: 记录调用参数
 */
function makeFakeDb(config: any = {}) {
  const calls = { add: [] as any[], update: [] as any[], remove: [] as any[], queries: [] as any[] };

  const collection = (name: string) => {
    const colConfig = config.collections?.[name] || {};
    let state: any = {};
    const chain: any = {
      where(query: any) {
        state.query = query;
        calls.queries.push({ collection: name, query });
        return chain;
      },
      orderBy(field: string, order: string) {
        calls.queries.push({ collection: name, orderBy: { field, order } });
        return chain;
      },
      skip(n: number) {
        calls.queries.push({ collection: name, skip: n });
        return chain;
      },
      limit(n: number) {
        calls.queries.push({ collection: name, limit: n });
        return chain;
      },
      field(fields: any) {
        calls.queries.push({ collection: name, field: fields });
        return chain;
      },
      async get() {
        // getError 用于模拟集合不存在等异常场景（如 notes_likes 未创建）
        if (colConfig.getError) throw colConfig.getError;
        return { data: colConfig.list || [] };
      },
      async remove() {
        calls.remove.push({ collection: name, query: state.query });
        return {};
      },
      async add({ data }: any) {
        calls.add.push({ collection: name, data });
        return { _id: (colConfig.addId) || `fake_${calls.add.length}` };
      },
      doc(id: string) {
        return {
          async get() {
            return { data: colConfig.doc?.[id] };
          },
          async update({ data }: any) {
            calls.update.push({ collection: name, docId: id, data });
            return {};
          },
          async remove() {
            calls.remove.push({ collection: name, docId: id });
            return {};
          }
        };
      }
    };
    return chain;
  };

  const fakeDb: any = {
    collection,
    command: {
      in: (ids: string[]) => ({ __op: 'in', ids }),
      inc: (n: number) => ({ __op: 'inc', n })
    },
    RegExp: ({ regexp, options }: any) => ({ __regexp: regexp, options }),
    serverDate: () => ({ __serverDate: true })
  };
  return { db: fakeDb, calls };
}

function makeNote(overrides: any = {}) {
  return {
    _id: 'n1',
    _openid: 'user-secret-openid',
    verseId: 101,
    verseOriginal: '学而时习之',
    chapterTitle: '学而第一',
    content: '学习心得内容',
    tags: ['修身'],
    authorName: '论语学习者',
    likeCount: 3,
    createTime: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

describe('publishNote 校验 (COM-003 / COM-023)', () => {
  test('COM-023: 合法内容通过校验', () => {
    expect(validateNote('学而时习之，不亦说乎', ['修身', '学习'], 101)).toBeNull();
  });

  test('COM-023: 空内容拒绝', () => {
    expect(validateNote('', ['修身'], 101)).toBe('心得内容不能为空');
    expect(validateNote('   ', ['修身'], 101)).toBe('心得内容不能为空');
  });

  test('COM-023: 超 500 字拒绝', () => {
    const long = '学'.repeat(501);
    expect(validateNote(long, ['修身'], 101)).toBe('心得内容不能超过500字');
    const edge = '学'.repeat(500);
    expect(validateNote(edge, ['修身'], 101)).toBeNull();
  });

  test('COM-023: 标签超过 5 个拒绝', () => {
    expect(validateNote('内容', ['a', 'b', 'c', 'd', 'e', 'f'], 101)).toBe('标签最多5个');
    expect(validateNote('内容', ['a', 'b', 'c', 'd', 'e'], 101)).toBeNull();
  });

  test('COM-023: 单个标签超 8 字拒绝', () => {
    expect(validateNote('内容', ['123456789'], 101)).toBe('每个标签最多8个字'); // 9字
    expect(validateNote('内容', ['12345678'], 101)).toBeNull(); // 恰好 8 字
  });

  test('COM-023: 无效 verseId 拒绝', () => {
    expect(validateNote('内容', ['修身'], 0)).toBe('章句ID无效');
    expect(validateNote('内容', ['修身'], -1)).toBe('章句ID无效');
    expect(validateNote('内容', ['修身'], 1.5)).toBe('章句ID无效');
    expect(validateNote('内容', ['修身'], 101)).toBeNull();
  });

  test('COM-023: verseId 缺省时不做校验（编辑场景）', () => {
    expect(validateNote('内容', ['修身'], undefined)).toBeNull();
  });
});

describe('publishNote 列表逻辑（COM-023 list）', () => {
  test('list: 返回列表并剔除 _openid（字段白名单）', async () => {
    const { db } = makeFakeDb({
      collections: { notes: { list: [makeNote()] } }
    });
    const res = await listNotes(db, { skip: 0, limit: 20, openId: 'me' });
    expect(res.code).toBe(0);
    expect(res.data.list).toHaveLength(1);
    const item = res.data.list[0];
    expect(item.id).toBe('n1');
    expect(item._openid).toBeUndefined();
    // 公开字段完整
    expect(item.verseOriginal).toBe('学而时习之');
    expect(item.likeCount).toBe(3);
  });

  test('list: 分页参数透传（skip/limit），limit 上限 50', async () => {
    const { db, calls } = makeFakeDb({
      collections: {
        notes: { list: Array.from({ length: 50 }, (_, i) => makeNote({ _id: `n${i}` })) }
      }
    });
    const res = await listNotes(db, { skip: 100, limit: 999, openId: 'me' });
    const skipEntry = calls.queries.find(c => c.collection === 'notes' && c.skip !== undefined);
    const limitEntry = calls.queries.find(c => c.collection === 'notes' && c.limit !== undefined);
    expect(skipEntry.skip).toBe(100);
    expect(limitEntry.limit).toBe(50);
    expect(res.data.list).toHaveLength(50);
  });

  test('list: hasMore 在恰好一页时返回 true，不足一页返回 false', async () => {
    const { db } = makeFakeDb({
      collections: { notes: { list: Array.from({ length: 20 }, (_, i) => makeNote({ _id: `n${i}` })) } }
    });
    const full = await listNotes(db, { skip: 0, limit: 20, openId: 'me' });
    expect(full.data.hasMore).toBe(true);

    const { db: db2 } = makeFakeDb({
      collections: { notes: { list: [makeNote()] } }
    });
    const partial = await listNotes(db2, { skip: 0, limit: 20, openId: 'me' });
    expect(partial.data.hasMore).toBe(false);
  });

  test('list: 点赞状态按当前用户 openid 标记 likedByMe', async () => {
    const { db } = makeFakeDb({
      collections: {
        notes: { list: [makeNote({ _id: 'n1' }), makeNote({ _id: 'n2' })] },
        notes_likes: { list: [{ noteId: 'n2' }] }
      }
    });
    const res = await listNotes(db, { skip: 0, limit: 20, openId: 'me' });
    const byId = Object.fromEntries(res.data.list.map((n: any) => [n.id, n.likedByMe]));
    expect(byId.n1).toBe(false);
    expect(byId.n2).toBe(true);
  });

  test('list: keyword 使用内容正则模糊匹配，verseId/tag 精确过滤', async () => {
    const { db, calls } = makeFakeDb({ collections: { notes: { list: [] } } });
    await listNotes(db, { skip: 0, limit: 20, keyword: '君子', verseId: 101, tag: '修身', openId: 'me' });
    const q = calls.queries.find(c => c.collection === 'notes').query;
    expect(q.verseId).toBe(101);
    expect(q.tags).toBe('修身');
    expect(q.content).toEqual({ __regexp: '君子', options: 'i' });
  });

  test('list: 无过滤条件时不附加多余查询字段', async () => {
    const { db, calls } = makeFakeDb({ collections: { notes: { list: [] } } });
    await listNotes(db, { skip: 0, limit: 20, openId: 'me' });
    const q = calls.queries.find(c => c.collection === 'notes').query;
    expect(q).toEqual({});
  });
});

describe('publishNote 点赞逻辑（COM-023 like/unlike）', () => {
  test('like: 首次点赞写入 notes_likes 并 likeCount +1', async () => {
    const { db, calls } = makeFakeDb({
      collections: { notes_likes: { list: [] } }
    });
    const res = await likeNote(db, 'me', 'n1');
    expect(res.message).toBe('点赞成功');
    const addCall = calls.add.find(c => c.collection === 'notes_likes');
    expect(addCall.data.noteId).toBe('n1');
    expect(addCall.data._openid).toBe('me');
    expect(addCall.data.createTime).toEqual({ __serverDate: true });
    const updateCall = calls.update.find(c => c.collection === 'notes');
    expect(updateCall.docId).toBe('n1');
    expect(updateCall.data.likeCount).toEqual({ __op: 'inc', n: 1 });
  });

  test('like: 重复点赞查重，不重复写入也不重复 +1', async () => {
    const { db, calls } = makeFakeDb({
      collections: { notes_likes: { list: [{ noteId: 'n1', _openid: 'me' }] } }
    });
    const res = await likeNote(db, 'me', 'n1');
    expect(res.message).toBe('已点赞过');
    expect(calls.add.filter(c => c.collection === 'notes_likes')).toHaveLength(0);
    expect(calls.update.filter(c => c.collection === 'notes')).toHaveLength(0);
  });

  test('unlike: 已点赞时删除记录并 likeCount -1', async () => {
    const { db, calls } = makeFakeDb({
      collections: { notes_likes: { list: [{ noteId: 'n1', _openid: 'me' }] } }
    });
    const res = await unlikeNote(db, 'me', 'n1');
    expect(res.message).toBe('已取消点赞');
    expect(calls.remove.filter(c => c.collection === 'notes_likes')).toHaveLength(1);
    const updateCall = calls.update.find(c => c.collection === 'notes');
    expect(updateCall.data.likeCount).toEqual({ __op: 'inc', n: -1 });
  });

  test('unlike: 未点赞过幂等返回，不删除也不减计数', async () => {
    const { db, calls } = makeFakeDb({
      collections: { notes_likes: { list: [] } }
    });
    const res = await unlikeNote(db, 'me', 'n1');
    expect(res.message).toBe('未点赞过');
    expect(calls.remove.filter(c => c.collection === 'notes_likes')).toHaveLength(0);
    expect(calls.update.filter(c => c.collection === 'notes')).toHaveLength(0);
  });
});

describe('publishNote 容错（notes_likes 集合缺失，COM 补充）', () => {
  test('like: notes_likes 集合缺失时返回可操作提示，不抛异常、不写库', async () => {
    const { db, calls } = makeFakeDb({
      collections: {
        notes_likes: { getError: new Error('collection not exists') }
      }
    });
    const res = await likeNote(db, 'me', 'n1');
    expect(res.code).toBe(-1);
    expect(res.message).toContain('notes_likes');
    // 不写入点赞记录、不改 likeCount，整个调用不抛未捕获异常
    expect(calls.add).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
  });

  test('unlike: notes_likes 集合缺失时返回可操作提示，不抛异常、不删不改', async () => {
    const { db, calls } = makeFakeDb({
      collections: {
        notes_likes: { getError: new Error('collection not exists') }
      }
    });
    const res = await unlikeNote(db, 'me', 'n1');
    expect(res.code).toBe(-1);
    expect(res.message).toContain('notes_likes');
    expect(calls.remove).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
  });

  test('list: notes_likes 集合缺失时仍返回列表，点赞状态降级为全部未赞', async () => {
    const { db } = makeFakeDb({
      collections: {
        notes: { list: [makeNote({ _id: 'n1' }), makeNote({ _id: 'n2' })] },
        notes_likes: { getError: new Error('collection not exists') }
      }
    });
    const res = await listNotes(db, { skip: 0, limit: 20, openId: 'me' });
    expect(res.code).toBe(0);
    expect(res.data.list).toHaveLength(2);
    expect(res.data.list.every((n: any) => n.likedByMe === false)).toBe(true);
  });
});

describe('publishNote 云函数入口（index.js main，P2-1）', () => {
  let main: any;
  let fakeDb: { db: any; calls: any };

  beforeEach(() => {
    fakeDb = makeFakeDb({ collections: { notes: { list: [] } } });
    __publishFakeDb = fakeDb.db;
    __msgSecResult = { result: { suggest: 'pass' } };
    jest.resetModules();
    main = require('../cloudfunctions/publishNote/index').main;
  });

  test('publish: verseId 缺失时拒绝（P2-1 前置拦截，validateNote 层放行 undefined）', async () => {
    const res = await main({ action: 'publish', content: '学习心得', tags: [] }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toBe('章句ID无效');
    expect(fakeDb.calls.add).toHaveLength(0);
  });

  test('publish: verseId 非整数/非正数拒绝', async () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      const res = await main({ action: 'publish', content: '心得', tags: [], verseId: bad }, {});
      expect(res.message).toBe('章句ID无效');
    }
    expect(fakeDb.calls.add).toHaveLength(0);
  });

  test('publish: authorName 超 20 字截断（P2-1）', async () => {
    const res = await main({
      action: 'publish', content: '心得', tags: [], verseId: 101,
      authorName: '名'.repeat(30)
    }, {});
    expect(res.code).toBe(0);
    expect(fakeDb.calls.add[0].data.authorName).toBe('名'.repeat(20));
  });

  test('publish: authorName 非字符串/空白回退默认「论语学习者」（P2-1）', async () => {
    for (const bad of [123, null, '   ', undefined]) {
      fakeDb = makeFakeDb({ collections: { notes: { list: [] } } });
      __publishFakeDb = fakeDb.db;
      jest.resetModules();
      main = require('../cloudfunctions/publishNote/index').main;
      const res = await main({
        action: 'publish', content: '心得', tags: [], verseId: 101, authorName: bad
      }, {});
      expect(res.code).toBe(0);
      expect(fakeDb.calls.add[0].data.authorName).toBe('论语学习者');
    }
  });

  test('publish: 合法发布成功，写入 verseId 与规范化字段', async () => {
    const res = await main({
      action: 'publish', content: '学习心得', tags: ['修身', '学习'], verseId: 101,
      verseOriginal: '学而时习之', chapterTitle: '学而第一', authorName: ' 用户名 '
    }, {});
    expect(res.code).toBe(0);
    expect(res.data.id).toBeTruthy();
    const doc = fakeDb.calls.add[0].data;
    expect(doc.verseId).toBe(101);
    expect(doc._openid).toBe('me');
    expect(doc.authorName).toBe('用户名'); // trim 后入库
    expect(doc.content).toBe('学习心得');
    expect(doc.likeCount).toBe(0);
  });

  test('publish: 内容安全检查命中 risky 时拒绝发布', async () => {
    __msgSecResult = { result: { suggest: 'risky' } };
    jest.resetModules();
    main = require('../cloudfunctions/publishNote/index').main;
    const res = await main({
      action: 'publish', content: '违规内容', tags: [], verseId: 101
    }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toContain('不合适');
    expect(fakeDb.calls.add).toHaveLength(0);
  });

  test('unpublish: 非作者操作被拒绝（_openid 校验）', async () => {
    fakeDb = makeFakeDb({
      collections: { notes: { doc: { n1: { _openid: 'someone_else' } } } }
    });
    __publishFakeDb = fakeDb.db;
    jest.resetModules();
    main = require('../cloudfunctions/publishNote/index').main;
    const res = await main({ action: 'unpublish', noteId: 'n1' }, {});
    expect(res.code).toBe(-1);
    expect(res.message).toBe('无权操作');
  });
});
