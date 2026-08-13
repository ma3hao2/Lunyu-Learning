/**
 * inflate 极简解压器测试
 *
 * 与 node zlib 交叉验证（zlib 为权威实现）：
 * 覆盖 stored / fixed / dynamic 三种 deflate 块类型 + base64/UTF-8 解码。
 * 测试环境为 node，可安全依赖 zlib；小程序端解压同一格式的数据（见
 * tests/versesDataCompressed.test.ts 的真实数据一致性用例）。
 */
import zlib from 'zlib';
import { inflateRaw, base64ToBytes, utf8Decode } from '@/utils/inflate';

/** zlib 压缩 → 本实现解压 → 字节级比对 */
function roundtrip(input: Buffer | string, options?: zlib.ZlibOptions): void {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  const deflated = zlib.deflateRawSync(buf, options);
  const restored = inflateRaw(new Uint8Array(deflated));
  expect(Buffer.from(restored)).toEqual(buf);
}

// 伪随机数生成器（固定种子，保证测试可复现）
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('inflateRaw 往返（与 node zlib 交叉验证）', () => {
  test('空输入', () => {
    roundtrip(Buffer.alloc(0));
  });

  test('单字节', () => {
    roundtrip(Buffer.from([0]));
    roundtrip(Buffer.from([0xff]));
  });

  test('纯 ASCII 长文本（stored/fixed 块路径）', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(200);
    roundtrip(text);
    // 强制固定 Huffman 块（Z_FIXED 策略）
    roundtrip(text, { strategy: zlib.constants.Z_FIXED });
  });

  test('中文长文本（动态 Huffman 块路径）', () => {
    const text = '学而时习之，不亦说乎？有朋自远方来，不亦乐乎？'.repeat(500);
    roundtrip(text);
  });

  test('高重复数据（压缩路径拉满）', () => {
    roundtrip(Buffer.from('aaaaaaaa'.repeat(10000)));
  });

  test('随机二进制（不可压缩 → stored 块）', () => {
    const rand = seededRandom(42);
    const buf = Buffer.alloc(64);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(rand() * 256);
    roundtrip(buf);
  });

  test('大体积随机+文本混合（多种长度）', () => {
    for (const size of [1, 2, 3, 7, 100, 255, 256, 1000, 65536]) {
      const rand = seededRandom(size);
      const buf = Buffer.alloc(size);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = rand() < 0.7 ? 0x61 + Math.floor(rand() * 26) : Math.floor(rand() * 256);
      }
      roundtrip(buf);
    }
  });

  test('超长回引（258 长度码 + 大距离）', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(300);
    roundtrip(text);
  });
});

describe('base64ToBytes', () => {
  test('与 Buffer 解码一致（含填充）', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'hello', '学而时习之']) {
      const b64 = Buffer.from(s, 'utf8').toString('base64');
      const decoded = base64ToBytes(b64);
      expect(Buffer.from(decoded).toString('utf8')).toBe(s);
    }
  });

  test('容忍换行与空白', () => {
    const b64 = Buffer.from('学而时习之，不亦说乎？', 'utf8').toString('base64');
    const withBreaks = b64.replace(/(.{20})/g, '$1\n');
    expect(Buffer.from(base64ToBytes(withBreaks)).toString('utf8')).toBe('学而时习之，不亦说乎？');
  });
});

describe('utf8Decode', () => {
  test('与 Buffer 解码一致（1/2/3/4 字节字符）', () => {
    const samples = ['a', '中', '学而时习之', '𠀀', '𝄞', 'hello 世界 😀'];
    for (const s of samples) {
      const bytes = new Uint8Array(Buffer.from(s, 'utf8'));
      expect(utf8Decode(bytes)).toBe(s);
    }
  });
});
