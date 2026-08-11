/**
 * Hooks 单元测试（useDebounce / useProgress）
 *
 * 说明：项目 jest 环境为 node，未安装 @testing-library / react-test-renderer。
 * 这里使用已随依赖安装的 jsdom 手动搭建最小 DOM，再通过 react-dom/client.createRoot
 * 与 react-dom/test-utils 的 act 渲染并驱动 Hook，覆盖 src/hooks/ 两个文件。
 */
import { act, createElement } from 'react';
import Taro from '@tarojs/taro';
import { useDebounce } from '@/hooks/useDebounce';
import { useProgress } from '@/hooks/useProgress';
import { getProgress, markVerseRead } from '@/utils/storage';

// ---------- 最小 DOM 环境（node 环境下用 jsdom 补齐） ----------
const { JSDOM } = require('jsdom') as any;
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
const win = dom.window;
(global as any).window = win;
(global as any).document = win.document;
(global as any).navigator = win.navigator;
(global as any).Node = win.Node;
(global as any).HTMLElement = win.HTMLElement;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = require('react-dom/client') as any;

let container: HTMLDivElement;
let root: any;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.useFakeTimers();
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }
  root = null;
  container?.remove();
  jest.useRealTimers();
});

describe('useDebounce（防抖 Hook）', () => {
  const DebounceHarness = ({ value, delay }: { value: string; delay?: number }) => {
    const debounced = useDebounce(value, delay);
    return createElement('div', { id: 'debounced' }, debounced);
  };

  const renderDebounce = async (value: string, delay?: number) => {
    await act(async () => {
      root.render(createElement(DebounceHarness, { value, delay }));
    });
  };

  const output = () => container.querySelector('#debounced')!.textContent;

  test('初始值立即返回（不等防抖）', async () => {
    await renderDebounce('学而时习之');
    expect(output()).toBe('学而时习之');
  });

  test('默认 300ms 后更新为新值', async () => {
    await renderDebounce('旧值');
    await act(async () => {
      root.render(createElement(DebounceHarness, { value: '新值' }));
    });
    expect(output()).toBe('旧值'); // 防抖期间保持旧值

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(output()).toBe('旧值');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(output()).toBe('新值');
  });

  test('支持自定义 delay', async () => {
    await renderDebounce('a', 100);
    await act(async () => {
      root.render(createElement(DebounceHarness, { value: 'b', delay: 100 }));
    });
    expect(output()).toBe('a');

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(output()).toBe('b');
  });

  test('连续变化只保留最后一次（旧定时器被清理）', async () => {
    await renderDebounce('v1');
    await act(async () => {
      root.render(createElement(DebounceHarness, { value: 'v2' }));
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(output()).toBe('v1');

    // 第二次变化：v2 的定时器应被清理，v3 的定时器在 t+300 后触发
    await act(async () => {
      root.render(createElement(DebounceHarness, { value: 'v3' }));
    });
    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(output()).toBe('v1'); // v2 未生效，v3 尚未到期

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(output()).toBe('v3');
  });

  test('卸载后定时器不再触发更新（不抛错）', async () => {
    await renderDebounce('x');
    await act(async () => {
      root.render(createElement(DebounceHarness, { value: 'y' }));
    });
    await act(async () => {
      root.unmount();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(container.textContent).toBe('');
  });
});

describe('useProgress（学习进度 Hook）', () => {
  let api: any;

  const ProgressHarness = () => {
    api = useProgress();
    return null;
  };

  const renderProgress = async () => {
    await act(async () => {
      root.render(createElement(ProgressHarness));
    });
  };

  test('初始进度为默认空进度', async () => {
    await renderProgress();
    expect(api.progress.readVerseIds).toEqual([]);
    expect(api.progress.myNotes).toEqual([]);
    expect(api.isRead(101)).toBe(false);
  });

  test('markRead 更新状态并持久化', async () => {
    await renderProgress();
    await act(async () => {
      api.markRead(101);
    });
    expect(api.progress.readVerseIds).toContain(101);
    expect(api.isRead(101)).toBe(true);
    // 已写入本地存储
    expect(getProgress().readVerseIds).toContain(101);
  });

  test('挂载时同步存储中已有的进度', async () => {
    markVerseRead(101);
    await renderProgress();
    expect(api.progress.readVerseIds).toContain(101);
    expect(api.isRead(101)).toBe(true);
  });

  test('refresh 重新读取存储中最新的进度', async () => {
    await renderProgress();
    expect(api.isRead(101)).toBe(false);

    // 模拟其他页面直接写存储（useProgress 的 state 不会自动感知）
    markVerseRead(101);
    expect(api.isRead(101)).toBe(false); // 未刷新前仍是旧状态

    await act(async () => {
      api.refresh();
    });
    expect(api.progress.readVerseIds).toContain(101);
    expect(api.isRead(101)).toBe(true);
  });

  test('页面 useDidShow 触发时自动刷新进度（hook 内注册）', async () => {
    await renderProgress();
    expect(api.isRead(101)).toBe(false);

    // 模拟其他页面/设备直接修改存储
    markVerseRead(101);

    // 取出 useProgress 通过 useDidShow 注册的回调并触发（模拟页面再次展示）
    const calls = (Taro.useDidShow as jest.Mock).mock.calls;
    const showCallback = calls[calls.length - 1]?.[0];
    expect(typeof showCallback).toBe('function');
    await act(async () => {
      showCallback();
    });

    expect(api.progress.readVerseIds).toContain(101);
    expect(api.isRead(101)).toBe(true);
  });
});
