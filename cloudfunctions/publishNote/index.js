// 云函数：publishNote
// 功能：公开心得（社区）的发布、取消、编辑、列表、点赞
// 集合权限：notes / notes_likes 设为「所有用户可读，仅创建者可写」
//           点赞等跨用户操作通过本云函数（管理端权限）执行
const cloud = require('wx-server-sdk');
const { validateNote } = require('./validate');
const { listNotes, likeNote, unlikeNote } = require('./logic');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { action } = event;

  try {
    // ===== 发布心得 =====
    if (action === 'publish') {
      const { verseId, verseOriginal, chapterTitle, content, tags, authorName } = event;
      // 校验
      const err = validateNote(content, tags, verseId);
      if (err) return { code: -1, message: err };

      const doc = {
        _openid: openId,
        verseId,
        verseOriginal: verseOriginal || '',
        chapterTitle: chapterTitle || '',
        content,
        tags: tags || [],
        authorName: authorName || '论语学习者',
        likeCount: 0,
        createTime: new Date().toISOString()
      };
      const addRes = await db.collection('notes').add({ data: doc });
      return { code: 0, message: '发布成功', data: { id: addRes._id } };
    }

    // ===== 取消发布（删除云端文档）=====
    if (action === 'unpublish') {
      const { noteId } = event;
      if (!noteId) return { code: -1, message: '缺少 noteId' };
      // 仅作者可删（_openid 自动匹配）
      const existing = await db.collection('notes').doc(noteId).get();
      if (!existing.data || existing.data._openid !== openId) {
        return { code: -1, message: '无权操作' };
      }
      await db.collection('notes').doc(noteId).remove();
      // 清理该笔记的点赞记录（独立 try-catch：notes_likes 可能未创建，失败不影响主删除）
      try {
        await db.collection('notes_likes').where({ noteId }).remove();
      } catch (e) {
        console.warn('[publishNote] 清理点赞记录失败（不影响主删除）:', e.message);
      }
      return { code: 0, message: '已取消发布' };
    }

    // ===== 编辑已发布心得 =====
    if (action === 'edit') {
      const { noteId, content, tags } = event;
      if (!noteId) return { code: -1, message: '缺少 noteId' };
      const err = validateNote(content, tags);
      if (err) return { code: -1, message: err };
      const existing = await db.collection('notes').doc(noteId).get();
      if (!existing.data || existing.data._openid !== openId) {
        return { code: -1, message: '无权操作' };
      }
      await db.collection('notes').doc(noteId).update({
        data: { content, tags: tags || [] }
      });
      return { code: 0, message: '更新成功' };
    }

    // ===== 获取公开心得列表 =====
    if (action === 'list') {
      return await listNotes(db, {
        skip: event.skip,
        limit: event.limit,
        keyword: event.keyword,
        verseId: event.verseId,
        tag: event.tag,
        openId
      });
    }

    // ===== 点赞 =====
    if (action === 'like') {
      const { noteId } = event;
      if (!noteId) return { code: -1, message: '缺少 noteId' };
      return await likeNote(db, openId, noteId);
    }

    // ===== 取消点赞 =====
    if (action === 'unlike') {
      const { noteId } = event;
      if (!noteId) return { code: -1, message: '缺少 noteId' };
      return await unlikeNote(db, openId, noteId);
    }

    return { code: -1, message: '未知操作: ' + action };
  } catch (e) {
    console.error('[publishNote] error:', e);
    return { code: -1, message: '操作失败：' + e.message };
  }
};
