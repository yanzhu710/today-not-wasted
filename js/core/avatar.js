// 头像：调用者只有在媒体提交成功后才收到 ID；取消与失败不修改 profile。
import { h, uid } from './util.js';
import { get, put } from './db.js';
import { openModal, toast } from './fx.js';
const cache = new Map();
const rendering = new WeakMap();
export function clearAvatarCache(photoId) {
  if (photoId) { if (cache.has(photoId)) URL.revokeObjectURL(cache.get(photoId)); cache.delete(photoId); }
  else { cache.forEach(url => URL.revokeObjectURL(url)); cache.clear(); }
}
window.addEventListener('tjmbg:media-restored', () => clearAvatarCache());
function fallback(el) {
  el.replaceChildren(); el.textContent = '友';
  Object.assign(el.style, { display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%',
    overflow:'hidden', background:'var(--surface2)', color:'var(--muted)', fontSize:'20px' });
}
export async function fillAvatar(el, photoId) {
  const token = {};
  rendering.set(el, token);
  if (!photoId) { fallback(el); return; }
  let url = cache.get(photoId);
  if (!url) {
    const row = await get('photos', photoId).catch(() => null);
    if (rendering.get(el) !== token) return;
    if (!(row?.blob instanceof Blob)) { fallback(el); return; }
    url = URL.createObjectURL(row.blob); cache.set(photoId, url);
  }
  if (rendering.get(el) !== token) return;
  Object.assign(el.style, { borderRadius:'50%', overflow:'hidden', background:'var(--surface2)' });
  const image = h('img', { src:url, alt:'头像', style:'width:100%;height:100%;object-fit:cover;display:block',
    onerror:() => { if (rendering.get(el) === token) { clearAvatarCache(photoId); fallback(el); } } });
  el.replaceChildren(image);
}
export async function cropAndSave(file) {
  if (!(file instanceof Blob) || !file.size) { toast('请选择有效图片', {ic:'error'}); return null; }
  if (file.size > 20 * 1024 * 1024) { toast('图片过大，请选择20MB以内的图片', {ic:'error'}); return null; }
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取图片，请换用 JPG、PNG 或 WebP'));
      image.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 60e6) throw new Error('图片尺寸过大，请缩小后重试');
  } catch (e) { URL.revokeObjectURL(url); toast(e.message, {ic:'error'}); return null; }
  return new Promise(resolve => {
    let settled = false, scale = 1, ox = 0, oy = 0, drag = null;
    const size = 512;
    const canvas = h('canvas', { width:size, height:size, style:'width:240px;max-width:100%;height:auto;aspect-ratio:1;border-radius:50%;display:block;margin:auto;touch-action:none' });
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
    const slider = h('input', { type:'range', class:'input range', min:100, max:300, value:100, 'aria-label':'头像缩放', style:'margin-top:14px' });
    function draw() {
      const ratio = Math.max(size / img.naturalWidth, size / img.naturalHeight) * scale;
      const w = img.naturalWidth * ratio, hh = img.naturalHeight * ratio;
      ox = Math.max(-(w-size)/2, Math.min((w-size)/2, ox));
      oy = Math.max(-(hh-size)/2, Math.min((hh-size)/2, oy));
      ctx.fillStyle = '#F7F3EA'; ctx.fillRect(0,0,size,size);
      ctx.drawImage(img, (size-w)/2+ox, (size-hh)/2+oy,w,hh);
    }
    canvas.addEventListener('pointerdown', e => { drag = {id:e.pointerId,x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const ratio = size / canvas.getBoundingClientRect().width;
      ox += (e.clientX-drag.x)*ratio; oy += (e.clientY-drag.y)*ratio;
      drag.x = e.clientX; drag.y = e.clientY; draw();
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
    slider.addEventListener('input', () => { scale = Number(slider.value)/100; draw(); });
    draw();
    const finish = (value, close) => { if (settled) return; settled = true; resolve(value); close(); };
    openModal({ title:'调整头像', content:h('div',null,canvas,slider,h('div',{class:'form-hint'},'拖动调整位置，滑动缩放；确认后保存到本机。')),
      actions:[
        {label:'取消',onClick:c => finish(null,c)},
        {label:'使用',cls:'btn-primary',onClick:async c => {
          const blob = await new Promise((res,rej) => { try { canvas.toBlob(b => b ? res(b) : rej(new Error('头像处理失败，请重试')), 'image/jpeg',.9); } catch(e) { rej(e); } });
          const id = 'avatar_' + uid('m');
          await put('photos',{id,blob,thumb:blob,role:'avatar'});
          finish(id,c);
        }},
      ], onClose:() => { URL.revokeObjectURL(url); if (!settled) { settled = true; resolve(null); } },
    });
  });
}
