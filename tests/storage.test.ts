/**
 * 数据存储与状态管理测试
 * 对应测试用例: DAT-001 ~ DAT-008 / VSD-005 / VSD-006 / VSD-007 / HOME-005 / MNE-002
 */
import Taro from '@tarojs/taro';
import {
  getProgress,
  markVerseRead,
  addNote,
  isVerseRead,
  saveProgress,
  mergeProgress,
  hasProgressData,
  clearAnonymousProgress,
  deleteNote,
  updateNote,
  getNoteById
} from '@/utils/storage';

// 内部存储引用，用于断言持久化
const getStore = () => (Taro as any).__store__ as Record<string, any>;
const STORAGE_KEY = 'lunyu_progress';

describe('存储基础 (DAT-007)', () => {
  // DAT-007: 存储异常兜底
  test('DAT-007 [P1]: 存储为空时返回默认空进度', () => {
    const p = getProgress();
    expect(p.readVerseIds).toEqual([]);
    expect(p.myNotes).toEqual([]);
    expect(p.totalReadDays).toBe(1);
  });

  test('DAT-007 [P1]: 存储数据损坏（非对象）时回退到默认值', () => {
    getStore()[STORAGE_KEY] = 'not_an_object';
    const p = getProgress();
    expect(p).toBeDefined();
    expect(Array.isArray(p.readVerseIds)).toBe(true);
  });

  test('saveProgress → getProgress 往返一致', () => {
    const data = {
      readVerseIds: [101, 102],
      myNotes: [],
      totalReadDays: 3
    };
    saveProgress(data);
    const p = getProgress();
    expect(p.readVerseIds).toEqual([101, 102]);
    expect(p.totalReadDays).toBe(3);
  });
});

describe('已读标记 (DAT-001 / DAT-002 / VSD-005 / VSD-006 / VSD-007)', () => {
  // VSD-005: 标记已读
  test('VSD-005 [P0]: markVerseRead 写入 readVerseIds', () => {
    const p = markVerseRead(101);
    expect(p.readVerseIds).toContain(101);
    expect(isVerseRead(101)).toBe(true);
  });

  // DAT-001: 持久化
  test('DAT-001 [P0]: 已读标记持久化到 Taro 存储', () => {
    markVerseRead(102);
    const stored = getStore()[STORAGE_KEY];
    expect(stored.readVerseIds).toContain(102);
    // 模拟重新打开：getProgress 重新读取
    const p = getProgress();
    expect(p.readVerseIds).toContain(102);
  });

  // DAT-002: 已读去重
  test('DAT-002 [P1]: 同一章句重复标记已读不重复', () => {
    markVerseRead(103);
    markVerseRead(103);
    markVerseRead(103);
    const p = getProgress();
    const occurrences = p.readVerseIds.filter(id => id === 103).length;
    expect(occurrences).toBe(1);
  });

  // VSD-006: 已读状态保持
  test('VSD-006 [P0]: 已读状态在重新读取后保持', () => {
    markVerseRead(104);
    // 重新读取（模拟跨页面/重开）
    expect(getProgress().readVerseIds).toContain(104);
    expect(getProgress().readVerseIds).toContain(104);
  });

  // VSD-007: 已读再次标记不会取消
  test('VSD-007 [P1]: 已读时再次点击不取消已读', () => {
    markVerseRead(105);
    expect(isVerseRead(105)).toBe(true);
    markVerseRead(105);
    expect(isVerseRead(105)).toBe(true); // 仍为已读
  });

  // HOME-005: 多个已读统计
  test('HOME-005 [P0]: 标记多个章句后 readVerseIds 数量正确', () => {
    [201, 202, 203].forEach(id => markVerseRead(id));
    const p = getProgress();
    expect(p.readVerseIds).toEqual(expect.arrayContaining([201, 202, 203]));
    // 每个测试相互隔离（beforeEach 清空存储），本用例仅标记 3 条
    expect(p.readVerseIds.length).toBe(3);
  });
});

describe('笔记功能 (DAT-005 / DAT-006 / WTN-008)', () => {
  // WTN-008 / DAT-005: 笔记持久化
  test('WTN-008/DAT-005 [P0]: addNote 写入并持久化', () => {
    const p = addNote(101, '测试心得内容1');
    expect(p.myNotes).toHaveLength(1);
    expect(p.myNotes[0].verseId).toBe(101);
    expect(p.myNotes[0].content).toBe('测试心得内容1');
    expect(p.myNotes[0].id).toBeGreaterThan(0);
    expect(p.myNotes[0].createTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    // 持久化
    expect(getStore()[STORAGE_KEY].myNotes).toHaveLength(1);
  });

  // DAT-006: 笔记倒序排序（最新在前）
  test('DAT-006 [P1]: 多条笔记按倒序排列（最新在前）', async () => {
    // 通过修改 Date.now 控制顺序
    const realNow = Date.now;
    let t = 1000;
    Date.now = () => (t += 1000);
    try {
      addNote(101, '第一条');
      addNote(102, '第二条');
      addNote(103, '第三条');
    } finally {
      Date.now = realNow;
    }
    const p = getProgress();
    expect(p.myNotes[0].content).toBe('第三条');
    expect(p.myNotes[1].content).toBe('第二条');
    expect(p.myNotes[2].content).toBe('第一条');
  });

  // MNE-002: 笔记与已读同时统计
  test('MNE-002 [P0]: 笔记与已读统计独立', () => {
    const before = getProgress();
    const readCountBefore = before.readVerseIds.length;
    const noteCountBefore = before.myNotes.length;
    markVerseRead(301);
    addNote(301, '新增心得');
    const after = getProgress();
    expect(after.readVerseIds.length).toBe(readCountBefore + 1);
    expect(after.myNotes.length).toBe(noteCountBefore + 1);
  });
});

describe('跨页面状态同步 (DAT-008)', () => {
  // DAT-008: 同一 storage key 保证跨页同步
  test('DAT-008 [P0]: 多次 getProgress 返回最新状态', () => {
    markVerseRead(401);
    const p1 = getProgress();
    expect(p1.readVerseIds).toContain(401);
    markVerseRead(402);
    const p2 = getProgress();
    expect(p2.readVerseIds).toContain(401);
    expect(p2.readVerseIds).toContain(402);
  });
});

describe('进度合并（登录后本地与云端合并）', () => {
  test('mergeProgress: 已读章句取并集', () => {
    const local = { readVerseIds: [101, 102], myNotes: [], totalReadDays: 1 };
    const cloud = { readVerseIds: [102, 103], myNotes: [], totalReadDays: 2 };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.readVerseIds.sort((a, b) => a - b)).toEqual([101, 102, 103]);
  });

  test('mergeProgress: 已读章句超 200 条不裁剪（B1 回归锁定：已读进度不丢失）', () => {
    // Hermes 审查报告 V2 的 B1 疑点：怀疑 readVerseIds 被 TRIM_THRESHOLD=200 裁剪导致数据丢失。
    // 实际实现只裁剪点赞/删除标记数组，readVerseIds 恒取并集——此用例锁定该行为，防止回归。
    const manyReads = Array.from({ length: 250 }, (_, i) => 101 + i); // 101..350
    const local = { readVerseIds: manyReads, myNotes: [], totalReadDays: 30 };
    const cloud = { readVerseIds: [509, 510], myNotes: [], totalReadDays: 31 };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.readVerseIds).toHaveLength(252); // 250 + 2 并集，未被裁到 200
    expect(merged.readVerseIds).toEqual(expect.arrayContaining([101, 350, 509, 510]));
  });

  test('mergeProgress: 点赞/删除标记数组超 200 条时裁剪（裁剪仅限标记，不涉及已读）', () => {
    const manyLikes = Array.from({ length: 250 }, (_, i) => `note_${i}`);
    const local = { readVerseIds: [], myNotes: [], likedNoteIds: manyLikes, unlikedNoteIds: [], deletedNoteIds: [] };
    const cloud = { readVerseIds: [], myNotes: [], likedNoteIds: [], unlikedNoteIds: [], deletedNoteIds: [] };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.likedNoteIds).toHaveLength(200); // 裁剪生效（当前设计仅限标记数组）
  });

  test('mergeProgress: 笔记按 id 合并去重', () => {
    const local = { readVerseIds: [], myNotes: [{ id: 1, verseId: 101, content: '本地', createTime: '2026-07-29' }], totalReadDays: 1 };
    const cloud = { readVerseIds: [], myNotes: [{ id: 2, verseId: 102, content: '云端', createTime: '2026-07-28' }], totalReadDays: 1 };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.myNotes).toHaveLength(2);
    // 倒序排列（最新在前）
    expect(merged.myNotes[0].id).toBe(2);
    expect(merged.myNotes[1].id).toBe(1);
  });

  test('mergeProgress: 连续学习天数取较大值', () => {
    const local = { readVerseIds: [], myNotes: [], totalReadDays: 5 };
    const cloud = { readVerseIds: [], myNotes: [], totalReadDays: 3 };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.totalReadDays).toBe(5);
  });

  test('mergeProgress: lastReadDate 一方为 undefined 时取存在的一方（修复 NaN bug）', () => {
    // 云端有日期、本地为 undefined（旧 bug 会返回 undefined）
    const local = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: undefined };
    const cloud = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: '2026-07-29' };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.lastReadDate).toBe('2026-07-29');

    // 本地有日期、云端为 undefined
    const local2 = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: '2026-07-30' };
    const cloud2 = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: undefined };
    const merged2 = mergeProgress(local2 as any, cloud2 as any);
    expect(merged2.lastReadDate).toBe('2026-07-30');
  });

  test('mergeProgress: 两方都有 lastReadDate 时取较新', () => {
    const local = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: '2026-07-28' };
    const cloud = { readVerseIds: [], myNotes: [], totalReadDays: 1, lastReadDate: '2026-07-30' };
    const merged = mergeProgress(local as any, cloud as any);
    expect(merged.lastReadDate).toBe('2026-07-30');
  });

  test('mergeProgress: 字段缺失时安全合并（空数组兜底）', () => {
    const local = { totalReadDays: 2, lastReadDate: '2026-08-08' } as any;
    const cloud = {
      readVerseIds: [101],
      myNotes: [{ id: 1, verseId: 101, content: 'x', createTime: '2026-08-08' }]
    } as any;
    const merged = mergeProgress(local, cloud);
    expect(merged.readVerseIds).toEqual([101]);
    expect(merged.myNotes).toHaveLength(1);
    expect(merged.totalReadDays).toBe(2);
    expect(merged.lastReadDate).toBe('2026-08-08');
  });

  test('hasProgressData: 正确识别空与非空进度', () => {
    expect(hasProgressData({ readVerseIds: [], myNotes: [], totalReadDays: 1 } as any)).toBe(false);
    expect(hasProgressData({ readVerseIds: [101], myNotes: [], totalReadDays: 1 } as any)).toBe(true);
    expect(hasProgressData({ readVerseIds: [], myNotes: [{ id: 1, verseId: 1, content: 'x', createTime: '2026-07-29' }], totalReadDays: 1 } as any)).toBe(true);
  });

  test('clearAnonymousProgress: 清除默认 key 数据', () => {
    markVerseRead(501);
    expect(getStore()[STORAGE_KEY]).toBeTruthy();
    clearAnonymousProgress();
    expect(getStore()[STORAGE_KEY]).toBeUndefined();
  });
});

describe('笔记编辑与删除 (WTN-009 / WTN-010)', () => {
  test('WTN-009 [P0]: updateNote 更新笔记内容并持久化', () => {
    const p = addNote(101, '原始心得内容');
    const noteId = p.myNotes[0].id;
    updateNote(noteId, '更新后的心得内容', ['学习感悟']);
    const updated = getNoteById(noteId);
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe('更新后的心得内容');
    expect(updated!.tags).toEqual(['学习感悟']);
    // 持久化验证
    expect(getStore()[STORAGE_KEY].myNotes[0].content).toBe('更新后的心得内容');
  });

  test('WTN-009 [P1]: updateNote 不存在的笔记抛异常', () => {
    expect(() => updateNote(999999, '不存在')).toThrow('笔记不存在');
  });

  test('WTN-010 [P0]: deleteNote 删除笔记并持久化', () => {
    const p = addNote(102, '待删除心得');
    const noteId = p.myNotes[0].id;
    expect(getProgress().myNotes.length).toBeGreaterThan(0);
    deleteNote(noteId);
    expect(getNoteById(noteId)).toBeNull();
    expect(getProgress().myNotes.find(n => n.id === noteId)).toBeUndefined();
  });

  test('WTN-010 [P1]: deleteNote 后其他笔记不受影响', () => {
    const p1 = addNote(101, '心得A');
    const p2 = addNote(102, '心得B');
    const idA = p1.myNotes[0].id;
    const idB = p2.myNotes[0].id;
    deleteNote(idA);
    expect(getNoteById(idA)).toBeNull();
    expect(getNoteById(idB)).not.toBeNull();
    expect(getNoteById(idB)!.content).toBe('心得B');
  });

  test('getNoteById: 返回正确笔记', () => {
    const p = addNote(103, '查询测试');
    const noteId = p.myNotes[0].id;
    const note = getNoteById(noteId);
    expect(note).not.toBeNull();
    expect(note!.verseId).toBe(103);
    expect(note!.content).toBe('查询测试');
  });

  test('getNoteById: 不存在的 id 返回 null', () => {
    expect(getNoteById(999999)).toBeNull();
  });
});

describe('存储异常与容错分支 (DAT-007 扩展)', () => {
  test('getProgress: getStorageSync 抛异常时回退默认值并记录错误', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'getStorageSync').mockImplementation(() => {
      throw new Error('storage broken');
    });
    try {
      const p = getProgress();
      expect(p.readVerseIds).toEqual([]);
      expect(p.myNotes).toEqual([]);
      expect(p.totalReadDays).toBe(1);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('getProgress failed'), expect.anything());
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test('saveProgress: setStorageSync 抛异常时返回 false 并记录错误', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'setStorageSync').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      const ok = saveProgress({ readVerseIds: [], myNotes: [], totalReadDays: 1 } as any);
      expect(ok).toBe(false);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('saveProgress failed'), expect.anything());
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test('clearAnonymousProgress: removeStorageSync 抛异常时不向上抛出', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'removeStorageSync').mockImplementation(() => {
      throw new Error('remove failed');
    });
    try {
      expect(() => clearAnonymousProgress()).not.toThrow();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('clearAnonymousProgress failed'), expect.anything());
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test('getProgress: 字段类型异常时规范化为默认值', () => {
    getStore()[STORAGE_KEY] = {
      readVerseIds: 'oops',
      myNotes: 'nope',
      totalReadDays: '5',
      lastReadDate: '2026-08-08'
    };
    const p = getProgress();
    expect(p.readVerseIds).toEqual([]);
    expect(p.myNotes).toEqual([]);
    expect(p.totalReadDays).toBe(1);
    expect(p.lastReadDate).toBe('2026-08-08');
  });
});

describe('学习天数连续逻辑（totalReadDays）', () => {
  test('昨天学习过 → 连续天数 +1', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-09T12:00:00'));
    try {
      getStore()[STORAGE_KEY] = {
        readVerseIds: [100],
        myNotes: [],
        totalReadDays: 3,
        lastReadDate: '2026-08-08'
      };
      const p = markVerseRead(101);
      expect(p.totalReadDays).toBe(4);
      expect(p.lastReadDate).toBe('2026-08-09');
      expect(p.readVerseIds).toEqual([100, 101]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('学习中断（间隔超过一天）→ 天数重置为 1', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-09T12:00:00'));
    try {
      getStore()[STORAGE_KEY] = {
        readVerseIds: [],
        myNotes: [],
        totalReadDays: 10,
        lastReadDate: '2026-08-06'
      };
      const p = markVerseRead(101);
      expect(p.totalReadDays).toBe(1);
      expect(p.lastReadDate).toBe('2026-08-09');
    } finally {
      jest.useRealTimers();
    }
  });

  test('同一天重复学习 → 天数不变', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-09T12:00:00'));
    try {
      getStore()[STORAGE_KEY] = {
        readVerseIds: [],
        myNotes: [],
        totalReadDays: 5,
        lastReadDate: '2026-08-09'
      };
      const p = markVerseRead(101);
      expect(p.totalReadDays).toBe(5);
      expect(p.lastReadDate).toBe('2026-08-09');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('保存失败时的异常处理', () => {
  test('addNote: 保存失败抛异常', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'setStorageSync').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      expect(() => addNote(101, '内容')).toThrow('保存失败，请重试');
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test('updateNote: 保存失败抛异常', () => {
    const p = addNote(101, '先创建一条笔记');
    const noteId = p.myNotes[0].id;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'setStorageSync').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      expect(() => updateNote(noteId, '新内容')).toThrow('保存失败，请重试');
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  test('deleteNote: 保存失败抛异常', () => {
    const p = addNote(101, '先创建一条笔记');
    const noteId = p.myNotes[0].id;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(Taro, 'setStorageSync').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      expect(() => deleteNote(noteId)).toThrow('删除失败，请重试');
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe('删除/取消的跨端同步防复活（tombstone）', () => {
  test('deleteNote 记录删除标记，避免云端旧数据合并复活', () => {
    const p = addNote(101, '待删除');
    const noteId = p.myNotes[0].id;
    const after = deleteNote(noteId);
    expect(after.myNotes).toHaveLength(0);
    expect(after.deletedNoteIds).toContain(noteId);
    expect(getProgress().deletedNoteIds).toContain(noteId);
  });

  test('mergeProgress: 删除标记过滤云端笔记（防复活）', () => {
    const local = { readVerseIds: [], myNotes: [], totalReadDays: 1, deletedNoteIds: [1] } as any;
    const cloud = { readVerseIds: [], myNotes: [{ id: 1, verseId: 101, content: '云端的旧笔记', createTime: '2026-08-01' }], totalReadDays: 1 } as any;
    const merged = mergeProgress(local, cloud);
    expect(merged.myNotes).toHaveLength(0);
    expect(merged.deletedNoteIds).toContain(1);
  });

  test('mergeProgress: 删除/取消标记跨端取并集', () => {
    const local = { readVerseIds: [], myNotes: [], totalReadDays: 1, deletedNoteIds: [1] } as any;
    const cloud = { readVerseIds: [], myNotes: [], totalReadDays: 1, deletedNoteIds: [2] } as any;
    const merged = mergeProgress(local, cloud);
    expect(merged.deletedNoteIds!.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  test('hasProgressData: 仅含删除标记时视为有数据（保证登录后可传播）', () => {
    expect(hasProgressData({ readVerseIds: [], myNotes: [], totalReadDays: 1, deletedNoteIds: [1] } as any)).toBe(true);
  });
});
