/**
 * 云端同步防抖测试（TARO_ENV = weapp）
 *
 * 说明：storage.ts 在模块加载时根据 TARO_ENV 决定是否启用云端同步，
 * 因此本文件在加载 storage 前设置环境变量，并用 jest.resetModules 保证
 * 每个用例都拿到启用云同步的全新模块实例。
 */
process.env.TARO_ENV = 'weapp';
const originalEnv = process.env.TARO_ENV;

let storage: any;
let auth: { getUserInfo: jest.Mock; uploadProgress: jest.Mock };

beforeEach(() => {
  jest.resetModules();
  jest.doMock('@/services/auth', () => ({
    getUserInfo: jest.fn(),
    uploadProgress: jest.fn()
  }));
  auth = require('@/services/auth');
  storage = require('@/utils/storage');
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  // 恢复环境变量，避免影响同一 worker 中后续测试文件（auth.ts 等按 TARO_ENV 分支）
  process.env.TARO_ENV = originalEnv;
});

const emptyProgress = {
  readVerseIds: [],
  myNotes: [],
  totalReadDays: 1
};

describe('云端同步（weapp 环境）', () => {
  test('未登录时保存进度不触发上传', async () => {
    auth.getUserInfo.mockReturnValue(null);
    auth.uploadProgress.mockResolvedValue({ success: true });

    storage.saveProgress(emptyProgress);
    await jest.advanceTimersByTimeAsync(4000);

    expect(auth.uploadProgress).not.toHaveBeenCalled();
  });

  test('已登录时保存进度在 3 秒防抖后上传最新进度', async () => {
    auth.getUserInfo.mockReturnValue({ openId: 'openid_1', nickName: '测试用户' });
    auth.uploadProgress.mockResolvedValue({ success: true, message: '同步成功' });

    storage.saveProgress({ ...emptyProgress, readVerseIds: [101] });
    expect(auth.uploadProgress).not.toHaveBeenCalled(); // 防抖期内不调用

    await jest.advanceTimersByTimeAsync(3000);
    expect(auth.uploadProgress).toHaveBeenCalledTimes(1);
    expect(auth.uploadProgress).toHaveBeenCalledWith(
      expect.objectContaining({ readVerseIds: [101] })
    );
  });

  test('3 秒内多次保存只上传一次且为最新数据（防抖合并）', async () => {
    auth.getUserInfo.mockReturnValue({ openId: 'openid_1' });
    auth.uploadProgress.mockResolvedValue({ success: true });

    storage.saveProgress({ ...emptyProgress, readVerseIds: [101] });
    await jest.advanceTimersByTimeAsync(1000);
    storage.saveProgress({ ...emptyProgress, readVerseIds: [102] });
    await jest.advanceTimersByTimeAsync(1000);
    storage.saveProgress({ ...emptyProgress, readVerseIds: [103] });
    await jest.advanceTimersByTimeAsync(3000);

    expect(auth.uploadProgress).toHaveBeenCalledTimes(1);
    expect(auth.uploadProgress.mock.calls[0][0].readVerseIds).toEqual([103]);
  });

  test('上传失败时静默记录警告，不向上抛出', async () => {
    auth.getUserInfo.mockReturnValue({ openId: 'openid_1' });
    auth.uploadProgress.mockRejectedValue(new Error('网络错误'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      storage.saveProgress(emptyProgress);
      await expect(jest.advanceTimersByTimeAsync(3000)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('云端同步失败'),
        expect.any(Error)
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('设置中关闭自动同步时保存进度不触发上传', async () => {
    const Taro = require('@tarojs/taro');
    Taro.setStorageSync('lunyu_settings', { autoSync: false });
    auth.getUserInfo.mockReturnValue({ openId: 'openid_1' });
    auth.uploadProgress.mockResolvedValue({ success: true });

    storage.saveProgress(emptyProgress);
    await jest.advanceTimersByTimeAsync(4000);

    expect(auth.uploadProgress).not.toHaveBeenCalled();
  });
});
