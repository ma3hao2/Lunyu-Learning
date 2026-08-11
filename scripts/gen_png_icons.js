/**
 * 生成微信小程序所需的 PNG 格式 tabbar 图标
 * 生成 81x81 像素的简单图标
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(pixels, width, height) {
  // 创建 PNG 文件
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit color depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT - raw pixel data with filter byte
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      const offset = rowOffset + 1 + x * 4;
      rawData[offset] = pixel[0];     // R
      rawData[offset + 1] = pixel[1]; // G
      rawData[offset + 2] = pixel[2]; // B
      rawData[offset + 3] = pixel[3]; // A
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

// CRC32 calculation
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// 创建像素画布
const W = 81;
function createCanvas() {
  return Array.from({ length: W }, () =>
    Array.from({ length: W }, () => [0, 0, 0, 0])
  );
}

// 绘制圆形
function drawCircle(canvas, cx, cy, r, color) {
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        canvas[y][x] = color;
      }
    }
  }
}

// 绘制矩形
function drawRect(canvas, x1, y1, x2, y2, color) {
  for (let y = Math.max(0, y1); y < Math.min(W, y2); y++) {
    for (let x = Math.max(0, x1); x < Math.min(W, x2); x++) {
      canvas[y][x] = color;
    }
  }
}

// 绘制线条
function drawLine(canvas, x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + dx * t);
    const cy = Math.round(y1 + dy * t);
    for (let ty = -Math.ceil(thickness); ty <= Math.ceil(thickness); ty++) {
      for (let tx = -Math.ceil(thickness); tx <= Math.ceil(thickness); tx++) {
        const px = cx + tx;
        const py = cy + ty;
        if (px >= 0 && px < W && py >= 0 && py < W && canvas[py] && canvas[py][px]) {
          canvas[py][px] = color;
        }
      }
    }
  }
}

const gray = [153, 153, 153, 255];
const brown = [184, 97, 45, 255];
const bg = [240, 240, 240, 255];

// --- 首页图标 ---
function drawHome(color) {
  const c = createCanvas();
  // 房子主体
  drawLine(c, 10, 50, 40, 18, 2.5, color);
  drawLine(c, 40, 18, 70, 50, 2.5, color);
  drawLine(c, 15, 50, 15, 72, 2.5, color);
  drawLine(c, 65, 50, 65, 72, 2.5, color);
  drawLine(c, 15, 72, 65, 72, 2.5, color);
  // 门
  drawRect(c, 33, 50, 47, 72, color);
  // 门内空白
  drawRect(c, 35, 52, 45, 70, [255, 255, 255, 255]);
  return c;
}

// --- 论语/书籍图标 ---
function drawBook(color) {
  const c = createCanvas();
  // 书脊
  drawLine(c, 40, 12, 40, 68, 2, color);
  // 封面
  drawLine(c, 40, 12, 15, 15, 2, color);
  drawLine(c, 15, 15, 15, 68, 2, color);
  drawLine(c, 15, 68, 40, 68, 2, color);
  // 封底
  drawLine(c, 40, 12, 65, 15, 2, color);
  drawLine(c, 65, 15, 65, 68, 2, color);
  drawLine(c, 65, 68, 40, 68, 2, color);
  // 横线（文字）
  for (let i = 0; i < 3; i++) {
    drawLine(c, 22, 28 + i * 10, 35, 26 + i * 10, 1, color);
    drawLine(c, 45, 26 + i * 10, 58, 28 + i * 10, 1, color);
  }
  return c;
}

// --- 心得/灯泡图标 ---
function drawBulb(color) {
  const c = createCanvas();
  // 灯泡
  drawCircle(c, 40, 30, 16, color);
  // 灯泡下半部分
  drawRect(c, 30, 44, 50, 48, color);
  // 底部横线
  drawLine(c, 28, 55, 52, 55, 3, color);
  drawLine(c, 30, 58, 50, 58, 2.5, color);
  drawLine(c, 32, 61, 48, 61, 2, color);
  // 灯丝
  drawLine(c, 36, 28, 44, 28, 1.5, [255, 255, 255, 255]);
  drawLine(c, 40, 22, 40, 28, 1.5, [255, 255, 255, 255]);
  return c;
}

// --- 我的/人物图标 ---
function drawPerson(color) {
  const c = createCanvas();
  // 头（圆环）
  drawCircle(c, 40, 24, 13, color);
  // 身体（半圆环）
  drawCircle(c, 40, 58, 18, color);
  // 内部挖空
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dxh = x - 40, dyh = y - 24;
      const dh = Math.sqrt(dxh * dxh + dyh * dyh);
      if (dh < 10) c[y][x] = [255, 255, 255, 255];
      const dxb = x - 40, dyb = y - 58;
      const db = Math.sqrt(dxb * dxb + dyb * dyb);
      if (db < 15 && dyb < 6) c[y][x] = [255, 255, 255, 255];
    }
  }
  return c;
}

const icons = {
  'home': drawHome,
  'home-selected': (c) => drawHome(c),
  'classics': drawBook,
  'classics-selected': (c) => drawBook(c),
  'insights': drawBulb,
  'insights-selected': (c) => drawBulb(c),
  'mine': drawPerson,
  'mine-selected': (c) => drawPerson(c),
};

const outDir = path.join(__dirname, '..', 'src', 'assets', 'tabbar');
for (const [name, drawFn] of Object.entries(icons)) {
  const isSelected = name.includes('selected');
  const color = isSelected ? brown : gray;
  const canvas = drawFn(color);
  const png = createPNG(canvas, W, W);
  fs.writeFileSync(path.join(outDir, name + '.png'), png);
  console.log(`Generated: ${name}.png (${png.length} bytes)`);
}

console.log('\nDone! Now update app.config.ts to use .png instead of .svg');
