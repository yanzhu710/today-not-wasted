// Presentation only: this module never reads/writes the database or imports main.js.
import { h, icon } from '../core/util.js';
import { PETS, PRIMARY_PET_ID, stageOf } from '../core/catalog.js';
import { petAssetPath } from '../core/pets.js';

export function petFigure(pet, { interactive = false, onClick = null, onDispose = null, action = 'idle' } = {}) {
  const def = PETS.find(p => p.petId === pet.petId) || PETS[0];
  const stage = stageOf(pet.growth || 0, !!pet.coronationAt).n;
  const wrap = h(interactive ? 'button' : 'div', {
    class: 'paper-pet', 'data-pet': def.petId, 'data-stage': String(stage), 'data-action': action,
    ...(interactive ? { type: 'button', 'aria-label': '和' + (pet.name || '伙伴') + '互动' } : {}),
  });
  const fallback = h('span', { class: 'paper-pet-fallback', 'aria-hidden': 'true' }, icon('pet'), h('span', null, pet.name || '伙伴'));
  const img = h('img', { class: 'paper-pet-image', alt: pet.name || '伙伴', width: '1024', height: '1024', decoding: 'async', draggable: 'false' });
  let failed = false;
  const setSource = nextAction => {
    const act = nextAction || 'idle';
    wrap.dataset.action = act;
    if (def.petId === PRIMARY_PET_ID) img.src = new URL('../../' + petAssetPath(def.petId, stage, act).replace(/^\.\//,''), import.meta.url).href;
    else img.src = new URL(`../../assets/ui/pets/${def.petId}.webp`, import.meta.url).href;
  };
  img.addEventListener('load', () => { if (failed) return; fallback.hidden = true; img.hidden = false; img.classList.add('is-loaded'); });
  img.addEventListener('error', () => {
    if (def.petId === PRIMARY_PET_ID && wrap.dataset.action !== 'idle') { setSource('idle'); return; }
    if (def.petId !== PRIMARY_PET_ID && !failed) { failed = true; img.src = new URL(`../../assets/pets/${def.petId}.png`, import.meta.url).href; return; }
    img.hidden = true; fallback.hidden = false;
  });
  setSource(action);
  wrap.append(fallback, img);
  wrap._restPetAction = action || 'idle';
  wrap._setPetAction = setSource;
  if (interactive && onClick) wrap.addEventListener('click', onClick);
  onDispose?.(() => { wrap._paperAnimation?.cancel(); clearTimeout(wrap._paperTimer); });
  return wrap;
}

const actions = {
  touch: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.05, .93) rotate(-3deg)' }, { transform: 'scale(1, 1)' }],
  feed: [{ transform: 'rotate(0deg)' }, { transform: 'translateY(4px) rotate(3deg)' }, { transform: 'translateY(1px) rotate(-2deg)' }, { transform: 'rotate(0deg)' }],
  encourage: [{ transform:'scale(1)' },{ transform:'scale(1.05) rotate(2deg)' },{ transform:'scale(1)' }],
  celebrate: [{ transform:'translateY(0) scale(1)' },{ transform:'translateY(-16px) scale(1.08) rotate(-5deg)' },{ transform:'translateY(0) scale(1)' }],
  happy: [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px) rotate(-4deg)' }, { transform: 'translateY(0)' }],
  play: [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px) rotate(-7deg)' }, { transform: 'translateX(12px) rotate(7deg)' }, { transform: 'translateX(0)' }],
};
export function petResponse(figure, bubble, text, action = 'touch') {
  if (!figure?.isConnected) return;
  if (bubble) bubble.textContent = text;
  const mapped = action === 'eat' ? 'feed' : action;
  figure._setPetAction?.(mapped);
  clearTimeout(figure._paperTimer);
  figure._paperTimer=setTimeout(()=>figure._setPetAction?.(figure._restPetAction || 'idle'), mapped==='celebrate'?2200:1500);
  const image = figure.querySelector('.paper-pet-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || document.body.dataset.motion === 'off' || !image?.animate) return;
  figure._paperAnimation?.cancel();
  figure._paperAnimation = image.animate(actions[mapped] || actions.touch, {
    duration: document.body.dataset.motion === 'light' ? 320 : 720,
    iterations: mapped === 'feed' ? 2 : 1, easing: 'cubic-bezier(.22,.8,.3,1)',
  });
}

export function metric(label, value, unit = '', symbol = 'star') {
  return h('div', { class: 'paper-metric' },
    h('span', { class: 'paper-metric-icon', 'aria-hidden': 'true' }, icon(symbol)),
    h('strong', { class: 'num' }, String(value), unit ? h('small', null, unit) : null),
    h('span', { class: 'paper-metric-label' }, label));
}
export function sectionHeading(title, note = '') {
  return h('div', { class: 'paper-section-heading' }, h('h2', null, title), note ? h('span', null, note) : null);
}
