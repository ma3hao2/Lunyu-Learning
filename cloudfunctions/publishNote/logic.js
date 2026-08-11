// publishNote 云函数纯业务逻辑（可单测）
// 设计：不依赖 wx-server-sdk，db 由调用方注入（生产环境传真实云数据库，
//       单测传 mock），保证 list 分页 / _openid 剔除 / 点赞查重等逻辑可被直接测试。

// 返回给客户端的字段白名单（剔除 _openid，保护隐私）
const PUBLIC_FIELDS = {
  _id: true,
  verseId: true,
  verseOriginal: true,
  chapterTitle: true,
  content: true,
  tags: true,
  authorName: true,
  likeCount: true,
  createTime: true
};

/**
 * 获取公开心得列表
 * @param {object} db 云数据库实例（或测试 mock），需提供 collection/command/serverDate
 * @param {object} params { skip, limit, keyword, verseId, tag, openId }
 */
async function listNotes(db, params) {
  const { skip = 0, limit = 20, keyword, verseId, tag, openId } = params;
  const pageLimit = Math.min(limit, 50);
  const _ = db.command;

  let query = {};
  if (verseId) query.verseId = verseId;
  if (tag) query.tags = tag;
  // 关键词搜索（用 RegExp 做内容模糊匹配）
  if (keyword) {
    query.content = db.RegExp({ regexp: keyword, options: 'i' });
  }

  const res = await db.collection('notes')
    .where(query)
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageLimit)
    .field(PUBLIC_FIELDS)
    .get();

  // 查询当前用户的点赞状态（notes_likes 集合可能未创建，失败时降级为全部未赞，不阻塞列表）
  const noteIds = res.data.map(n => n._id);
  let likedSet = new Set();
  if (noteIds.length > 0) {
    try {
      const likesRes = await db.collection('notes_likes')
        .where({ noteId: _.in(noteIds), _openid: openId })
        .get();
      likedSet = new Set(likesRes.data.map(l => l.noteId));
    } catch (e) {
      console.warn('[listNotes] notes_likes 查询失败（集合可能未创建），点赞状态降级为全部未赞:', e.message);
    }
  }

  const list = res.data.map(n => ({
    id: n._id,
    verseId: n.verseId,
    verseOriginal: n.verseOriginal,
    chapterTitle: n.chapterTitle,
    content: n.content,
    tags: n.tags,
    authorName: n.authorName,
    likeCount: n.likeCount,
    createTime: n.createTime,
    likedByMe: likedSet.has(n._id)
  }));
  return { code: 0, message: 'ok', data: { list, hasMore: list.length === pageLimit } };
}

/**
 * 点赞（同一用户对同一笔记只能赞一次）
 * notes_likes 集合未创建时返回可操作提示，避免未捕获异常导致整个云函数失败
 */
async function likeNote(db, openId, noteId) {
  const _ = db.command;
  let existed = [];
  try {
    const res = await db.collection('notes_likes')
      .where({ noteId, _openid: openId })
      .get();
    existed = res.data;
  } catch (e) {
    console.warn('[likeNote] notes_likes 查询失败（集合可能未创建）:', e.message);
    return {
      code: -1,
      message: '点赞功能未就绪：请先在云开发控制台创建 notes_likes 集合，并重新部署 publishNote 云函数'
    };
  }
  if (existed.length > 0) {
    return { code: 0, message: '已点赞过' };
  }
  await db.collection('notes_likes').add({
    data: { noteId, _openid: openId, createTime: db.serverDate() }
  });
  await db.collection('notes').doc(noteId).update({
    data: { likeCount: _.inc(1) }
  });
  return { code: 0, message: '点赞成功' };
}

/**
 * 取消点赞（未点赞过则幂等返回）
 * notes_likes 集合未创建时同样容错返回提示
 */
async function unlikeNote(db, openId, noteId) {
  const _ = db.command;
  let existed = [];
  try {
    const res = await db.collection('notes_likes')
      .where({ noteId, _openid: openId })
      .get();
    existed = res.data;
  } catch (e) {
    console.warn('[unlikeNote] notes_likes 查询失败（集合可能未创建）:', e.message);
    return {
      code: -1,
      message: '点赞功能未就绪：请先在云开发控制台创建 notes_likes 集合，并重新部署 publishNote 云函数'
    };
  }
  if (existed.length === 0) {
    return { code: 0, message: '未点赞过' };
  }
  await db.collection('notes_likes')
    .where({ noteId, _openid: openId })
    .remove();
  await db.collection('notes').doc(noteId).update({
    data: { likeCount: _.inc(-1) }
  });
  return { code: 0, message: '已取消点赞' };
}

module.exports = { listNotes, likeNote, unlikeNote, PUBLIC_FIELDS };
