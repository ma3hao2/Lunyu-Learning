import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { CLOUD_ENV } from '@/config/cloud';
import { silentLoginAndMerge } from '@/services/auth';
// 全局样式
import './app.scss';

function App(props) {
  // 初始化云开发环境（仅微信小程序）
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
      try {
        // 显式指定云环境 ID，未配置时回退到默认环境
        const initConfig: { env?: string; traceUser: boolean } = { traceUser: true };
        if (CLOUD_ENV) {
          initConfig.env = CLOUD_ENV;
        }
        Taro.cloud.init(initConfig);
        console.log('[App] 云开发环境初始化成功', CLOUD_ENV ? `(env: ${CLOUD_ENV})` : '(默认环境)');
      } catch (e) {
        console.error('[App] 云开发环境初始化失败:', e);
      }
    }
    // 静默自动登录（openId 由平台注入，无需授权；失败静默，不影响使用）
    // 首次登录会自动合并匿名期间的学习进度到用户 key 并上传云端
    silentLoginAndMerge();
  }, []);

  return props.children;
}

export default App;
