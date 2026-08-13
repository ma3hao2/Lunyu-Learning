/**
 * 手动双向同步 syncProgressNow 测试（src/services/sync.ts）
 *
 * sync.ts 依赖 auth（downloadProgress/uploadProgress）与 storage（真实实现），
 * 这里 mock auth、使用真实 storage（Taro mock 内存存储），TARO_ENV=weapp 走云分支。
 *
 * 覆盖：双向同步合并 / 下载失败仍上传 / 上传失败提示 / 并发保护（syncInFlight 复用）
 */
process.env.TARO_ENV = 'weapp';
// 变量名唯一（不与其他测试文件共用同名顶层变量），避免 ts-jest 全 program 检查时 TS2451 重复声明
const originalSyncEnv = process.env.TARO_ENV;

let sync: any;
let auth: { downloadProgress: jest.Mock; uploadProgress: jest.Mock; getUserInfo: jest.Mock };

beforeEach(() => {
  jest.resetModules();
  jest.doMock('@/services/auth', () => ({
    downloadProgress: jest.fn(),
    uploadProgress: jest.fn(),
    getUserInfo: jest.fn()
  }));
  auth = require('@/services/auth');
  sync = require('@/services/sync');
  // 未登录：抑制 saveProgress 触发的 3 秒防抖自动上传（避免与手动同步混在一起）
  auth.getUserInfo.mockReturnValue(null);
});

afterAll(() => {
  process.env.TARO_ENV = originalSyncEnv;
});

describe('手动双向同步（syncProgressNow）', () => {
  test('下载成功：合并云端与本地后上传合并结果，返回「同步成功」', async () => {
    const { markVerseRead, getProgress } = require('@/utils/storage');
    markVerseRead(101); // 本地已读 101
    auth.downloadProgress.mockResolvedValue({ success: true, data: { readVerseIds: [102], myNotes: [], totalReadDays: 1 } });
    auth.uploadProgress.mockResolvedValue({ success: true, message: '同步成功' });

    const res = await sync.syncProgressNow();

    expect(res).toEqual({ success: true, message: '同步成功' });
    // 合并结果已写回本地（101 ∪ 102）
    expect(getProgress().readVerseIds.sort((a: number, b: number) => a - b)).toEqual([101, 102]);
    // 上传的是合并结果
    const uploaded = auth.uploadProgress.mock.calls[0][0];
    expect(uploaded.readVerseIds.sort((a: number, b: number) => a - b)).toEqual([101, 102]);
  });

  test('下载无数据（data null）：跳过合并，仍上传本地数据', async () => {
    const { markVerseRead } = require('@/utils/storage');
    markVerseRead(101);
    auth.downloadProgress.mockResolvedValue({ success: true, data: null });
    auth.uploadProgress.mockResolvedValue({ success: true, message: '同步成功' });

    const res = await sync.syncProgressNow();

    expect(res.success).toBe(true);
    expect(auth.uploadProgress.mock.calls[0][0].readVerseIds).toEqual([101]);
  });

  test('下载失败：仍上传本地数据，返回 success=false 降级提示', async () => {
    const { markVerseRead } = require('@/utils/storage');
    markVerseRead(101);
    auth.downloadProgress.mockResolvedValue({ success: false, message: '网络错误，拉取失败' });
    auth.uploadProgress.mockResolvedValue({ success: true, message: '同步成功' });

    const res = await sync.syncProgressNow();

    expect(res).toEqual({ success: false, message: '云端拉取失败，仅上传本地数据' });
    expect(auth.uploadProgress).toHaveBeenCalledTimes(1);
  });

  test('上传失败：返回失败与错误信息', async () => {
    auth.downloadProgress.mockResolvedValue({ success: true, data: null });
    auth.uploadProgress.mockResolvedValue({ success: false, message: '上传失败' });

    const res = await sync.syncProgressNow();

    expect(res).toEqual({ success: false, message: '上传失败' });
  });

  test('并发保护：同步进行中重复调用复用同一 Promise，完成后可重新发起', async () => {
    let resolveDl: (v: any) => void;
    auth.downloadProgress.mockReturnValue(new Promise(r => { resolveDl = r; }));
    auth.uploadProgress.mockResolvedValue({ success: true, message: '同步成功' });

    const p1 = sync.syncProgressNow();
    const p2 = sync.syncProgressNow();
    expect(p2).toBe(p1); // 复用进行中的同步

    resolveDl!({ success: true, data: null });
    await p1;
    expect(auth.downloadProgress).toHaveBeenCalledTimes(1);
    expect(auth.uploadProgress).toHaveBeenCalledTimes(1);

    // 完成后重新发起（syncInFlight 已复位）
    const p3 = sync.syncProgressNow();
    expect(p3).not.toBe(p1);
    await p3;
    expect(auth.downloadProgress).toHaveBeenCalledTimes(2);
  });
});
