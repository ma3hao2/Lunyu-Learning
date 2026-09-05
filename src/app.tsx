import React, { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { CLOUD_ENV } from '@/config/cloud';
import { silentLoginAndMerge } from '@/services/auth';
import { I18nProvider } from '@/i18n';
// 全局样式
import './app.scss';

// 隐私合规（P1-5）：需要隐私授权时暂不静默登录/上传，等用户首次触发（我的页登录、发布等）时
// 通过 wx.requirePrivacyAuthorize 弹出微信官方授权框；无需授权或接口不可用时照旧静默登录
function privacyGateLogin(): void {
  if (process.env.TARO_ENV !== 'weapp' || !Taro.getPrivacySetting) {
    silentLoginAndMerge();
    return;
  }
  try {
    Taro.getPrivacySetting({
      success: (res) => {
        if (!res.needAuthorization) silentLoginAndMerge();
      },
      fail: () => {
        // 老基础库/接口异常：保守放行，维持原行为
        silentLoginAndMerge();
      }
    });
  } catch (e) {
    console.warn('[App] 隐私授权检查失败（放行静默登录）:', e);
    silentLoginAndMerge();
  }
}

function App(props) {
  // 初始化云开发环境（仅微信小程序）
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
      try {
        // 显式指定云环境 ID，未配置时回退到默认环境
        // 注意：traceUser（用户行为统计）保持关闭——云开发 init 参数以首次调用为准，无法事后开启；
        // 隐私授权前不收集行为数据，关闭最稳妥（隐私政策页也无需声明行为统计）
        const initConfig: { env?: string } = {};
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
    // 首次登录会自动合并匿名期间的学习进度到用户 key 并上传云端；需隐私授权时推迟到用户首次触发
    privacyGateLogin();
    // 注意：不在主包做全量数据「空闲预热」——app.tsx 属主包，静态引用 versesLoader
    // 会把 851KB 压缩 blob 打进主包（实测 common.js 174KB → 1MB，第四轮审查确认），
    // 违背「完整数据进分包」的体积设计；首次进分包页面时解压（0.5-2s 低端机可接受）
  }, []);

  return (
    <I18nProvider>
      {props.children}
    </I18nProvider>
  );
}

export default App;
