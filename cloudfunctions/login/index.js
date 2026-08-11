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
    // 以 openId 作为文档 _id 做 upsert，天然唯一，消除并发创建竞态
    const usersCol = db.collection('users');
    let userInfo;

    try {
      // 优先按 _id = openId 查询（新数据）
      const docRes = await usersCol.doc(openId).get();
      userInfo = docRes.data;
      // 已有用户，更新登录时间
      await usersCol.doc(openId).update({
        data: { loginTime: db.serverDate() }
      });
    } catch (e) {
      // doc(openId).get() 不存在时抛错 -> 新用户或老数据（_id 非 openId）
      // 先按 _openid 查老数据（兼容历史记录）
      const legacy = await usersCol.where({ _openid: openId }).get();
      if (legacy.data.length > 0) {
        userInfo = legacy.data[0];
        await usersCol.doc(userInfo._id).update({
          data: { loginTime: db.serverDate() }
        });
      } else {
        // 新用户，以 openId 为 _id 创建（set 幂等：即使并发也只创建一条）
        const newUser = {
          nickName: '论语学习者',
          avatarUrl: '',
          gender: 0,
          loginTime: db.serverDate(),
          createTime: db.serverDate()
        };
        await usersCol.doc(openId).set({ data: newUser });
        userInfo = { _id: openId, _openid: openId, ...newUser };
      }
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
