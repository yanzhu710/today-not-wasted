// 今天没白过 · 应用外壳：启动 / 路由 / 底部导航 / 全局“＋” / 静音 / PWA
import { initDB, loadKV, patchKV } from './core/db.js';
import { initEngine, DATA_EVENT, balance } from './core/engine.js';
import { initArt, setBadgeIndex, setShopIndex } from './core/art.js';
import { BADGES, SHOP } from './core/catalog.js';
import { h, qs, icon, todayKey, fmtCN, greeting, uid } from './core/util.js';
import * as sound from './core/sound.js';
import * as fx from './core/fx.js';
import { holidayName, dayInfo, nextHoliday } from './core/holidays.js';
import { APP_NAME, APP_VERSION, RELEASE_HIGHLIGHTS } from './core/appmeta.js';
import { renderOnboard } from './pages/onboard.js';
import { renderToday } from './pages/today.js';
import { renderPlan } from './pages/plan.js';
import { renderFootprint } from './pages/footprint.js';
import { renderHome } from './pages/home.js';
import { renderMine } from './pages/mine.js';
import { openFocus } from './pages/focus.js';

const app = qs('#app');
let shellBuilt = false;
let currentRoute = 'today';
let settings = null, profile = null, appMeta = null;
let deferredInstallPrompt = null;

const NAVS = [
  { id: 'today', name: '今天', ic: 'today', render: renderToday },
  { id: 'plan', name: '计划', ic: 'plan', render: renderPlan },
  { id: 'footprint', name: '足迹', ic: 'footprint', render: renderFootprint },
  { id: 'home', name: '伙伴', ic: 'home', render: renderHome },
  { id: 'mine', name: '我的', ic: 'mine', render: renderMine },
];

async function boot() {
  try {
    await initDB();
    appMeta = await loadKV('app_meta');
    settings = await loadKV('settings');
    profile = await loadKV('profile');
    applyTheme();
    sound.setMuted(settings.muted);
    sound.setVolume(settings.volume);
    fx.configure({ motion: settings.motion });
    setBadgeIndex(BADGES); setShopIndex(SHOP);
    await initArt();
    if (!appMeta.onboarded) {
      renderOnboard(app, async () => {
        appMeta = await loadKV('app_meta'); profile = await loadKV('profile');
        buildShell(); route('today');
      });
    } else {
      await initEngine();
      buildShell();
      route((location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'today');
    }
    registerPWA();
    globalListeners();
  } catch (err) {
    console.error(err);
    app.innerHTML = '';
    app.append(h('div', { class: 'boot-splash' }, '打开失败：' + (err && err.message ? err.message : err)));
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme === 'dark' ? 'dark' : '';
  document.body.classList.toggle('light-motion', settings.motion === 'off');
  const meta = qs('meta[name="theme-color"]');
  if (meta) meta.content = settings.theme === 'dark' ? '#22252B' : '#F7F3EA';
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
    const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'today';
    if (NAVS.some((n) => n.id === r) && r !== currentRoute) route(r);
  });
}
export function route(id) {
  const nav = NAVS.find((n) => n.id === id) || NAVS[0];
  currentRoute = nav.id;
  if (location.hash !== '#/' + nav.id) history.replaceState(null, '', '#/' + nav.id);
  for (const n of NAVS) qs('#tab-' + n.id)?.classList.toggle('active', n.id === nav.id);
  renderTopbar(nav);
  const view = qs('#view');
  view.innerHTML = '';
  document.body.dataset.route = nav.id;
  nav.render(view, { rerender: () => route(currentRoute) });
  requestAnimationFrame(() => {
    view.classList.remove('page-enter');
    void view.offsetWidth;
    view.classList.add('page-enter');
  });
}
function renderTopbar(nav) {
  const bar = qs('#topbar');
  if (!bar) return;
  bar.innerHTML = '';
  const dk = todayKey();
  const hol = holidayName(dk);
  const info = dayInfo(dk);
  const pts = h('button', { class: 'chip chip-pts', onclick: () => route('mine') }, icon('points'), h('span', { class: 'num', id: 'topbar-pts' }, String(balance())));
  const muteBtn = h('button', { class: 'iconbtn', id: 'topbar-mute', 'aria-label': '静音' }, icon(settings.muted ? 'muted' : 'mute'));
  muteBtn.addEventListener('click', toggleMute);
  if (nav.id === 'today') {
    const nick = profile.nickname || profile.account || '朋友';
    bar.append(
      h('div', { class: 'top-title' },
        h('div', { class: 'top-greet' }, `${greeting()}，${nick}`, h('small', null, `${fmtCN(dk)} ${info.makeup ? '· 调休上班' : hol ? '· ' + hol : info.weekend ? '· 周末' : ''}`))),
      pts, muteBtn);
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
    { ic: 'quick', label: '记一件完成的事', sub: '事情已经做完，直接记下来', onClick: () => import('./pages/today.js').then((m) => m.quickRecordDialog()) },
    { ic: 'task', label: '新建任务', onClick: () => import('./pages/today.js').then((m) => m.taskDialog()) },
    { ic: 'focus', label: '开始专注', onClick: () => openFocus().catch((e) => { console.error('focus error', e); toast('专注计时打开失败，请重试', { ic: 'error' }); }) },
    { ic: 'ledger', label: '记一笔', onClick: () => import('./pages/today.js').then((m) => m.quickLedgerDialog()) },
    { ic: 'journal', label: '写一句', onClick: () => import('./pages/footprint.js').then((m) => m.journalDialog()) },
    { ic: 'heart', label: '记录心情', onClick: () => import('./pages/footprint.js').then((m) => m.journalDialog({ moodOnly: true })) },
  ]);
}

function globalListeners() {
  // 音频解锁
  const unlock = () => { sound.unlockAudio(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock, { once: false });
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
  window.addEventListener('tjmbg:rerender', () => { if (shellBuilt) route(currentRoute); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && shellBuilt) route(currentRoute); });
}

// ---- PWA ----
function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('./sw.js?v=' + APP_VERSION).then((reg) => {
    // 已有 waiting worker（上次点了"稍后更新"），直接提示
    if (reg.waiting && navigator.serviceWorker.controller) {
      setTimeout(() => showUpdateModal(reg.waiting), 800);
    }
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateModal(nw);
        }
      });
    });
  }).catch(() => {});
}

async function showUpdateModal(worker) {
  const { openModal, toast } = await import('./core/fx.js');
  const list = h('div', { class: 'update-list' },
    RELEASE_HIGHLIGHTS.map((line) => h('div', { class: 'update-item' },
      h('span', { class: 'update-dot' }),
      h('span', null, line)
    ))
  );
  const content = h('div', null,
    h('p', { class: 'update-sub' }, '已为你准备好新版本，更新后体验更佳'),
    list
  );
  openModal({
    title: `新版本 v${APP_VERSION}`,
    content,
    actions: [
      {
        label: '稍后更新',
        onClick: (close) => { close(); },
      },
      {
        label: '立即更新',
        primary: true,
        onClick: (close) => {
          close();
          toast('正在更新...', { ic: 'refresh', ms: 1500 });
          let reloaded = false;
          const doReload = () => { if (!reloaded) { reloaded = true; location.reload(); } };
          navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
          try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch {}
          // 2秒兜底：如果controllerchange没触发就直接刷新
          setTimeout(doReload, 2000);
        },
      },
    ],
  });
}

boot();

// 供"我的"页面手动调用：检查更新
export async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) { fx.toast('当前浏览器不支持更新', { ic: 'star' }); return; }
  try {
    // 显示检查中弹窗
    const { openModal } = await import('./core/fx.js');
    const progBox = h('div', { style: 'text-align:center;padding:16px 0' },
      h('div', { style: 'font-size:14px;color:var(--muted);margin-bottom:12px' }, '正在检查更新...'),
      h('div', { style: 'width:100%;height:6px;background:var(--line);border-radius:3px;overflow:hidden' },
        h('div', { id: 'update-prog', style: 'height:100%;width:0%;background:var(--primary);border-radius:3px;transition:width .3s' }))
    );
    const upModal = openModal({ title: '检查更新', content: progBox, actions: [] });
    // 模拟进度
    const prog = document.getElementById('update-prog');
    let p = 0;
    const timer = setInterval(() => { p = Math.min(p + Math.random() * 25, 85); if (prog) prog.style.width = p + '%'; }, 200);

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { clearInterval(timer); upModal.close(); fx.toast('正在初始化，请稍后再试', { ic: 'star' }); return; }
    // 已有 waiting worker
    if (reg.waiting) {
      clearInterval(timer); upModal.close();
      showUpdateModal(reg.waiting); return;
    }
    // 手动检查更新
    await reg.update();
    clearInterval(timer); upModal.close();
    if (reg.waiting) { showUpdateModal(reg.waiting); return; }
    fx.toast('已是最新版本', { ic: 'check' });
  } catch {
    fx.toast('检查更新失败，请稍后再试', { ic: 'star' });
  }
}
