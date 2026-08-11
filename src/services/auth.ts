import Taro from '@tarojs/taro';
import { UserInfo, LearningProgress, SyncResult, PublishedNote } from '@/types';
import {
  clearPendingSync,
  getProgress,
  saveProgress,
  mergeProgress,
  hasProgressData,
  clearAnonymousProgress
} from '@/utils/storage';

const USER_KEY = 'lunyu_user';
const isWeapp = process.env.TARO_ENV === 'weapp';

// ============================================
// 用户信息管理
// ============================================

// 获取本地缓存的用户信息
export function getUserInfo(): UserInfo | null {
  try {
    const data = Taro.getStorageSync(USER_KEY);
    if (data && typeof data === 'object' && data.openId) {
      return data as UserInfo;
    }
  } catch (e) {
    console.error('[Auth] getUserInfo failed:', e);
  }
  return null;
}

// 保存用户信息到本地
function saveUserInfo(user: UserInfo): void {
  try {
    Taro.setStorageSync(USER_KEY, user);
  } catch (e) {
    console.error('[Auth] saveUserInfo failed:', e);
  }
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  return getUserInfo() !== null;
}

// 退出登录
export function logout(): void {
  // 先清理待执行的云端同步定时器，防止旧用户进度上传到新用户云端（跨用户数据串写）
  clearPendingSync();
  try {
    Taro.removeStorageSync(USER_KEY);
  } catch (e) {
    console.error('[Auth] logout failed:', e);
  }
}

// ============================================
// 微信登录
// ============================================

/**
 * 微信一键登录
 * 流程：云函数 login -> 通过 wxContext.OPENID 自动获取 openId + 创建/获取用户记录
 * （云开发环境下 OPENID 由平台自动注入，无需前端用 code 换取）
 */
export async function wxLogin(): Promise<UserInfo> {
  if (!isWeapp) {
    // H5 环境模拟登录（开发调试用）
    return mockLogin();
  }

  // 调用云函数换取 openId 并创建/获取用户记录
  const res = await Taro.cloud.callFunction({
    name: 'login',
    data: {}
  });

  const result = res.result as { code: number; message: string; data: UserInfo };
  if (result.code !== 0) {
    throw new Error(result.message || '登录失败');
  }

  // 保存用户信息到本地
  const user = result.data;
  saveUserInfo(user);
  return user;
}

/**
 * 静默登录 + 合并数据（App 启动/首次进入时自动调用，无感）
 * 已登录直接返回；未登录则登录，并三路合并：匿名进度 + 用户key本地进度 + 云端进度。
 * 任何失败均静默返回 null，不打扰用户（数据仍留在各自 key 下，不丢失）。
 */
export async function silentLoginAndMerge(): Promise<UserInfo | null> {
  const cached = getUserInfo();
  if (cached) return cached;

  try {
    // 登录前捕获匿名 key（lunyu_progress）下的本地进度
    const localBeforeLogin = getProgress();
    const hasLocal = hasProgressData(localBeforeLogin);

    const u = await wxLogin();

    // 登录后 getProgress 已切换为用户专属 key，读取该用户本地进度
    const userLocalProgress = getProgress();
    const hasUserLocal = hasProgressData(userLocalProgress);

    // 拉取云端进度
    const dlRes = await downloadProgress();
    const cloudProgress = (dlRes.success && dlRes.data) ? dlRes.data : null;

    // 三路合并（取并集，避免任一端数据丢失）
    let merged = localBeforeLogin;
    if (userLocalProgress && hasUserLocal) {
      merged = mergeProgress(merged, userLocalProgress);
    }
    if (cloudProgress) {
      merged = mergeProgress(merged, cloudProgress);
    }

    // 合并结果写入用户专属 key
    if (hasLocal || hasUserLocal || cloudProgress) {
      saveProgress(merged);
    }
    // 有本地数据时：上传合并结果到云端，并清理匿名 key
    if (hasLocal || hasUserLocal) {
      await uploadProgress(merged);
      if (hasLocal) clearAnonymousProgress();
    }
    return u;
  } catch (e) {
    console.warn('[Auth] 静默登录失败（不影响使用）:', e);
    return null;
  }
}

/**
 * 更新用户资料（昵称/头像）到云端并刷新本地缓存
 * 昵称/头像来自用户主动填写（头像昵称填写能力），非授权获取
 */
export async function updateProfile(params: { nickName: string; avatarUrl: string }): Promise<UserInfo> {
  if (!isWeapp) throw new Error('仅小程序环境支持');
  const res = await Taro.cloud.callFunction({
    name: 'login',
    data: { action: 'updateProfile', ...params }
  });
  const result = res.result as { code: number; message: string; data?: UserInfo };
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '资料更新失败');
  }
  saveUserInfo(result.data);
  return result.data;
}

// ============================================
// 云端数据同步
// ============================================

/**
 * 上传本地学习进度到云端
 */
export async function uploadProgress(progress: LearningProgress): Promise<SyncResult> {
  const user = getUserInfo();
  if (!user) {
    return { success: false, message: '请先登录后再同步' };
  }

  if (!isWeapp) {
    return { success: true, message: '本地模式，无需同步' };
  }

  try {
    const res = await Taro.cloud.callFunction({
      name: 'syncProgress',
      data: {
        action: 'upload',
        progress
      }
    });
    const result = res.result as { code: number; message: string };
    if (result.code !== 0) {
      return { success: false, message: result.message || '上传失败' };
    }
    return { success: true, message: '同步成功' };
  } catch (e) {
    console.error('[Auth] uploadProgress failed:', e);
    return { success: false, message: '网络错误，同步失败' };
  }
}

/**
 * 从云端拉取学习进度
 */
export async function downloadProgress(): Promise<SyncResult> {
  const user = getUserInfo();
  if (!user) {
    return { success: false, message: '请先登录后再同步' };
  }

  if (!isWeapp) {
    return { success: false, message: '本地模式，无法拉取' };
  }

  try {
    const res = await Taro.cloud.callFunction({
      name: 'syncProgress',
      data: { action: 'download' }
    });
    const result = res.result as { code: number; message: string; data?: LearningProgress };
    if (result.code !== 0) {
      return { success: false, message: result.message || '拉取失败' };
    }
    if (result.data) {
      return { success: true, message: '拉取成功', data: result.data };
    }
    return { success: true, message: '云端暂无数据' };
  } catch (e) {
    console.error('[Auth] downloadProgress failed:', e);
    return { success: false, message: '网络错误，拉取失败' };
  }
}

/**
 * 清空云端学习进度（用户主动清空时调用，避免旧数据复活）
 */
export async function clearCloudProgress(): Promise<SyncResult> {
  const user = getUserInfo();
  if (!user) {
    return { success: false, message: '未登录，仅清空本地' };
  }

  if (!isWeapp) {
    return { success: true, message: '本地模式，无需清空云端' };
  }

  try {
    const res = await Taro.cloud.callFunction({
      name: 'syncProgress',
      data: { action: 'clear' }
    });
    const result = res.result as { code: number; message: string };
    if (result.code !== 0) {
      return { success: false, message: result.message || '清空云端失败' };
    }
    return { success: true, message: '云端已清空' };
  } catch (e) {
    console.error('[Auth] clearCloudProgress failed:', e);
    return { success: false, message: '网络错误，云端清空失败' };
  }
}

// ============================================
// H5 模拟登录（开发调试）
// ============================================

let mockLoginCounter = 0;

function mockLogin(): UserInfo {
  mockLoginCounter += 1;
  const user: UserInfo = {
    openId: `mock_openid_${Date.now()}_${mockLoginCounter}`,
    nickName: '论语学习者',
    avatarUrl: '',
    loginTime: new Date().toISOString()
  };
  saveUserInfo(user);
  return user;
}

// ============================================
// 公开心得（社区）
// ============================================

// publishNote 云函数统一响应结构
interface CloudNoteResult {
  code: number;
  message: string;
  data?: {
    id?: string;
    list?: PublishedNote[];
    hasMore?: boolean;
  };
}

// 调用 publishNote 云函数的通用封装
async function callPublishNote(action: string, data: Record<string, any> = {}): Promise<CloudNoteResult> {
  const res = await Taro.cloud.callFunction({
    name: 'publishNote',
    data: { action, ...data }
  });
  const result = res.result as CloudNoteResult;
  if (result.code !== 0) {
    throw new Error(result.message || '操作失败');
  }
  return result;
}

/** 发布心得到社区，返回云端文档 id */
export async function publishNote(params: {
  verseId: number;
  verseOriginal: string;
  chapterTitle: string;
  content: string;
  tags: string[];
}): Promise<string> {
  if (!isWeapp) throw new Error('仅小程序环境支持发布');
  const user = getUserInfo();
  const result = await callPublishNote('publish', {
    ...params,
    authorName: user?.nickName || '论语学习者'
  });
  const id = result.data?.id;
  if (!id) throw new Error('发布失败，请重试');
  return id;
}

/** 取消发布（删除云端文档）*/
export async function unpublishNote(cloudNoteId: string): Promise<void> {
  if (!isWeapp) return;
  await callPublishNote('unpublish', { noteId: cloudNoteId });
}

/** 编辑已发布心得的内容/标签 */
export async function editPublishedNote(cloudNoteId: string, content: string, tags: string[]): Promise<void> {
  if (!isWeapp) return;
  await callPublishNote('edit', { noteId: cloudNoteId, content, tags });
}

/** 获取公开心得列表（分页）*/
export async function fetchPublishedNotes(options: {
  skip?: number;
  limit?: number;
  keyword?: string;
  verseId?: number;
  tag?: string;
} = {}): Promise<{ list: PublishedNote[]; hasMore: boolean }> {
  if (!isWeapp) return { list: [], hasMore: false };
  const result = await callPublishNote('list', options);
  return {
    list: result.data?.list ?? [],
    hasMore: result.data?.hasMore ?? false
  };
}

/** 点赞公开心得 */
export async function likePublishedNote(noteId: string): Promise<void> {
  if (!isWeapp) return;
  await callPublishNote('like', { noteId });
}

/** 取消点赞公开心得 */
export async function unlikePublishedNote(noteId: string): Promise<void> {
  if (!isWeapp) return;
  await callPublishNote('unlike', { noteId });
}
