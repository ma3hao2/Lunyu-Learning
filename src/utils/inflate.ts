/**
 * 极简 DEFLATE (RFC 1951) 解压器 —— 纯 JS 无依赖，供微信小程序运行时解压章句数据。
 *
 * 数据格式约定（与 scripts/compress_verses.cjs 配合）：
 *   base64( deflateRaw( utf8( JSON.stringify({ verses }) ) ) )
 * 仅支持 raw deflate（无 zlib/gzip 头尾），支持 stored / fixed / dynamic 三种块类型。
 *
 * 为什么不用 pako 等库：微信小程序无内置解压 API，pako 最小化后 ~45KB 会挤占分包预算；
 * 本项目只需解压自己生成的流，手写极简实现（~5KB）即可，配合往返测试保证正确性。
 */

// ===== RFC 1951 3.2.5 长度/距离基础表 =====
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
];
// 动态块码长码的符号顺序（RFC 1951 3.2.7）
const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** 规范 Huffman 解码表 */
interface HuffTable {
  count: Uint16Array;  // count[len]：码长为 len 的符号数（下标 0..maxLen，0 恒为 0）
  first: Uint16Array;  // first[len]：码长为 len 的起始码值（下标 0..maxLen）
  syms: Uint16Array;   // 按 (码长, 符号序号) 排序的符号序列
  maxLen: number;
}

/** 由码长数组构建规范 Huffman 解码表（RFC 1951 3.2.2 canonical codes） */
function buildTable(lengths: Uint8Array): HuffTable {
  let maxLen = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > maxLen) maxLen = lengths[i];
  }
  const count = new Uint16Array(maxLen + 1);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0) count[lengths[i]]++;
  }
  // first[len]：长度为 len 的码值起点（next_code 递推）
  const first = new Uint16Array(maxLen + 1);
  let code = 0;
  for (let len = 1; len <= maxLen; len++) {
    code = (code + count[len - 1]) << 1;
    first[len] = code;
  }
  // syms：按 (码长, 符号) 排序
  const syms: number[] = [];
  for (let len = 1; len <= maxLen; len++) {
    for (let s = 0; s < lengths.length; s++) {
      if (lengths[s] === len) syms.push(s);
    }
  }
  return { count, first, syms: Uint16Array.from(syms), maxLen };
}

/** 位读取器：LSB-first（DEFLATE 位序） */
class BitReader {
  private pos = 0; // 当前字节下标
  private bit = 0; // 当前字节内位偏移（0..7）

  constructor(private data: Uint8Array) {}

  readBit(): number {
    const b = (this.data[this.pos] >> this.bit) & 1;
    if (++this.bit === 8) {
      this.bit = 0;
      this.pos++;
    }
    return b;
  }

  readBits(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v |= this.readBit() << i;
    }
    return v;
  }

  /** stored 块前对齐到字节边界 */
  alignByte(): void {
    if (this.bit > 0) {
      this.bit = 0;
      this.pos++;
    }
  }

  /** 直接读取下一字节（仅 stored 块按字节复制时使用） */
  readByte(): number {
    return this.data[this.pos++];
  }
}

/** 从位流解码一个符号：逐位读入，检查是否落入当前码长的码值区间 */
function decodeSymbol(rd: BitReader, t: HuffTable): number {
  let acc = 0;
  let first = 0;
  let idx = 0;
  for (let len = 1; len <= t.maxLen; len++) {
    acc = (acc << 1) | rd.readBit();
    first = (first + t.count[len - 1]) << 1;
    idx += t.count[len - 1];
    if (acc < first + t.count[len]) {
      return t.syms[idx + (acc - first)];
    }
  }
  throw new Error('inflate: 无效的 Huffman 码');
}

// 固定 Huffman 表（RFC 1951 3.2.6），惰性构建一次
let fixedLitTable: HuffTable | null = null;
let fixedDistTable: HuffTable | null = null;
function getFixedTables(): { lit: HuffTable; dist: HuffTable } {
  if (!fixedLitTable || !fixedDistTable) {
    // 字面量/长度：0-143 为 8 位，144-255 为 9 位，256-279 为 7 位，280-287 为 8 位
    const lit = new Uint8Array(288);
    for (let i = 0; i <= 143; i++) lit[i] = 8;
    for (let i = 144; i <= 255; i++) lit[i] = 9;
    for (let i = 256; i <= 279; i++) lit[i] = 7;
    for (let i = 280; i <= 287; i++) lit[i] = 8;
    fixedLitTable = buildTable(lit);
    // 距离：30 个符号均为 5 位
    fixedDistTable = buildTable(new Uint8Array(30).fill(5));
  }
  return { lit: fixedLitTable, dist: fixedDistTable };
}

/**
 * 解压 raw deflate 数据（无 zlib/gzip 头尾，对应 zlib.deflateRawSync 的输出）
 */
export function inflateRaw(data: Uint8Array): Uint8Array {
  const rd = new BitReader(data);
  // 输出缓冲区：动态扩容
  let out = new Uint8Array(1 << 16); // 初始 64KB
  let outLen = 0;
  const ensure = (extra: number) => {
    if (outLen + extra <= out.length) return;
    let cap = out.length * 2;
    while (cap < outLen + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(out.subarray(0, outLen));
    out = next;
  };

  let bfinal = 0;
  do {
    bfinal = rd.readBit();
    const btype = rd.readBits(2);

    if (btype === 0) {
      // stored：按字节复制
      rd.alignByte();
      const len = rd.readBits(16);
      rd.readBits(16); // NLEN（1 的补码校验，此处不校验）
      ensure(len);
      for (let i = 0; i < len; i++) {
        out[outLen++] = rd.readByte();
      }
      continue;
    }
    if (btype === 3) {
      throw new Error('inflate: 保留块类型 3');
    }

    let litTable: HuffTable;
    let distTable: HuffTable;
    if (btype === 1) {
      const fixed = getFixedTables();
      litTable = fixed.lit;
      distTable = fixed.dist;
    } else {
      // dynamic：读码长并构建两棵 Huffman 树
      const hlit = rd.readBits(5) + 257;
      const hdist = rd.readBits(5) + 1;
      const hclen = rd.readBits(4) + 4;
      const clenLengths = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) {
        clenLengths[CLEN_ORDER[i]] = rd.readBits(3);
      }
      const clenTable = buildTable(clenLengths);
      const lengths = new Uint8Array(hlit + hdist);
      let n = 0;
      while (n < hlit + hdist) {
        const sym = decodeSymbol(rd, clenTable);
        if (sym < 16) {
          lengths[n++] = sym;
        } else if (sym === 16) {
          if (n === 0) throw new Error('inflate: 重复码长无前值');
          const prev = lengths[n - 1];
          const rep = 3 + rd.readBits(2);
          for (let i = 0; i < rep; i++) lengths[n++] = prev;
        } else if (sym === 17) {
          n += 3 + rd.readBits(3); // 连续 0
        } else {
          n += 11 + rd.readBits(7); // 连续 0
        }
      }
      litTable = buildTable(lengths.subarray(0, hlit));
      distTable = buildTable(lengths.subarray(hlit));
    }

    // 符号循环
    for (;;) {
      const sym = decodeSymbol(rd, litTable);
      if (sym < 256) {
        ensure(1);
        out[outLen++] = sym;
      } else if (sym === 256) {
        break; // 块结束
      } else {
        if (sym > 285) throw new Error('inflate: 非法字面量/长度符号');
        const li = sym - 257;
        const length = LENGTH_BASE[li] + rd.readBits(LENGTH_EXTRA[li]);
        const d = decodeSymbol(rd, distTable);
        // 距离符号上界校验：DIST_BASE 仅 30 项（0-29），损坏流给保留符号 30/31 赋码时
        // DIST_BASE[d] 为 undefined，NaN 会让下方回引距离校验失效并静默写出错误数据
        if (d >= DIST_BASE.length) throw new Error('inflate: 非法距离符号');
        const dist = DIST_BASE[d] + rd.readBits(DIST_EXTRA[d]);
        if (dist > outLen) throw new Error('inflate: 回引距离超出已输出长度');
        ensure(length);
        for (let i = 0; i < length; i++) {
          out[outLen] = out[outLen - dist]; // 逐字节复制天然支持重叠
          outLen++;
        }
      }
    }
  } while (!bfinal);

  return out.slice(0, outLen);
}

// ===== base64 → bytes（小程序无 atob，手写解码）=====
const B64_LUT = (() => {
  const lut = new Int16Array(128).fill(-1);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    lut[chars.charCodeAt(i)] = i;
  }
  return lut;
})();

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\s\r\n]/g, '');
  let len = clean.length;
  while (len > 0 && clean[len - 1] === '=') len--; // 去掉填充
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const v = B64_LUT[clean.charCodeAt(i)];
    if (v < 0) throw new Error('base64: 非法字符');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out;
}

// ===== bytes → UTF-8 字符串（小程序无 TextDecoder，手写解码）=====
export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      parts.push(String.fromCharCode(b));
      i += 1;
    } else if (b < 0xe0) {
      parts.push(String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
      i += 2;
    } else if (b < 0xf0) {
      parts.push(String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
      i += 3;
    } else {
      // 4 字节：代理对
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      parts.push(
        String.fromCharCode(0xd800 + ((cp - 0x10000) >> 10)),
        String.fromCharCode(0xdc00 + ((cp - 0x10000) & 0x3ff))
      );
      i += 4;
    }
  }
  return parts.join('');
}
