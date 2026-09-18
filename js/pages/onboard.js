// 今天没白过 · 首次建档流程：欢迎 → 建档（账户名/密码/昵称/头像）→ 选择宠物 → 完成
import { loadKV, saveKV, put, genId } from '../core/db.js';
import { PETS, POINTS } from '../core/catalog.js';
import { finishOnboard } from '../core/engine.js';
import { h, uid, qs, icon } from '../core/util.js';
import { petSVG } from '../core/pets.js';
import { cropAndSave, fillAvatar } from '../core/avatar.js';
import { formDlg, toast, queueSettle } from '../core/fx.js';
import * as sound from '../core/sound.js';

export function renderOnboard(container, onDone) {
  let step = 0;
  const state = { account: '', nickname: '', petId: PETS[0].petId, petName: '', avatarId: null };
  const root = h('div', { class: 'onboard' });
  container.innerHTML = '';
  container.append(root);
  render();

  function logo() {
    return h('div', { class: 'ob-logo' }, h('div', { innerHTML: checkMarkSvg() }));
  }
  function heroPage() {
    return h('div', { class: 'rise' },
      h('div', { class: 'ob-hero' }, logo(),
        h('div', { class: 'ob-title' }, '今天没白过'),
        h('div', { class: 'ob-slogan' }, '把普通日子变成看得见的成就。'),
        h('div', { class: 'ob-slogan' }, '今天做成的每件小事，都值得留下。')),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, icon2('star'), '开始之前，先了解三件事'),
        h('div', { class: 'ob-done-list' },
          obRow('lock', '这是本机档案', '所有数据只保存在这台设备的浏览器里，不需要真实账号。'),
          obRow('gift', '全程免费', '没有充值、广告和付费道具，积分只来自你的真实生活。'),
          obRow('pet', '选一只伙伴', '它会陪你记录生活、慢慢成长，不会因为几天没来而离开。'))),
      h('div', { class: 'ob-foot' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => { sound.play('tap'); next(); } }, '开始体验'),
        h('div', { class: 'ob-note' }, '制作人：yanzhu · v1.0')));
  }
  function obRow(ic, t, s) {
    return h('div', { class: 'row-item' }, h('span', { class: 'settle-ic' }, icon2(ic)), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t), h('div', { class: 'row-sub' }, s)));
  }
  function formPage() {
    const accInp = h('input', { class: 'input', placeholder: '例如：yanzhu（2–20字）', value: state.account, maxlength: '20' });
    const pwdInp = h('input', { class: 'input', type: 'password', placeholder: '至少4位', maxlength: '32' });
    const pwd2Inp = h('input', { class: 'input', type: 'password', placeholder: '再输入一次' });
    const nickInp = h('input', { class: 'input', placeholder: '界面里怎么称呼你？', value: state.nickname, maxlength: '12' });
    const avatarImg = h('div', { class: 'avatar-fb', style: 'width:68px;height:68px' }, '选头像');
    const errBox = h('div', { class: 'form-hint', style: 'color:var(--danger);min-height:16px' });

    avatarImg.addEventListener('click', async () => {
      const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      inp.addEventListener('change', () => {
        const file = inp.files && inp.files[0];
        if (file) cropAndSave(file).then((id) => { if (id) { state.avatarId = id; avatarImg.className = 'avatar'; avatarImg.style.cssText = 'width:68px;height:68px'; fillAvatar(avatarImg, id); } });
      });
      document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 5000);
    });

    return h('div', { class: 'rise' },
      h('div', { class: 'ob-dots' }, dot(1), dot(2), dot(3)),
      h('div', { class: 'ob-hero', style: 'padding-top:4px' }, h('div', { class: 'ob-title', style: 'font-size:20px' }, '创建本机档案')),
      h('div', { class: 'form-list' },
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '头像'), h('div', { class: 'avatar-pick' }, avatarImg, h('span', { class: 'form-hint' }, '可选。支持裁剪，仅保存在本机'))),
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '账户名'), accInp, h('span', { class: 'form-hint' }, '本机身份标识，不用于登录任何服务器')),
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '密码'), pwdInp),
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '确认密码'), pwd2Inp,
          h('span', { class: 'form-hint' }, '本应用为本机档案，密码不保存不上传，请勿使用其他平台常用密码')),
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '昵称'), nickInp, h('span', { class: 'form-hint' }, '不填就显示账户名')),
        errBox),
      h('div', { class: 'ob-foot' },
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: prev }, '返回'),
          h('button', {
            class: 'btn btn-primary', style: 'flex:2', onclick: () => {
              const acc = accInp.value.trim();
              if (acc.length < 2) { errBox.textContent = '账户名至少 2 个字'; return; }
              const p1 = pwdInp.value, p2 = pwd2Inp.value;
              if (p1.length < 4) { errBox.textContent = '密码至少 4 位（它不会被保存）'; return; }
              if (p1 !== p2) { errBox.textContent = '两次输入的密码不一致'; return; }
              state.account = acc;
              state.nickname = nickInp.value.trim() || acc;
              sound.play('tap'); next();
            },
          }, '下一步'))));
  }
  function petPage() {
    const nameInp = h('input', { class: 'input', placeholder: '给它起个名字（可稍后再起）', maxlength: '12' });
    let sel = state.petId;
    const cards = h('div', { class: 'ob-pets' },
      PETS.map((p) => h('button', {
        class: 'ob-pet' + (p.petId === sel ? ' on' : ''),
        onclick: (e) => {
          sel = p.petId; sound.play('tap');
          [...cards.children].forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        },
      }, h('div', { class: 'pv' }, h('img', { src: './assets/pets/' + p.petId + '.png', alt: p.name, style: 'width:100%;height:100%;object-fit:contain' })), h('div', { class: 'nm' }, p.name), h('div', { class: 'sp' }, p.species))));
    return h('div', { class: 'rise' },
      h('div', { class: 'ob-dots' }, dot(1), dot(2), dot(3)),
      h('div', { class: 'ob-hero', style: 'padding-top:4px' }, h('div', { class: 'ob-title', style: 'font-size:20px' }, '选择你的初始伙伴'), h('div', { class: 'ob-slogan' }, '另外两只以后也能免费领取')),
      cards,
      h('div', { class: 'sec-gap' }),
      nameInp,
      h('div', { class: 'ob-foot' },
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: prev }, '返回'),
          h('button', {
            class: 'btn btn-primary', style: 'flex:2', onclick: async () => {
              state.petId = sel; state.petName = nameInp.value.trim();
              sound.play('complete');
              const res = await finishOnboard({ account: state.account, nickname: state.nickname, petId: state.petId, petName: state.petName });
              if (state.avatarId) await saveKV('profile', { ...(await loadKV('profile')), avatarId: state.avatarId });
              next(res.welcome);
            },
          }, '进入今天'))));
  }
  function donePage(welcome) {
    setTimeout(() => {
      queueSettle([
        { ic: 'gift', label: '建档欢迎奖励', sub: '新生活的第一份心意', points: welcome ?? POINTS.onboard.delta },
        { ic: 'badge', label: '徽章「第一步」', sub: '完成本机建档', points: 20 },
      ], '欢迎来到「今天没白过」');
      toast('档案已创建，一切只保存在这台设备上', { ic: 'heart' });
    }, 350);
    return h('div', { class: 'rise' },
      h('div', { class: 'ob-hero' }, logo(), h('div', { class: 'ob-title', style: 'font-size:20px' }, '一切就绪'),
        h('div', { class: 'ob-slogan' }, '去记下今天的第一件小事吧')),
      h('div', { class: 'ob-foot' },
        h('button', { class: 'btn btn-primary btn-block', onclick: onDone }, '进入首页')));
  }

  function dot(i) { return h('i', { class: i <= step ? 'on' : '' }); }
  function next(welcome) { step++; render(welcome); }
  function prev() { step--; render(); }
  function render(welcome) {
    root.innerHTML = '';
    if (step === 0) root.append(heroPage());
    else if (step === 1) root.append(formPage());
    else if (step === 2) root.append(petPage());
    else root.append(donePage(welcome));
  }
}

function checkMarkSvg() {
  return '<svg viewBox="0 0 48 48" fill="none"><path d="M10 25.5l9 9L38 15" stroke="#FFFDF8" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function icon2(name) {
  const el = document.createElement('span');
  el.style.cssText = 'display:inline-flex;font-size:18px';
  el.append(icon(name));
  return el;
}

// 头像：选择 → 简单裁剪（拖动+缩放）→ 压缩保存（「我的」页也复用）
export { cropAndSave, fillAvatar, clearAvatarCache } from '../core/avatar.js';
// 头像URL缓存，避免重复创建ObjectURL
const _avatarCache = new Map();
export async function fillAvatar(el, photoId) {
  if (!photoId) return;
  const { get } = await import('../core/db.js');
  // 检查缓存
  let url = _avatarCache.get(photoId);
  if (!url) {
    const row = await get('photos', photoId).catch(() => null);
    if (!row || !row.blob) {
      // 加载失败，显示默认头像
      el.innerHTML = '';
      el.style.borderRadius = '50%';
      el.style.background = 'var(--surface2)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '20px';
      el.style.color = 'var(--muted)';
      el.textContent = '友';
      return;
    }
    url = URL.createObjectURL(row.blob);
    _avatarCache.set(photoId, url);
  }
  el.innerHTML = '';
  el.style.borderRadius = '50%';
  el.style.overflow = 'hidden';
  el.style.background = 'var(--surface2)';
  el.append(h('img', {
    src: url,
    style: 'width:100%;height:100%;object-fit:cover;display:block',
    alt: '头像',
    onload: () => { el.style.opacity = '1'; },
    onerror: () => { el.innerHTML = '友'; el.style.fontSize = '20px'; el.style.color = 'var(--muted)'; }
  }));
}
// 清除头像缓存（更换头像后调用）
export function clearAvatarCache(photoId) {
  if (photoId && _avatarCache.has(photoId)) {
    URL.revokeObjectURL(_avatarCache.get(photoId));
    _avatarCache.delete(photoId);
  } else if (!photoId) {
    _avatarCache.forEach((url) => URL.revokeObjectURL(url));
    _avatarCache.clear();
  }
}
