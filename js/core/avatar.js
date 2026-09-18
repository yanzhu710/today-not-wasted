// Local-only avatar pipeline. Profile references are updated by the caller, after success.
import { h, uid } from './util.js';
import { put, get } from './db.js';
import { openModal, toast } from './fx.js';

const generations = new WeakMap();
let epoch = 0;
export function clearAvatarCache() { epoch++; } // compatibility; no long-lived Blob URL cache

export async function chooseAvatar() {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', style: 'display:none' });
  const file = await new Promise((resolve) => {
    let finished = false;
    const settle = (value) => { if (finished) return; finished = true; input.remove(); resolve(value); };
    input.addEventListener('change', () => settle(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => settle(null), { once: true });
    document.body.append(input); input.click();
  });
  return file ? cropAndSave(file) : null;
}

async function decodeFile(file) {
  if (!(file instanceof Blob) || file.size === 0) throw new Error('请选择一张有效图片');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片超过20MB，请换一张较小的图片');
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error('图片加载超时，请重试')), 15000);
      img.onload = () => { clearTimeout(timer); img.naturalWidth ? resolve(img) : reject(new Error('图片尺寸无效')); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('无法读取图片，请尝试 JPG、PNG 或 WebP')); };
      img.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export async function cropAndSave(file) {
  let img;
  try { img = await decodeFile(file); }
  catch (error) { toast(error.message, { ic: 'error', ms: 3500 }); return null; }
  const size = 512;
  const canvas = h('canvas', { width: size, height: size, 'aria-label': '拖动调整头像', style: 'width:min(256px,100%);height:auto;aspect-ratio:1;border-radius:50%;display:block;margin:0 auto;touch-action:none;background:#EEE' });
  const context = canvas.getContext('2d');
  if (!context) { toast('浏览器无法处理图片', { ic: 'error' }); return null; }
  const slider = h('input', { type: 'range', class: 'input range', min: '1', max: '3', step: '.01', value: '1', 'aria-label': '头像缩放', style: 'margin-top:12px' });
  let zoom = 1, x = 0, y = 0, pointer = null;
  const base = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  function draw() {
    const w = img.naturalWidth * base * zoom, height = img.naturalHeight * base * zoom;
    x = Math.max(-(w-size)/2, Math.min((w-size)/2, x));
    y = Math.max(-(height-size)/2, Math.min((height-size)/2, y));
    context.fillStyle = '#FFFBF2'; context.fillRect(0,0,size,size);
    context.drawImage(img, (size-w)/2+x, (size-height)/2+y, w, height);
  }
  canvas.addEventListener('pointerdown', e => {
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const factor = size / (canvas.getBoundingClientRect().width || size);
    x += (e.clientX-pointer.x)*factor; y += (e.clientY-pointer.y)*factor;
    pointer.x = e.clientX; pointer.y = e.clientY; draw();
  });
  const finishDrag = () => { pointer = null; };
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  canvas.addEventListener('lostpointercapture', finishDrag);
  slider.addEventListener('input', () => { zoom = Number(slider.value); draw(); }); draw();
  return new Promise(resolve => {
    let settled = false;
    const settle = value => { if (!settled) { settled = true; resolve(value); } };
    openModal({
      title: '调整头像',
      content: h('div', null, canvas, slider, h('div', { class: 'form-hint', style: 'text-align:center;margin-top:8px' }, '拖动调整位置，滑动调整大小；确认后再保存个人资料。')),
      actions: [
        { label: '取消', onClick: close => { settle(null); close(); } },
        { label: '使用', cls: 'btn-primary', onClick: async close => {
          const blob = await new Promise((resolveBlob, reject) => {
            try { canvas.toBlob(b => b ? resolveBlob(b) : reject(new Error('图片处理失败，请重试')), 'image/jpeg', .9); }
            catch (error) { reject(error); }
          });
          const id = uid('avatar');
          await put('photos', { id, blob, thumb: blob, role: 'avatar' });
          // Decide the result before close invokes onClose. Failed saves leave the dialog open.
          settle(id); close();
        } },
      ],
      onClose: () => settle(null),
    });
  });
}

export async function fillAvatar(el, photoId) {
  const token = Symbol('avatar'), startEpoch = epoch;
  generations.set(el, token);
  const current = () => generations.get(el) === token && epoch === startEpoch;
  const fallback = () => {
    if (!current()) return;
    el.replaceChildren(document.createTextNode('友'));
    Object.assign(el.style, { borderRadius: '50%', overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: '1' });
  };
  if (!photoId) { fallback(); return false; }
  const row = await get('photos', photoId).catch(() => null);
  if (!current()) return false;
  if (!(row?.blob instanceof Blob) || !row.blob.size) { fallback(); return false; }
  const url = URL.createObjectURL(row.blob);
  const img = h('img', { alt: '头像', style: 'width:100%;height:100%;object-fit:cover;display:block' });
  return new Promise(resolve => {
    const done = ok => { URL.revokeObjectURL(url); resolve(ok); };
    img.onload = () => {
      if (!current()) { done(false); return; }
      Object.assign(el.style, { borderRadius: '50%', overflow: 'hidden', background: 'var(--surface2)', opacity: '1' });
      el.replaceChildren(img); done(true);
    };
    img.onerror = () => { fallback(); done(false); };
    img.src = url;
  });
}
