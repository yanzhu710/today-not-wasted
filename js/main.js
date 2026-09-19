// 今天没白过 · 应用外壳：启动 / 路由 / 底部导航 / 全局“＋” / 静音 / PWA
import { initDB, loadKV, patchKV } from './core/db.js';
import { initEngine, DATA_EVENT, balance, getActivePet, savePetName } from './core/engine.js';
import { initArt, setBadgeIndex, setShopIndex } from './core/art.js';
import { BADGES, SHOP } from './core/catalog.js';
import { h, qs, icon, todayKey, fmtCN, greeting, uid } from './core/util.js';
import * as sound from './core/sound.js';
import * as fx from './core/fx.js';
import { holidayName, dayInfo, nextHoliday } from './core/holidays.js';
import { APP_NAME, APP_VERSION, RELEASE_HIGHLIGHTS } from './core/appmeta.js';

const app = qs('#app');
let shellBuilt = false;
let currentRoute = 'today';
let settings = null, profile = null, appMeta = null;
let deferredInstallPrompt = null;

const NAVS = [
  { id: 'today', name: '今天', ic: 'today', load: () => import('./pages/today.js').then(m => m.renderToday) },
  { id: 'plan', name: '计划', ic: 'plan', load: () => import('./pages/plan.js').then(m => m.renderPlan) },
  { id: 'footprint', name: '记录', ic: 'book', load: () => import('./pages/footprint.js').then(m => m.renderFootprint) },
  { id: 'home', name: '伙伴', ic: 'pet', load: () => import('./pages/home.js').then(m => m.renderHome) },
  { id: 'mine', name: '我的', ic: 'mine', load: () => import('./pages/mine.js').then(m => m.renderMine) },
];

async function boot() {
  const status = window.__tjmbgBoot;
  try {
    status?.step('正在读取本机档案');
    await initDB();
    [appMeta, settings, profile] = await Promise.all([loadKV('app_meta'), loadKV('settings'), loadKV('profile')]);
    applyTheme();
    sound.setMuted(settings.muted); sound.setVolume(settings.volume);
    fx.configure({ motion: settings.motion });
    setBadgeIndex(BADGES); setShopIndex(SHOP);
    status?.step('正在准备美术资源');
    // initArt has its own short timeout. Images never gate application startup.
    await initArt();
    status?.step('正在打开页面');
    if (!appMeta.onboarded) {
      const { renderOnboard } = await import('./pages/onboard.js');
      renderOnboard(app, async () => {
        appMeta = await loadKV('app_meta'); profile = await loadKV('profile');
        await initEngine(); buildShell(); await route('today');
      });
    } else {
      await initEngine(); buildShell();
      await route((location.hash || '').replace(/^#\/?/, '') || 'today');
    }
    status?.ready();
    globalListeners();
    setTimeout(() => { promptCompanionNameIfNeeded().catch(error => console.warn('伙伴命名提示未完成', error)); }, 220);
    registerPWA(); // Optional, deliberately not awaited.
  } catch (error) {
    console.error(error);
    if (status) status.fail(error);
    else app.replaceChildren(h('section', { class:'card' }, h('p',null,'打开未完成。已保存的数据没有被清空。'),
      h('button',{class:'btn btn-primary',onclick:()=>location.reload()},'重新打开')));
  }
}


async function promptCompanionNameIfNeeded() {
  const pet = await getActivePet().catch(() => null);
  if (!pet || String(pet.name || '').trim()) return;
  const values = await fx.formDlg({
    title: '给你的伙伴起个名字', submitLabel: '记住这个名字',
    fields: [{ key:'name', label:'名字', type:'text', placeholder:'1–12 个字', required:true }],
  });
  const name = String(values?.name || '').trim().slice(0, 12);
  if (!name) return;
  await savePetName(pet, name);
  await patchKV('profile', { petName:name });
  fx.toast('从今天起，就这样叫它啦', { ic:'heart' });
  if (shellBuilt) route(activeRouteSpec || currentRoute);
}

function applyTheme() {
  document.body.dataset.motion = settings.motion || 'rich';
  document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : '';
  document.body.classList.toggle('light-motion', settings.motion === 'off');
  const meta = qs('meta[name="theme-color"]');
  if (meta) meta.content = settings.theme === 'dark' ? '#18211D' : '#F7F3EA';
}
export function refreshSettings() { return (async () => { settings = await loadKV('settings'); applyTheme(); sound.setMuted(settings.muted); sound.setVolume(settings.volume); fx.configure({ motion: settings.motion }); })(); }
export function getSettings() { return settings; }
export function getProfile() { return profile; }
export function getMeta() { return appMeta; }
export function setProfile(p) { profile = p; }
export function canInstallApp() { return !!deferredInstallPrompt; }
export async function promptInstallApp() {
  if (!deferredInstallPrompt) return false;
  const prompt = deferredInstallPrompt;
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (choice.outcome === 'accepted') deferredInstallPrompt = null;
  return choice.outcome === 'accepted';
}

function buildShell() {
  document.title = APP_NAME;
  if (shellBuilt) return;
  shellBuilt = true;
  app.innerHTML = '';
  const shell = h('div', { class: 'shell' },
    h('div', { class: 'topbar', id: 'topbar' }),
    h('main', { class: 'view', id: 'view' }),
  );
  const tabbar = h('nav', { class: 'tabbar', id: 'tabbar' },
    NAVS.map((n) => h('button', { class: 'tab-item', id: 'tab-' + n.id, onclick: () => { sound.play('tap'); route(n.id); } }, icon(n.ic), h('span', null, n.name))));
  const fab = h('button', { class: 'fab', id: 'fab', 'aria-label': '快捷记录', onclick: () => { sound.play('tap'); openPlusSheet(); } }, icon('plus'));
  app.append(shell, tabbar, fab);
  window.addEventListener('hashchange', () => {
    const spec = (location.hash || '').replace(/^#\/?/, '') || 'today';
    if (NAVS.some(n => n.id === spec.split('?')[0]) && spec !== activeRouteSpec) route(spec);
  });
}
let renderSequence = 0;
let activeRouteSpec = '';
let routeDisposers = [];
export async function route(id) {
  const requested = String(id || 'today').replace(/^#\/?/, '');
  const [page, query] = requested.split('?');
  const nav = NAVS.find(n => n.id === page) || NAVS[0];
  const samePage = currentRoute === nav.id;
  const params = new URLSearchParams(query ?? (samePage ? activeRouteSpec.split('?')[1] || '' : ''));
  const spec = nav.id + (params.toString() ? '?' + params.toString() : '');
  currentRoute = nav.id; activeRouteSpec = spec;
  if (location.hash !== '#/' + spec) history.replaceState(null, '', '#/' + spec);
  for (const n of NAVS) {
    const tab=qs('#tab-'+n.id);tab?.classList.toggle('active',n.id===nav.id);
    if(n.id===nav.id)tab?.setAttribute('aria-current','page');else tab?.removeAttribute('aria-current');
  }
  renderTopbar(nav);
  const oldView=qs('#view'); if(!oldView)return;
  routeDisposers.forEach(dispose=>{try{dispose();}catch{}});routeDisposers=[];
  const cleanups=[];routeDisposers=cleanups;
  const ticket=++renderSequence;
  const view=h('main',{class:'view',id:'view','aria-busy':'true'});
  const loading=h('div',{class:'paper-route-loading',role:'status'},'正在打开'+nav.name+'…');
  view.append(loading);oldView.replaceWith(view);document.body.dataset.route=nav.id;
  try {
    // A broken optional page cannot keep every page on the boot splash.
    const render=await nav.load();
    if(ticket!==renderSequence)return;
    view.replaceChildren();
    await render(view,{
      routeParams:params,
      rerender:(nextSpec)=>{if(ticket===renderSequence)return route(typeof nextSpec==='string'?nextSpec:spec);},
      onDispose:dispose=>{if(typeof dispose==='function'){if(ticket===renderSequence)cleanups.push(dispose);else dispose();}},
    });
    if(ticket!==renderSequence)return;
    view.removeAttribute('aria-busy');
    requestAnimationFrame(()=>{if(view.isConnected)view.classList.add('page-enter');});
  } catch(error) {
    if(ticket!==renderSequence)return;
    console.error(error);view.removeAttribute('aria-busy');
    view.replaceChildren(h('section',{class:'card paper-route-error'},h('h2',null,'这一页暂时没有打开'),
      h('p',null,'可以切换其他页面，或重新加载。已保存的数据没有被删除。'),
      h('details',null,h('summary',null,'查看错误信息'),h('pre',null,String(error.message||error))),
      h('button',{class:'btn btn-primary',onclick:()=>route(spec)},'重新加载这一页')));
  }
}
function renderTopbar(nav) {
  const bar = qs('#topbar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.className = 'topbar topbar-' + nav.id;
  const dk = todayKey();
  const hol = holidayName(dk);
  const info = dayInfo(dk);
  const pts = h('button', { class: 'chip chip-pts', onclick: () => route('mine') }, icon('points'), h('span', { class: 'num', id: 'topbar-pts' }, String(balance())));
  const muteBtn = h('button', { class: 'iconbtn', id: 'topbar-mute', 'aria-label': '静音' }, icon(settings.muted ? 'muted' : 'mute'));
  muteBtn.addEventListener('click', toggleMute);
  if (nav.id === 'today') {
    const nick = profile.nickname || profile.account || '朋友';
    bar.append(
      h('div',{class:'ref-brand'},h('div',{class:'ref-brand-title'},'今天没白过',h('span',{'aria-hidden':'true'},'〆')),h('div',{class:'ref-brand-sub'},'把平凡的日子，过成喜欢的样子。')),
      h('div',{class:'ref-date-block'},h('b',null,fmtCN(dk)),h('span',null,`${greeting()}，${nick}`),h('i',null,info.makeup?'调休上班':hol|| (info.weekend?'周末':'今天也加油！'))));
  } else if (nav.id === 'home') {
    bar.append(
      h('div',{class:'ref-brand'},h('div',{class:'ref-brand-title'},'今天没白过',h('span',{class:'ref-paw-mark','aria-hidden':'true'},'•')),h('div',{class:'ref-brand-sub'},'有你陪着，每天都是好日子～')),
      h('div',{class:'ref-top-actions'},
        h('button',{class:'ref-top-square',onclick:()=>route('home?tab=badges')},icon('badge'),h('span',null,'徽章')),
        h('button',{class:'ref-top-square',onclick:()=>route('mine')},icon('settings'),h('span',null,'设置'))));
  } else {
    bar.append(...[h('div', { class: 'top-title' }, nav.name), hol ? h('span', { class: 'chip chip-holiday' }, hol) : null, pts, muteBtn].filter(Boolean));
  }
}
export async function refreshTopbarPoints() {
  const el = qs('#topbar-pts');
  if (el) el.textContent = String(balance());
}
export async function toggleMute() {
  settings = await loadKV('settings');
  settings.muted = !settings.muted;
  await patchKV('settings', { muted: settings.muted });
  sound.setMuted(settings.muted);
  sound.play('toggle');
  const btn = qs('#topbar-mute');
  if (btn) { btn.innerHTML = ''; btn.append(icon(settings.muted ? 'muted' : 'mute')); }
  fx.toast(settings.muted ? '已静音，声音全关' : '声音已开启', { ic: settings.muted ? 'muted' : 'volume' });
}

// ---- 全局“＋” ----
async function openPlusSheet() {
  const { actionSheet } = await import('./core/fx.js');
  await actionSheet('记一笔今天', [
    { ic: 'quick', label: '记录一件小事', sub: '记下今天已经发生的一件小事', onClick: () => import('./pages/today.js').then((m) => m.quickRecordDialog()) },
    { ic: 'task', label: '新建任务', onClick: () => import('./pages/today.js').then((m) => m.taskDialog()) },
    { ic: 'focus', label: '开始专注', onClick: () => import('./pages/focus.js').then(m => m.openFocus()).catch(e => { console.error(e); fx.toast('专注计时打开失败，请重试',{ic:'error'}); }) },
    { ic: 'ledger', label: '记一笔', onClick: () => import('./pages/today.js').then((m) => m.quickLedgerDialog()) },
    { ic: 'heart', label: '记心情', onClick: () => import('./pages/footprint.js').then((m) => m.journalDialog()) },
  ]);
}

function globalListeners() {
  window.addEventListener('tjmbg:error', e => fx.toast(e.detail?.message || '操作未完成，请重试', {ic:'error',ms:3200}));
  // 音频解锁
  const unlock = () => { sound.unlockAudio(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock, { once: false });
  // Give ordinary controls consistent tactile audio feedback. Special actions can still play their own
  // completion/purchase/pet sound; identical tap sounds are coalesced in sound.play().
  document.addEventListener('click', (e) => {
    const control = e.target?.closest?.('button, a, [role=\"button\"]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true' || control.dataset.silentSound === '1') return;
    sound.play('tap');
  }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fx.closeTopModal(); });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('tjmbg:installprompt'));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    fx.toast('已添加到主屏幕', { ic: 'check' });
    window.dispatchEvent(new CustomEvent('tjmbg:installprompt'));
  });
  window.addEventListener('tjmbg:installprompt', () => { if (shellBuilt && currentRoute === 'mine') route('mine'); });
  // 数据变化 → 刷新积分显示与当前页
  window.addEventListener(DATA_EVENT, () => { refreshTopbarPoints(); });
  window.addEventListener('tjmbg:rerender', () => { if (shellBuilt) route(activeRouteSpec || currentRoute); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && shellBuilt && !document.querySelector('.modal-back.show') && !document.activeElement?.matches('input,textarea,select')) route(activeRouteSpec || currentRoute); });
}

// ---- Optional PWA controller, loaded after a usable screen is visible. ----
function registerPWA() {
  import('./core/updates.js').then(m => m.registerUpdates()).catch(error => console.warn('离线更新模块暂不可用',error));
}
export async function checkForUpdate() {
  try { const { checkUpdates } = await import('./core/updates.js'); await checkUpdates(); }
  catch(error) { fx.toast('检查更新未完成：'+error.message,{ic:'error'}); }
}
boot();
