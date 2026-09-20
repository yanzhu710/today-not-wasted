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
  const primary = def.petId === PRIMARY_PET_ID;
  const sourceFor = nextAction => primary
    ? new URL('../../' + petAssetPath(def.petId, stage, nextAction).replace(/^\.\//,''), import.meta.url).href
    : new URL(`../../assets/ui/pets/${def.petId}.webp`, import.meta.url).href;

  let disposed = false, token = 0, current = null, activeIndex = -1;
  // Neither buffer layer is active until its image has actually loaded,
  // otherwise an empty src layer would briefly show a broken-image icon.
  const layers = [0,1].map(() => h('img', {
    class: 'paper-pet-image pet-buffer-layer', alt: pet.name || '伙伴',
    width: '1024', height: '1024', decoding: 'async', draggable: 'false', 'aria-hidden': 'true',
  }));
  if (!primary) layers[1].hidden = true;

  const reveal = img => { fallback.hidden = true; img.hidden = false; img.classList.add('is-loaded'); };
  const setSource = (nextAction = 'idle') => {
    if (disposed) return;
    const act = nextAction || 'idle';
    wrap.dataset.action = act;
    if (!primary) {
      const img = layers[0];
      const wanted = sourceFor(act);
      if (img.src === wanted && img.classList.contains('is-loaded')) return;
      img.onload = () => reveal(img);
      img.onerror = () => {
        const png = new URL(`../../assets/pets/${def.petId}.png`, import.meta.url).href;
        if (img.src !== png) img.src = png; else { img.hidden = true; fallback.hidden = false; }
      };
      img.src = wanted;
      return;
    }
    if (current === act) return;
    const myToken = ++token;
    const nextIndex = activeIndex === 0 ? 1 : 0;
    const next = layers[nextIndex], prev = activeIndex >= 0 ? layers[activeIndex] : null;
    const wanted = sourceFor(act);
    next.classList.remove('is-loaded','is-active');
    next.setAttribute('aria-hidden','true');
    let settled = false;
    const finish = () => {
      if (settled || disposed || myToken !== token || next.naturalWidth === 0) return;
      settled = true;
      clearInterval(poll);
      reveal(next);
      next.classList.add('is-active'); next.setAttribute('aria-hidden','false');
      if (prev) { prev.classList.remove('is-active'); prev.setAttribute('aria-hidden','true'); }
      activeIndex = nextIndex; current = act;
    };
    next.onload = () => requestAnimationFrame(finish);
    next.onerror = () => {
      if (disposed || myToken !== token) return;
      settled = true; clearInterval(poll);
      if (act !== 'idle') { setSource('idle'); return; }
      next.classList.remove('is-active'); next.hidden = true; fallback.hidden = false;
    };
    next.src = wanted;
    // Service worker cache-first makes pet images complete almost instantly and
    // the `load` event is not always re-fired for an already-cached src; polling
    // complete state guarantees the loaded layer is activated exactly once.
    const poll = setInterval(() => {
      if (disposed || myToken !== token) { clearInterval(poll); return; }
      finish();
    }, 60);
    if (next.complete && next.naturalWidth) requestAnimationFrame(finish);
    setTimeout(() => { if (myToken === token && !disposed) { clearInterval(poll); } }, 6000);
  };

  wrap.append(fallback, ...layers);
  wrap._restPetAction = action || 'idle';
  wrap._setPetAction = setSource;
  setSource(action);

  // Preload all actions for the current stage once so the first real interaction does not flash.
  if (primary && typeof Image !== 'undefined') {
    queueMicrotask(() => {
      ['idle','happy','touch','feed','play','encourage','sleep','celebrate'].forEach(act => {
        const pre = new Image(); pre.decoding = 'async'; pre.src = sourceFor(act);
      });
    });
  }
  if (interactive && onClick) wrap.addEventListener('click', onClick);
  onDispose?.(() => { disposed = true; token++; wrap._paperAnimation?.cancel(); clearTimeout(wrap._paperTimer); });
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
  const scenePet = figure.closest?.('.companion-scene-pet');
  scenePet?.classList.add('is-interacting');
  clearTimeout(figure._paperTimer);
  figure._paperTimer=setTimeout(()=>{
    figure._setPetAction?.(figure._restPetAction || 'idle');
    scenePet?.classList.remove('is-interacting');
  }, mapped==='celebrate'?2500:1700);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || document.body.dataset.motion === 'off' || !figure.animate) return;
  figure._paperAnimation?.cancel();
  figure._paperAnimation = figure.animate(actions[mapped] || actions.touch, {
    duration: document.body.dataset.motion === 'light' ? 360 : 780,
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
