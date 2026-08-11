// 云函数：syncProgress
// 功能：上传/下载用户学习进度，实现多设备同步
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { action, progress } = event;

  try {
    const col = db.collection('progress');

    if (action === 'upload') {
      // 上传本地进度到云端
      if (!progress) {
        return { code: -1, message: '缺少进度数据' };
      }

      const existing = await col.where({ _openid: openId }).get();

      if (existing.data.length > 0) {
        // 已有记录，合并更新（取并集，保留更多数据）
        const cloudData = existing.data[0];
        const merged = mergeProgress(cloudData.progress, progress);
        await col.doc(existing.data[0]._id).update({
          data: {
            progress: merged,
            updateTime: db.serverDate()
          }
        });
      } else {
        // 新建记录
        await col.add({
          data: {
            _openid: openId,
            progress,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }

      return { code: 0, message: '上传成功' };
    }

    if (action === 'download') {
      // 从云端拉取进度
      const existing = await col.where({ _openid: openId }).get();

      if (existing.data.length === 0) {
        return { code: 0, message: '云端暂无数据', data: null };
      }

      return { code: 0, message: '拉取成功', data: existing.data[0].progress };
    }

    if (action === 'clear') {
      // 清空云端进度（用户主动清空学习数据时调用，避免旧数据在下次同步时复活）
      const existing = await col.where({ _openid: openId }).get();
      if (existing.data.length > 0) {
        await col.doc(existing.data[0]._id).update({
          data: {
            progress: {
              readVerseIds: [],
              myNotes: [],
              totalReadDays: 1,
              lastReadDate: null,
              deletedNoteIds: []
            },
            updateTime: db.serverDate()
          }
        });
      }
      return { code: 0, message: '已清空' };
    }

    return { code: -1, message: '未知操作: ' + action };
  } catch (e) {
    console.error('[syncProgress] error:', e);
    return { code: -1, message: '同步失败：' + e.message };
  }
};

/**
 * 合并两份进度数据（取并集，保留更多数据）
 */
function mergeProgress(cloudProgress, localProgress) {
  if (!cloudProgress) return localProgress;
  if (!localProgress) return cloudProgress;

  // 已读章句：取并集
  const readVerseIds = [...new Set([
    ...(cloudProgress.readVerseIds || []),
    ...(localProgress.readVerseIds || [])
  ])];

  // 删除标记：取并集，合并后过滤已删除笔记（防止云端旧数据复活）
  const deletedNoteIds = [...new Set([
    ...(cloudProgress.deletedNoteIds || []),
    ...(localProgress.deletedNoteIds || [])
  ])];

  // 笔记：合并去重（按 id，本地后写覆盖云端，last-writer-wins）
  const noteMap = new Map();
  [...(cloudProgress.myNotes || []), ...(localProgress.myNotes || [])].forEach(note => {
    noteMap.set(note.id, note);
  });
  const myNotes = [...noteMap.values()]
    .sort((a, b) => b.id - a.id)
    .filter(note => !deletedNoteIds.includes(note.id));

  // 连续学习天数：取较大值
  const totalReadDays = Math.max(
    cloudProgress.totalReadDays || 1,
    localProgress.totalReadDays || 1
  );

  // 最后学习日期：取存在且较新的（显式处理 undefined，避免字符串与 undefined 比较返回 NaN 导致结果丢失）
  const lastReadDate = (cloudProgress.lastReadDate && localProgress.lastReadDate)
    ? (cloudProgress.lastReadDate > localProgress.lastReadDate
        ? cloudProgress.lastReadDate
        : localProgress.lastReadDate)
    : (cloudProgress.lastReadDate || localProgress.lastReadDate);

  return {
    readVerseIds,
    myNotes,
    totalReadDays,
    lastReadDate,
    deletedNoteIds
  };
}
