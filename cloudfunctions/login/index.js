// 云函数：login
// 功能：微信登录、获取 openId、创建/更新用户记录
// 说明：云开发环境下 openId 由 wxContext.OPENID 自动注入，无需前端传 code 换取
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  try {
    const { action } = event;

    // 更新用户资料
    if (action === 'updateProfile') {
      const { nickName, avatarUrl } = event;
      await db.collection('users').where({ _openid: openId }).update({
        data: {
          nickName,
          avatarUrl,
          updateTime: db.serverDate()
        }
      });
      return { code: 0, message: '更新成功', data: { openId, nickName, avatarUrl } };
    }

    // 默认：登录/注册
    const usersCol = db.collection('users');
    const existing = await usersCol.where({ _openid: openId }).get();

    let userInfo;
    if (existing.data.length > 0) {
      // 已有用户，更新登录时间
      userInfo = existing.data[0];
      await usersCol.doc(userInfo._id).update({
        data: { loginTime: db.serverDate() }
      });
    } else {
      // 新用户，创建记录
      const newUser = {
        _openid: openId,
        nickName: '论语学习者',
        avatarUrl: '',
        gender: 0,
        loginTime: db.serverDate(),
        createTime: db.serverDate()
      };
      const addRes = await usersCol.add({ data: newUser });
      userInfo = { _id: addRes._id, ...newUser };
    }

    return {
      code: 0,
      message: '登录成功',
      data: {
        openId,
        nickName: userInfo.nickName || '论语学习者',
        avatarUrl: userInfo.avatarUrl || '',
        gender: userInfo.gender || 0,
        loginTime: new Date().toISOString()
      }
    };
  } catch (e) {
    console.error('[login] error:', e);
    return { code: -1, message: '登录失败：' + e.message, data: null };
  }
};
