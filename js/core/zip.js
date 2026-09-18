// 今天没白过 · 备份 ZIP（仅存储模式打包/解包，纯前端无依赖）
// 导出：data.json + media/<id>（照片原图）+ media/<id>_t（缩略图）
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(u8) {
  let c = -1;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function dosTime(d) {
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF,
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF,
  };
}
const u16 = (v) => new Uint8Array([v & 255, (v >> 8) & 255]);
const u32 = (v) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
function concat(parts) {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// files: [{name, data: Uint8Array|Blob|string}]
export async function makeZip(files) {
  const now = dosTime(new Date());
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    let data = f.data;
    if (typeof data === 'string') data = new TextEncoder().encode(data);
    else if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
    const nameU8 = new TextEncoder().encode(f.name);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(now.time), u16(now.date),
      u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0),
      nameU8, data,
    ]);
    chunks.push(local);
    central.push({
      nameU8, crc, size: data.length, offset,
      entry: concat([
        u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
        nameU8,
      ]),
    });
    offset += local.length;
  }
  const centralBuf = concat(central.map((c) => c.entry));
  const eocd = concat([
    u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ]);
  return new Blob([concat([...chunks, centralBuf, eocd])], { type: 'application/zip' });
}

// 返回 [{name, data:Uint8Array}]
export async function readZip(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // 从尾部找 EOCD
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('无效的备份文件（找不到 ZIP 目录）');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);
  const files = [];
  const td = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(ptr, true) !== 0x02014B50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const cmtLen = dv.getUint16(ptr + 32, true);
    const lho = dv.getUint32(ptr + 42, true);
    const name = td.decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
    // 定位本地头中的数据起点
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    let data = u8.subarray(dataStart, dataStart + compSize);
    if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持解压，请更换较新的浏览器导入');
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([data]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      data = u8.slice(dataStart, dataStart + compSize);
    }
    files.push({ name, data });
    ptr += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}
