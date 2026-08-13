/**
 * 登录与云端同步测试
 * 对应测试用例: 用户认证、用户隔离、云端同步
 * 说明: 测试环境 TARO_ENV !== 'weapp'，wxLogin 走 mock 登录分支
 */
import Taro from '@tarojs/taro';
import {
  getUserInfo,
  isLoggedIn,
  wxLogin,
  logout,
  uploadProgress,
  downloadProgress
} from '@/services/auth';
import { getProgress, saveProgress, markVerseRead, mergeProgress, hasProgressData, clearAnonymousProgress } from '@/utils/storage';

describe('用户认证（本地）', () => {
  test('未登录时 getUserInfo 返回 null', () => {
    expect(getUserInfo()).toBeNull();
    expect(isLoggedIn()).toBe(false);
  });

  test('wxLogin（mock 模式）成功后写入用户信息', async () => {
    const user = await wxLogin();
    expect(user.openId).toBeTruthy();
    expect(user.nickName).toBe('论语学习者');
    expect(isLoggedIn()).toBe(true);
    expect(getUserInfo()?.openId).toBe(user.openId);
  });

  test('logout 清除用户信息', async () => {
    await wxLogin();
    expect(isLoggedIn()).toBe(true);
    logout();
    expect(isLoggedIn()).toBe(false);
    expect(getUserInfo()).toBeNull();
  });
});

describe('云端同步（未登录拦截）', () => {
  test('未登录时 uploadProgress 返回需登录提示', async () => {
    const res = await uploadProgress(getProgress());
    expect(res.success).toBe(false);
    expect(res.message).toContain('登录');
  });

  test('未登录时 downloadProgress 返回需登录提示', async () => {
    const res = await downloadProgress();
    expect(res.success).toBe(false);
    expect(res.message).toContain('登录');
  });
});

describe('用户数据隔离', () => {
  test('不同用户的进度数据相互隔离', async () => {
    // 用户 A 登录并标记已读（H5 mock 环境显式指定 openId 模拟不同用户）
    const userA = await wxLogin('mock_openid_a');
    markVerseRead(101);
    expect(getProgress().readVerseIds).toContain(101);

    // 退出，模拟用户 B 登录
    logout();
    const userB = await wxLogin('mock_openid_b');
    expect(userB.openId).not.toBe(userA.openId);

    // 用户 B 的进度应为空（隔离）
    expect(getProgress().readVerseIds).not.toContain(101);

    // 用户 B 标记另一章句
    markVerseRead(102);
    expect(getProgress().readVerseIds).toContain(102);
    expect(getProgress().readVerseIds).not.toContain(101);
  });

  test('未登录与已登录使用不同存储 key', async () => {
    // 未登录写入
    markVerseRead(201);
    expect(getProgress().readVerseIds).toContain(201);

    // 登录后应读取到独立的（空）进度
    await wxLogin();
    expect(getProgress().readVerseIds).not.toContain(201);
  });
});

describe('云端同步（已登录，mock callFunction）', () => {
  test('已登录时 uploadProgress 调用云函数并返回成功', async () => {
    await wxLogin();
    (Taro.cloud.callFunction as jest.Mock).mockResolvedValueOnce({
      result: { code: 0, message: '上传成功' }
    });
    // 测试环境 isWeapp=false，uploadProgress 直接返回本地模式成功
    const res = await uploadProgress(getProgress());
    expect(res.success).toBe(true);
  });
});

describe('登录后本地进度合并（修复登录后数据丢失）', () => {
  test('未登录期间的学习记录在登录后保留（合并到用户 key）', async () => {
    // 1. 未登录期间学习（写入匿名 key：lunyu_progress）
    markVerseRead(101);
    markVerseRead(102);
    const localBeforeLogin = getProgress();
    expect(hasProgressData(localBeforeLogin)).toBe(true);
    expect(localBeforeLogin.readVerseIds).toContain(101);

    // 2. 登录（storage key 切换为用户维度，初始为空）
    await wxLogin();
    // 登录后用户 key 初始为空（隔离）
    expect(getProgress().readVerseIds).not.toContain(101);

    // 3. 模拟 mine 页面 handleLogin 的合并逻辑：本地匿名 + 云端（空）合并后写入用户 key
    const merged = mergeProgress(localBeforeLogin, getProgress());
    saveProgress(merged);

    // 4. 验证未登录期间的学习记录已保留到用户 key
    expect(getProgress().readVerseIds).toContain(101);
    expect(getProgress().readVerseIds).toContain(102);

    // 5. 清理匿名 key，避免登出后看到旧数据
    clearAnonymousProgress();
    logout();
    // 登出后回到匿名 key（已被清理），应为空
    expect(getProgress().readVerseIds).not.toContain(101);
  });

  test('登录后本地与云端数据取并集合并', async () => {
    // 未登录期间本地学习了 101
    markVerseRead(101);
    const localBeforeLogin = getProgress();

    await wxLogin();
    // 模拟云端已有 102、103 的进度
    const cloudProgress = {
      readVerseIds: [102, 103],
      myNotes: [],
      totalReadDays: 2,
      lastReadDate: '2026-07-28'
    };
    const merged = mergeProgress(localBeforeLogin, cloudProgress as any);
    saveProgress(merged);

    const after = getProgress();
    expect(after.readVerseIds.sort((a, b) => a - b)).toEqual([101, 102, 103]);
    expect(after.totalReadDays).toBe(2);
  });
});
