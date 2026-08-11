// 在每个测试文件执行前重置 Taro 本地存储 mock
import Taro from '@tarojs/taro';

beforeEach(() => {
  (Taro as any).__store__ && Object.keys((Taro as any).__store__).forEach(k => {
    delete (Taro as any).__store__[k];
  });
  jest.clearAllMocks();
});
