import { getProgress, saveProgress, mergeProgress } from '@/utils/storage';
import { downloadProgress, uploadProgress } from '@/services/auth';

export interface SyncNowResult {
  success: boolean;
  message: string;
}

// 手动双向同步：下载云端 → 合并写回本地 → 上传合并结果。
// 下载失败时仍上传本地数据，并通过 success=false / message 告知用户同步不完整。
export async function syncProgressNow(): Promise<SyncNowResult> {
  const local = getProgress();
  const dlRes = await downloadProgress();
  let merged = local;
  if (dlRes.success && dlRes.data) {
    merged = mergeProgress(local, dlRes.data);
    saveProgress(merged);
  }
  const upRes = await uploadProgress(merged);
  if (!upRes.success) {
    return { success: false, message: upRes.message };
  }
  return {
    success: dlRes.success,
    message: dlRes.success ? '同步成功' : '云端拉取失败，仅上传本地数据'
  };
}
