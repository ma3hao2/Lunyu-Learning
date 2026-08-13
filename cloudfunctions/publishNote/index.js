// DEPRECATED: 个人主体版本停用（微信「社交-笔记」类目个人主体未开放，已按去 UGC 方案停用全部公开心得功能）。
// 保留待企业主体恢复社区时复用；无需部署本版本，云上如已部署可下线。
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

/**
 * 内容安全检查（微信内容安全接口 msgSecCheck v2，UGC 合规）
 * - 命中违规（suggest=risky，或旧版约定错误码 87014）拒绝发布
 * - 接口调用异常（网络/未开通等）保守放行并记日志，避免误伤正常用户
 * 云调用方式无需自配 appid/secret；需云开发环境已开通内容安全能力。
 * @returns {{ ok: boolean, message?: string }}
 */
async function checkContentSafe(openId, content, tags) {
  // content ≤500 字 + tags ≤5 个，拼接后远低于接口 2500 字上限，slice 兜底
  const text = [content, ...(tags || [])].join('\n').slice(0, 2500);
  try {
    const secRes = await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid: openId,
      scene: 3, // 3 = 论坛（UGC 社区场景）
      content: text
    });
    const suggest = secRes && secRes.result && secRes.result.suggest;
    if (suggest === 'risky') {
      return { ok: false, message: '内容包含不合适的信息，请修改后再发布' };
    }
    return { ok: true }; // pass / review 均放行
  } catch (e) {
    if (e && e.errCode === 87014) {
      return { ok: false, message: '内容包含不合适的信息，请修改后再发布' };
    }
    console.warn('[publishNote] msgSecCheck 调用失败（保守放行）:', e && (e.errCode || e.errMsg || e.message));
    return { ok: true };
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { action } = event;

  try {
    // ===== 发布心得 =====
    if (action === 'publish') {
      const { verseId, verseOriginal, chapterTitle, content, tags, authorName } = event;
      // 强制 verseId 必填（validateNote 对 undefined 放行，这里前置拦截，避免笔记关联错乱）
      if (!Number.isInteger(verseId) || verseId <= 0) return { code: -1, message: '章句ID无效' };
      // 校验
      const err = validateNote(content, tags, verseId);
      if (err) return { code: -1, message: err };
      // 内容安全检查（发布与编辑都校验，防止"先发正常再改成违规"绕过）
      const sec = await checkContentSafe(openId, content, tags);
      if (!sec.ok) return { code: -1, message: sec.message };
      // authorName 由客户端传入，服务端做长度/类型兜底，防止伪造超长昵称
      const safeAuthorName = (typeof authorName === 'string' && authorName.trim())
        ? authorName.trim().slice(0, 20)
        : '论语学习者';

      const doc = {
        _openid: openId,
        verseId,
        verseOriginal: verseOriginal || '',
        chapterTitle: chapterTitle || '',
        content,
        tags: tags || [],
        authorName: safeAuthorName,
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
      // 内容安全检查（编辑同样校验，防止改为违规内容）
      const sec = await checkContentSafe(openId, content, tags);
      if (!sec.ok) return { code: -1, message: sec.message };
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
