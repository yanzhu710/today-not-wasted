// 今天没白过 · 宠物形象与家园场景（原创矢量形象，动作由 CSS 驱动）
import { PETS, stageOf, shopById } from './catalog.js';
import { shopArt } from './art.js';
import { h } from './util.js';

// 三只宠物：同一结构（身体/耳朵/脸/尾巴），不同几何与配色
export function petSVG(petId, { equip = {}, pose = 'idle', stage = 1 } = {}) {
  const def = PETS.find((p) => p.petId === petId) || PETS[0];
  const scale = 0.94 + Math.min(stage, 5) * 0.022;

  // 优先使用正式宠物图片（assets/pets/{petId}.png）
  if (window.__PET_IMAGES && window.__PET_IMAGES[petId]) {
    return `<svg class="pet-svg" viewBox="0 0 120 118" style="--pet-scale:${scale.toFixed(3)}" aria-label="${def.name}">
      <g transform="translate(60,104) scale(var(--pet-scale)) translate(-60,-104)">
        <ellipse cx="60" cy="109" rx="24" ry="7" fill="rgba(76,58,40,.12)"/>
        <image href="./assets/pets/${petId}.png" x="10" y="5" width="100" height="105" preserveAspectRatio="xMidYMid meet"/>
      </g>
    </svg>`;
  }

  const P = def.palette;
  const ink = P.ink;
  let parts = '';
  let accBack = '', accFront = '';

  if (petId === 'maotuan') {
    parts = `
      <path class="pt-tail" d="M88 84c12-2 16-12 10-20-4-6-12-6-14 0" fill="none" stroke="${P.shade}" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="60" cy="86" rx="33" ry="24" fill="${P.body}"/>
      <ellipse cx="60" cy="92" rx="20" ry="13" fill="#FFFDF6"/>
      <path d="M38 34l6-14 12 10zM82 34l-6-14-12 10z" fill="${P.body}"/>
      <path d="M42 30l3-7 6 5zM78 30l-3-7-6 5z" fill="${P.ear}"/>
      <circle cx="60" cy="50" r="27" fill="${P.body}"/>
      <path d="M46 30c4-3 9-4 14-4s10 1 14 4" fill="none" stroke="${P.shade}" stroke-width="3" stroke-linecap="round"/>
      <path d="M52 26c1-4 3-6 5-7M68 26c-1-4-3-6-5-7" fill="none" stroke="${P.shade}" stroke-width="2.6" stroke-linecap="round"/>
      <g class="pt-face">
        <circle class="pt-eye" cx="50" cy="48" r="3.2" fill="${ink}"/>
        <circle class="pt-eye" cx="70" cy="48" r="3.2" fill="${ink}"/>
        <path d="M56 57c1.6 1.8 3 1.8 4 0 1 1.8 2.4 1.8 4 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="43" cy="56" r="3.4" fill="${P.blush}" opacity="0.8"/>
        <circle cx="77" cy="56" r="3.4" fill="${P.blush}" opacity="0.8"/>
        <path d="M30 52l8 2M30 58l8-1M90 52l-8 2M90 58l-8-1" stroke="${P.shade}" stroke-width="1.8" stroke-linecap="round"/>
      </g>
      <ellipse cx="40" cy="106" rx="9" ry="6" fill="${P.body}"/>
      <ellipse cx="80" cy="106" rx="9" ry="6" fill="${P.body}"/>`;
  } else if (petId === 'lili') {
    parts = `
      <path class="pt-tail" d="M90 82c10-6 12-16 4-20" fill="none" stroke="${P.body}" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="60" cy="86" rx="33" ry="24" fill="${P.body}"/>
      <ellipse cx="60" cy="93" rx="18" ry="12" fill="#FFF6E4"/>
      <circle cx="60" cy="50" r="27" fill="${P.body}"/>
      <path d="M36 38c-6-2-10 2-10 8s6 12 12 10" fill="${P.ear}"/>
      <path d="M84 38c6-2 10 2 10 8s-6 12-12 10" fill="${P.ear}"/>
      <ellipse cx="60" cy="60" rx="13" ry="10" fill="#FFF6E4"/>
      <g class="pt-face">
        <circle class="pt-eye" cx="49" cy="46" r="3.4" fill="${ink}"/>
        <circle class="pt-eye" cx="71" cy="46" r="3.4" fill="${ink}"/>
        <circle cx="60" cy="56" r="4" fill="${ink}"/>
        <path d="M56 62c1.4 2 2.6 2 4 0 1.4 2 2.6 2 4 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="42" cy="56" r="3.4" fill="${P.blush}" opacity="0.85"/>
        <circle cx="78" cy="56" r="3.4" fill="${P.blush}" opacity="0.85"/>
      </g>
      <ellipse cx="40" cy="106" rx="9" ry="6" fill="${P.shade}"/>
      <ellipse cx="80" cy="106" rx="9" ry="6" fill="${P.shade}"/>`;
  } else {
    parts = `
      <circle cx="88" cy="92" r="8" fill="#FFFDF6"/>
      <ellipse cx="60" cy="86" rx="31" ry="24" fill="${P.body}"/>
      <ellipse cx="60" cy="92" rx="18" ry="12" fill="#FFFDF6"/>
      <circle cx="60" cy="50" r="26" fill="${P.body}"/>
      <path class="pt-ear-l" d="M44 30c-8-14-2-26 6-24 8 2 10 14 6 26z" fill="${P.body}"/>
      <path class="pt-ear-r" d="M76 30c8-14 2-26-6-24-8 2-10 14-6 26z" fill="${P.body}"/>
      <path d="M46 26c-4-8-1-15 3-14 4 1 5 8 3 16z" fill="${P.ear}"/>
      <path d="M74 26c4-8 1-15-3-14-4 1-5 8-3 16z" fill="${P.ear}"/>
      <g class="pt-face">
        <circle class="pt-eye" cx="50" cy="48" r="3.2" fill="${ink}"/>
        <circle class="pt-eye" cx="70" cy="48" r="3.2" fill="${ink}"/>
        <path d="M56 56c1.6 1.6 3 1.6 4 0 1 1.6 2.4 1.6 4 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="57" y="60" width="6" height="5" rx="1" fill="#FFFDF6" stroke="${ink}" stroke-width="1"/>
        <circle cx="43" cy="55" r="3.4" fill="${P.blush}" opacity="0.85"/>
        <circle cx="77" cy="55" r="3.4" fill="${P.blush}" opacity="0.85"/>
      </g>
      <ellipse cx="42" cy="106" rx="9" ry="6" fill="${P.body}"/>
      <ellipse cx="78" cy="106" rx="9" ry="6" fill="${P.body}"/>`;
  }

  // 装扮配件（原创矢量，按槽位叠加）
  const A = {
    S021: () => `<path d="M42 72c6 4 30 4 36 0l-3 10c-8 3-22 3-30 0z" fill="#7A8FB5"/><path d="M46 74l2 9M54 76l1 9M62 76l-1 9M70 74l-2 9" stroke="#F4F0E6" stroke-width="2.4"/>`,
    S022: () => `<circle cx="76" cy="32" r="7" fill="#EFC94C"/><path d="M76 26v12M70 30l12 6M82 30l-12 6" stroke="#D9A02C" stroke-width="1.6"/>`,
    S023: () => `<path d="M42 30c2-10 34-10 36 0l2 6H40z" fill="#8B8FA8"/><ellipse cx="60" cy="37" rx="24" ry="5" fill="#6F7390"/>`,
    S024: () => `<path d="M42 72c6 4 30 4 36 0l-2 9c-9 3-23 3-32 0z" fill="#5B7EA6"/><path d="M44 74h32M46 78h28" stroke="#F4F0E6" stroke-width="2"/>`,
    S025: () => `<ellipse cx="62" cy="26" rx="20" ry="11" fill="#B5776B"/><circle cx="62" cy="20" r="3" fill="#8A5B4A"/><ellipse cx="60" cy="31" rx="24" ry="5" fill="#B5776B"/>`,
    S026: () => `<path d="M34 78c0-18 10-28 26-28s26 10 26 28v14H34z" fill="#E8C84E" opacity="0.92"/><path d="M46 50c2-6 8-9 14-9s12 3 14 9" fill="none" stroke="#D9B02C" stroke-width="3"/>`,
    S027: () => `<path d="M42 34c2-10 34-10 36 0l6 12H36z" fill="#7A8FB5"/><circle cx="86" cy="48" r="6" fill="#F4F0E6"/><path d="M54 26l6-4 4 5" stroke="#F4F0E6" stroke-width="2" fill="none"/>`,
    S028: () => `<path d="M42 72c6 4 30 4 36 0l-2 8c-9 4-23 4-32 0z" fill="#C9484E"/><path d="M74 78l10 8-4 10-10-8" fill="#C9484E"/>`,
    S029: () => `<path d="M40 62c8 4 32 4 40 0l14 6-4 22c-16 6-44 6-60 0l-4-22z" fill="none"/><rect x="72" y="80" width="20" height="16" rx="4" fill="#A67B4E"/><path d="M72 84h20" stroke="#8A6238" stroke-width="2"/><path d="M48 74c8 6 20 8 28 6" fill="none" stroke="#8A6238" stroke-width="3"/>`,
    S030: () => `<path d="M34 76c2-10 12-14 26-14s24 4 26 14c-8 6-18 8-26 8s-18-2-26-8z" fill="#F4F0E6"/><circle cx="40" cy="74" r="4" fill="#FFF"/><circle cx="80" cy="74" r="4" fill="#FFF"/><circle cx="60" cy="70" r="4" fill="#FFF"/>`,
    S031: () => `<path d="M44 24l4 10 6-12 6 12 4-10 2 14H42z" fill="#D8A94D"/><circle cx="60" cy="14" r="5" fill="#F2E4BC"/><path d="M60 10a5 5 0 0 0 0 8z" fill="#D8A94D"/>`,
    S032: () => `<path d="M36 78c2-16 10-24 24-24s22 8 24 24z" fill="#8B6FA8"/><path d="M50 54c3 6 6 8 10 8s7-2 10-8" fill="none" stroke="#D8A94D" stroke-width="2.6"/><circle cx="60" cy="66" r="3" fill="#D8A94D"/>`,
  };
  for (const [slot, key] of [['head', 'S022'], ['head', 'S023'], ['head', 'S025'], ['head', 'S027'], ['head', 'S031'], ['neck', 'S021'], ['neck', 'S024'], ['neck', 'S028'], ['body', 'S026'], ['body', 'S029'], ['body', 'S030'], ['body', 'S032']]) {
    if (equip[slot] === key && A[key]) {
      if (['S026', 'S029', 'S030', 'S032'].includes(key)) accBack += A[key]();
      else accFront += A[key]();
    }
  }
  const aura = stage >= 5 ? `<ellipse cx="60" cy="86" rx="42" ry="32" fill="none" stroke="#D8A94D" stroke-width="1.6" opacity="0.5" stroke-dasharray="3 6"/>` : '';
  const shadow = `<ellipse cx="60" cy="109" rx="24" ry="7" fill="rgba(76,58,40,.12)"/>`;
  const shine = petId === 'maotuan'
    ? `<ellipse cx="49" cy="40" rx="14" ry="9" fill="rgba(255,255,255,.26)" transform="rotate(-18 49 40)"/><ellipse cx="53" cy="77" rx="16" ry="9" fill="rgba(255,255,255,.18)" transform="rotate(-12 53 77)"/><path d="M39 66c9-7 30-7 40 0" fill="none" stroke="rgba(120,90,62,.13)" stroke-width="3" stroke-linecap="round"/>`
    : petId === 'lili'
      ? `<ellipse cx="46" cy="40" rx="13" ry="8" fill="rgba(255,255,255,.24)" transform="rotate(-15 46 40)"/><ellipse cx="56" cy="80" rx="17" ry="8" fill="rgba(255,255,255,.16)" transform="rotate(-10 56 80)"/><path d="M46 67c5 3 9 4 14 4s9-1 14-4" fill="none" stroke="rgba(120,90,62,.12)" stroke-width="3" stroke-linecap="round"/>`
      : `<ellipse cx="48" cy="42" rx="14" ry="9" fill="rgba(255,255,255,.24)" transform="rotate(-18 48 42)"/><ellipse cx="55" cy="80" rx="15" ry="8" fill="rgba(255,255,255,.15)" transform="rotate(-10 55 80)"/><path d="M45 68c4 2 9 4 15 4 5 0 10-1 15-4" fill="none" stroke="rgba(120,90,62,.13)" stroke-width="3" stroke-linecap="round"/>`;
  const stageSpark = stage >= 4 ? `<g opacity="${stage >= 5 ? 0.95 : 0.72}"><circle cx="28" cy="38" r="2.2" fill="#FFF6DF"/><circle cx="90" cy="36" r="1.8" fill="#F2D98C"/><circle cx="95" cy="60" r="1.6" fill="#FFF6DF"/><circle cx="22" cy="60" r="1.5" fill="#F2D98C"/></g>` : '';
  return `<svg class="pet-svg" viewBox="0 0 120 118" style="--pet-scale:${scale.toFixed(3)}" aria-label="${def.name}">
    <defs>
      <radialGradient id="pet-cheek-${petId}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,255,255,.4)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
      <filter id="pet-soft-shadow-${petId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.8" stdDeviation="1.6" flood-color="rgba(118,88,56,.22)"/></filter>
    </defs>
    <g transform="translate(60,104) scale(var(--pet-scale)) translate(-60,-104)">${shadow}${aura}${stageSpark}<g filter="url(#pet-soft-shadow-${petId})">${accBack}${parts}${shine}${accFront}</g></g>
  </svg>`;
}

// 宠物容器（动作通过给 wrapper 加 pet-act-* 类触发）
export function petNode(petRow, { stage } = {}) {
  const st = stage || stageOf(petRow.growth || 0).n;
  const wrap = h('div', { class: 'pet-wrap pet-act-idle', 'data-pet': petRow.petId });
  wrap.innerHTML = petSVG(petRow.petId, { equip: petRow.equipped || {}, stage: st });
  return wrap;
}
export function petAct(wrap, act, ms = 1600) {
  if (!wrap) return;
  wrap.classList.remove('pet-act-idle');
  wrap.classList.add('pet-act-' + act);
  clearTimeout(wrap._actT);
  wrap._actT = setTimeout(() => { wrap.classList.remove('pet-act-' + act); wrap.classList.add('pet-act-idle'); }, ms);
}
// 漂浮反馈（爱心/音符/星星）
export function floatFx(container, kind = 'heart', x = 50, y = 40) {
  const marks = { heart: ['#E8657A', '#F0A2B2'], note: ['#7A8FB5', '#9AB5C9'], star: ['#D8A94D', '#F2D98C'] }[kind] || ['#D8A94D'];
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = 'float-mark';
    s.style.left = `calc(${x}% + ${(Math.random() * 30 - 15).toFixed(0)}px)`;
    s.style.top = y + '%';
    s.style.setProperty('--fdx', (Math.random() * 36 - 18) + 'px');
    s.style.animationDelay = (i * 0.12) + 's';
    const c = marks[i % marks.length];
    s.innerHTML = kind === 'heart'
      ? `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 20C7 16.5 4 13.5 4 10.2 4 7.9 5.8 6.5 7.8 6.5c1.6 0 3 .8 4.2 2.3 1.2-1.5 2.6-2.3 4.2-2.3 2 0 3.8 1.4 3.8 3.7 0 3.3-3 6.3-8 9.8z" fill="${c}"/></svg>`
      : kind === 'note'
        ? `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M9 18.5V6l10-2v12" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="18.5" r="2.6" fill="${c}"/><circle cx="17" cy="16" r="2.6" fill="${c}"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14"><polygon points="12,2 14.8,8.6 22,9.3 16.6,14 18.2,21 12,17.2 5.8,21 7.4,14 2,9.3 9.2,8.6" fill="${c}"/></svg>`;
    container.append(s);
    setTimeout(() => s.remove(), 1400);
  }
}

function spawnAmbient(container, stage = 4) {
  const count = Math.min(8, 3 + stage);
  for (let i = 0; i < count; i++) {
    const n = document.createElement('span');
    const spark = i % 3 === 0;
    n.className = 'scene-ambient ' + (spark ? 'spark' : 'dot');
    n.style.left = (26 + Math.random() * 50).toFixed(1) + '%';
    n.style.top = (28 + Math.random() * 44).toFixed(1) + '%';
    n.style.setProperty('--dx', (Math.random() * 28 - 14).toFixed(1) + 'px');
    n.style.setProperty('--dy', (20 + Math.random() * 42).toFixed(1) + 'px');
    n.style.setProperty('--dur', (4.2 + Math.random() * 2.4).toFixed(2) + 's');
    n.style.animationDelay = (Math.random() * 1.8).toFixed(2) + 's';
    if (spark) n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.7L19.5 10l-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.3z" fill="currentColor"/></svg>';
    container.append(n);
  }
}

// ---- 家园场景（固定槽位，不做自由拖拽）----
export const HOME_SLOTS = [
  { key: 'wall1', name: '墙面装饰 · 左', accept: ['furniture', 'display'], pos: 'left:9%;top:7%;width:14%' },
  { key: 'wall2', name: '墙面装饰 · 右', accept: ['furniture', 'display'], pos: 'left:27%;top:5%;width:14%' },
  { key: 'bed', name: '床', accept: ['furniture'], pos: 'left:3%;bottom:7%;width:27%' },
  { key: 'desk1', name: '桌面家具 · 左', accept: ['furniture'], pos: 'right:26%;bottom:9%;width:15%' },
  { key: 'desk2', name: '桌面家具 · 右', accept: ['furniture'], pos: 'right:9%;bottom:9%;width:15%' },
  { key: 'ground1', name: '地面家具 · 左', accept: ['furniture'], pos: 'left:31%;bottom:2%;width:12%' },
  { key: 'ground2', name: '地面家具 · 右', accept: ['furniture'], pos: 'left:62%;bottom:2%;width:12%' },
  { key: 'rug', name: '地毯', accept: ['furniture'], pos: 'left:50%;bottom:4%;width:32%;transform:translateX(-50%)' },
  { key: 'cabinet', name: '纪念展柜', accept: ['furniture', 'display'], pos: 'right:1%;bottom:34%;width:16%' },
];
export function renderHomeScene(container, layout, petRow, { onClickPet = null, stage } = {}) {
  container.innerHTML = '';
  container.classList.add('scene');
  const bgItem = layout.bg ? shopById(layout.bg) : null;
  if (bgItem) {
    container.append(h('img', { class: 'scene-bg', src: shopArt(layout.bg), alt: bgItem.name, draggable: 'false' }));
  } else {
    container.append(h('div', { class: 'scene-bg scene-bg-default' }));
  }
  // 墙面与远景
  for (const key of ['wall1', 'wall2', 'cabinet']) {
    const id = layout[key];
    if (id) container.append(h('img', { class: 'scene-item', style: HOME_SLOTS.find((s) => s.key === key).pos, src: shopArt(id), alt: '', draggable: 'false' }));
  }
  // 床、桌面
  for (const key of ['bed', 'desk1', 'desk2']) {
    const id = layout[key];
    if (id) container.append(h('img', { class: 'scene-item', style: HOME_SLOTS.find((s) => s.key === key).pos, src: shopArt(id), alt: '', draggable: 'false' }));
  }
  // 地毯与宠物
  if (layout.rug) container.append(h('img', { class: 'scene-item', style: HOME_SLOTS.find((s) => s.key === 'rug').pos, src: shopArt(layout.rug), alt: '', draggable: 'false' }));
  if ((stage || 1) >= 4) {
    const aura = h('div', { class: 'pet-stage-aura' });
    container.append(aura);
    spawnAmbient(container, stage || 1);
  }
  const pw = petNode(petRow, { stage });
  pw.style.cssText = 'position:absolute;left:44%;bottom:6%;width:34%;transform:translateX(-50%);z-index:5';
  if (onClickPet) pw.addEventListener('click', onClickPet);
  container.append(pw);
  // 前景地面家具
  for (const key of ['ground1', 'ground2']) {
    const id = layout[key];
    if (id) container.append(h('img', { class: 'scene-item scene-front', style: HOME_SLOTS.find((s) => s.key === key).pos, src: shopArt(id), alt: '', draggable: 'false' }));
  }
  return pw;
}
