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

// ===== 手工构造损坏 deflate 流（P2-7 回归锁定） =====
// DEFLATE 位序为 LSB-first，这里用位写入器逐位拼出 dynamic 块：
// 码长树（符号 0/1/2/18 各 2 位）+ 字面树（65/66/256/257 各 2 位）+ 距离树（符号 30 为 1 位）
// 数据段编码一个回引对，距离符号用保留值 30（DIST_BASE 仅 0-29）→ 应触发上界校验抛错
class BitWriter {
  private bits: number[] = [];

  // 普通整数字段（BFINAL/BTYPE/HLIT/重复计数等）：LSB-first（DEFLATE 位序）
  push(value: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.bits.push((value >> i) & 1);
    }
  }

  // Huffman 码：RFC 1951 规定码按 MSB-first 写入（区别于整数字段的 LSB-first）
  pushCode(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      this.bits.push((value >> i) & 1);
    }
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) {
      bytes[i >> 3] |= this.bits[i] << (i & 7);
    }
    return bytes;
  }
}

function buildMalformedDistStream(): Uint8Array {
  const w = new BitWriter();
  w.push(0, 1); // BFINAL = 0
  w.push(2, 2); // BTYPE = 10 (dynamic)
  w.push(1, 5); // HLIT = 258（字面/长度符号 0..257）
  w.push(30, 5); // HDIST = 31（距离符号 0..30，含保留值 30）
  w.push(14, 4); // HCLEN = 18（码长码 16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1）

  // 码长树：符号 0/1/2/18 各 2 位（canonical：0→00, 1→01, 2→10, 18→11）
  // HCLEN 必须覆盖到符号 1（CLEN_ORDER 第 17 位）与符号 2（第 15 位）
  const clenLengths = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1];
  const lenOf: Record<number, number> = {
    16: 0, 17: 0, 18: 2, 0: 2, 8: 0, 7: 0, 9: 0, 6: 0, 10: 0,
    5: 0, 11: 0, 4: 0, 12: 0, 3: 0, 13: 0, 2: 2, 14: 0, 1: 2
  };
  for (const s of clenLengths) w.push(lenOf[s], 3);

  // 码长流：clenCode[sym] = [码值, 位宽]（码按 MSB-first 写入）
  const clenCode: Record<number, [number, number]> = { 0: [0, 2], 1: [1, 2], 2: [2, 2], 18: [3, 2] };
  const emit = (sym: number) => w.pushCode(clenCode[sym][0], clenCode[sym][1]);
  emit(18); w.push(54, 7); // 11 + 54 = 65 个 0（符号 0..64）
  emit(2); emit(2); // 符号 65、66 码长 2
  emit(18); w.push(127, 7); emit(18); w.push(40, 7); // 138 + 51 = 189 个 0（符号 67..255，18 号重复码单次最多 138）
  emit(2); emit(2); // 符号 256（EOB）、257（长度 3）码长 2
  emit(18); w.push(19, 7); // 11 + 19 = 30 个 0（距离符号 0..29）
  emit(1); // 距离符号 30 码长 1（保留值，合法流不会出现）

  // 数据段：字面 'A'（码 00）、'B'（码 01）、回引（长度符号 257 = 码 11，距离符号 30 = 码 0）
  w.pushCode(0b00, 2);
  w.pushCode(0b01, 2);
  w.pushCode(0b11, 2);
  w.pushCode(0, 1); // 距离符号 30 → d=30 ≥ DIST_BASE.length → 应抛「非法距离符号」
  return w.toBytes();
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

  // P2-7 回归锁定：距离符号无上界校验时，保留符号 30/31 会让 DIST_BASE[d] 为 undefined，
  // NaN 绕过「回引距离超出」校验并静默写出错误数据——必须抛错而非静默
  test('损坏流：非法距离符号（保留值 30）抛出异常而非静默产出错误数据（P2-7 回归锁定）', () => {
    expect(() => inflateRaw(buildMalformedDistStream())).toThrow('非法距离符号');
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
