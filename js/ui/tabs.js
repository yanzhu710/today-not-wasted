// Unified route-backed tabs. The URL is the source of truth; visual state never owns navigation state.
import { h } from '../core/util.js';
import * as sound from '../core/sound.js';

export function routeTabs({ value, items, ariaLabel = '页面切换', className = '' }) {
  const root = h('div', { class: ('route-tabs ' + className).trim(), role: 'tablist', 'aria-label': ariaLabel });
  for (const item of items) {
    const current = item.id === value;
    const button = h('button', {
      type: 'button',
      class: 'route-tab' + (current ? ' on' : ''),
      role: 'tab',
      'aria-selected': String(current),
      tabindex: current ? '0' : '-1',
      onclick: () => {
        if (current) return;
        sound.play('tap');
        const href = typeof item.href === 'function' ? item.href(item.id) : item.href;
        if (href) location.hash = href.startsWith('#') ? href : '#/' + href.replace(/^\/?/, '');
      },
    }, item.label);
    root.append(button);
  }
  root.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = [...root.querySelectorAll('[role="tab"]')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    buttons[next].click();
  });
  return root;
}
