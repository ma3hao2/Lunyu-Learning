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
      // 大小校验：云数据库单文档上限 1MB，超限时直接拒绝，避免同步失败且不污染云端
      if (JSON.stringify(progress).length > 900 * 1024) {
        return { code: -1, message: '数据过大，同步失败（超过 900KB），请先清理笔记' };
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
              lastReadVerseId: null,
              deletedNoteIds: [],
              likedNoteIds: [],
              unlikedNoteIds: []
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
 * 与客户端 src/utils/storage.ts 的 mergeProgress 保持同源同步，
 * 避免两端逻辑分叉导致点赞状态丢失或笔记被盲覆盖。
 */
function mergeProgress(cloudProgress, localProgress) {
  if (!cloudProgress) return localProgress;
  if (!localProgress) return cloudProgress;

  // 已读章句：取并集
  const readVerseIds = [...new Set([
    ...(cloudProgress.readVerseIds || []),
    ...(localProgress.readVerseIds || [])
  ])];

  // 公开心得点赞：并集 + 取消标记剔除
  const unlikedNoteIds = [...new Set([
    ...(cloudProgress.unlikedNoteIds || []),
    ...(localProgress.unlikedNoteIds || [])
  ])];
  const likedNoteIds = [...new Set([
    ...(cloudProgress.likedNoteIds || []),
    ...(localProgress.likedNoteIds || [])
  ])].filter(id => !unlikedNoteIds.includes(id));

  // 删除标记：取并集，合并后过滤已删除笔记（防止云端旧数据复活）
  const deletedNoteIds = [...new Set([
    ...(cloudProgress.deletedNoteIds || []),
    ...(localProgress.deletedNoteIds || [])
  ])];

  // 笔记：按 id 合并去重，比较 updateTime（无则回退 createTime），较新版本胜出。
  // 跨设备编辑同一笔记时，保留最后修改的版本而非简单覆盖。
  const noteMap = new Map();
  const noteTime = (n) => n.updateTime || n.createTime;
  [...(cloudProgress.myNotes || []), ...(localProgress.myNotes || [])].forEach(note => {
    const existing = noteMap.get(note.id);
    if (!existing || noteTime(note) >= noteTime(existing)) {
      noteMap.set(note.id, note);
    }
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

  // 最后阅读位置：优先取「存在 lastReadVerseId」的一侧（老云端数据可能缺该字段）；
  // 两侧都有/都没有时跟随「最后学习日期」较新的一侧，日期相等时偏取本地（本地更可能是刚读的位置）。
  // 与 storage.ts mergeProgress 保持同方向（修复 OCR 审查发现的比较反转：日期不同时曾误取旧侧）
  const newerSide = (cloudProgress.lastReadDate && localProgress.lastReadDate)
    ? (localProgress.lastReadDate >= cloudProgress.lastReadDate ? localProgress : cloudProgress)
    : (localProgress.lastReadDate ? localProgress : cloudProgress);
  const lastReadVerseId = (localProgress.lastReadVerseId && !cloudProgress.lastReadVerseId)
    ? localProgress.lastReadVerseId
    : (!localProgress.lastReadVerseId && cloudProgress.lastReadVerseId)
      ? cloudProgress.lastReadVerseId
      : newerSide.lastReadVerseId;

  // 裁剪无界增长的标记数组：超过阈值时只保留最新的条目，避免文档体积膨胀
  const TRIM_THRESHOLD = 200;
  const trimArray = (arr) => (arr && arr.length > TRIM_THRESHOLD) ? arr.slice(-TRIM_THRESHOLD) : arr;

  return {
    readVerseIds,
    myNotes,
    totalReadDays,
    lastReadDate,
    lastReadVerseId,
    deletedNoteIds: trimArray(deletedNoteIds),
    likedNoteIds: trimArray(likedNoteIds),
    unlikedNoteIds: trimArray(unlikedNoteIds)
  };
}
