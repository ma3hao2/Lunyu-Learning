import { useEffect } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { CLOUD_ENV } from '@/config/cloud';
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
  }, []);

  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
