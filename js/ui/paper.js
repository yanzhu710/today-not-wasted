// Presentation only: this module never reads/writes the database or imports main.js.
import { h, icon } from '../core/util.js';
import { PETS } from '../core/catalog.js';

export function petFigure(pet, { interactive = false, onClick = null, onDispose = null } = {}) {
  const def = PETS.find(p => p.petId === pet.petId) || PETS[0];
  const wrap = h(interactive ? 'button' : 'div', {
    class: 'paper-pet', 'data-pet': def.petId,
    ...(interactive ? { type: 'button', 'aria-label': '摸摸' + (pet.name || def.name) } : {}),
  });
  const fallback = h('span', { class: 'paper-pet-fallback', 'aria-hidden': 'true' }, icon('pet'), h('span', null, pet.name || def.name));
  const img = h('img', { class: 'paper-pet-image', alt: pet.name || def.name,
    width: '512', height: '512', decoding: 'async', draggable: 'false' });
  let attempt = 0, failed = false;
  img.addEventListener('load', () => { if (failed) return; fallback.hidden = true; img.classList.add('is-loaded'); });
  img.addEventListener('error', () => {
    if (attempt++ === 0) img.src = new URL(`../../assets/pets/${def.petId}.png`, import.meta.url).href;
    else { failed = true; img.hidden = true; fallback.hidden = false; }
  });
  // Setting src after listeners also covers instantly cached images.
  img.src = new URL(`../../assets/ui/pets/${def.petId}.webp`, import.meta.url).href;
  wrap.append(fallback, img);
  if (interactive && onClick) wrap.addEventListener('click', onClick);
  onDispose?.(() => { wrap._paperAnimation?.cancel(); clearTimeout(wrap._paperTimer); });
  return wrap;
}

const actions = {
  touch: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.05, .93) rotate(-3deg)' }, { transform: 'scale(1, 1)' }],
  eat: [{ transform: 'rotate(0deg)' }, { transform: 'translateY(3px) rotate(4deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0deg)' }],
  happy: [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px) rotate(-4deg)' }, { transform: 'translateY(0)' }],
  play: [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px) rotate(-7deg)' }, { transform: 'translateX(12px) rotate(7deg)' }, { transform: 'translateX(0)' }],
};
export function petResponse(figure, bubble, text, action = 'touch') {
  if (!figure?.isConnected) return;
  if (bubble) bubble.textContent = text;
  const image = figure.querySelector('.paper-pet-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || document.body.dataset.motion === 'off' || !image?.animate) return;
  figure._paperAnimation?.cancel();
  figure._paperAnimation = image.animate(actions[action] || actions.touch, {
    duration: document.body.dataset.motion === 'light' ? 300 : 650,
    iterations: action === 'eat' ? 2 : 1, easing: 'ease-in-out',
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
