/**
 * 隐私授权测试（P1-5）
 *
 * ensurePrivacyAuthorized 依赖 TARO_ENV=weapp 分支（非小程序环境直接放行），
 * 因此本文件在加载 auth 前设置环境变量，并用 jest.resetModules 保证
 * 每个用例拿到全新模块实例（模式同 storage.cloudSync.test.ts）。
 *
 * 覆盖四个分支：
 * 1. needAuthorization=false → 直接放行，不弹授权框
 * 2. needAuthorization=true + 用户同意 → 放行
 * 3. needAuthorization=true + 用户拒绝 → 拦截（false）
 * 4. getPrivacySetting 查询失败 → 保守放行（不阻塞老基础库/异常）
 */
process.env.TARO_ENV = 'weapp';
const originalEnv = process.env.TARO_ENV;

// 注意：Taro 必须在 beforeEach（resetModules 之后）require，
// 否则静态导入拿到的是 reset 前的旧实例，与 auth 内 require 到的新实例不是同一个
let taroMock: any;
let ensurePrivacyAuthorized: () => Promise<boolean>;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  taroMock = require('@tarojs/taro');
  ensurePrivacyAuthorized = require('@/services/auth').ensurePrivacyAuthorized;
});

afterAll(() => {
  process.env.TARO_ENV = originalEnv;
});

describe('隐私授权 ensurePrivacyAuthorized（P1-5）', () => {
  test('needAuthorization=false 时直接放行，不弹授权框', async () => {
    (taroMock.getPrivacySetting as jest.Mock).mockImplementation(({ success }) =>
      success({ needAuthorization: false })
    );
    await expect(ensurePrivacyAuthorized()).resolves.toBe(true);
    expect(taroMock.requirePrivacyAuthorize).not.toHaveBeenCalled();
  });

  test('needAuthorization=true 且用户同意时放行', async () => {
    (taroMock.getPrivacySetting as jest.Mock).mockImplementation(({ success }) =>
      success({ needAuthorization: true })
    );
    (taroMock.requirePrivacyAuthorize as jest.Mock).mockImplementation(({ success }) => success());
    await expect(ensurePrivacyAuthorized()).resolves.toBe(true);
    expect(taroMock.requirePrivacyAuthorize).toHaveBeenCalledTimes(1);
  });

  test('needAuthorization=true 且用户拒绝时拦截', async () => {
    (taroMock.getPrivacySetting as jest.Mock).mockImplementation(({ success }) =>
      success({ needAuthorization: true })
    );
    (taroMock.requirePrivacyAuthorize as jest.Mock).mockImplementation(({ fail }) =>
      fail({ errMsg: 'privacy permission is not authorized' })
    );
    await expect(ensurePrivacyAuthorized()).resolves.toBe(false);
  });

  test('getPrivacySetting 查询失败时保守放行（老基础库/接口异常）', async () => {
    (taroMock.getPrivacySetting as jest.Mock).mockImplementation(({ fail }) =>
      fail(new Error('api not found'))
    );
    await expect(ensurePrivacyAuthorized()).resolves.toBe(true);
    expect(taroMock.requirePrivacyAuthorize).not.toHaveBeenCalled();
  });
});
