// 今天没白过 · 「我的」页：个人资料 / 积分 / 显示与声音 / 备份 / 应用 / 关于
import { all, get, put, del, count, loadKV, saveKV, patchKV, snapshotData, restoreData, mediaIds, clearEverything, SCHEMA_VERSION, DB_NAME } from '../core/db.js';
import { POINTS, GROWTH, BADGES } from '../core/catalog.js';
import { balance, stats, clearAllForReset, recomputeStats, confirmReview } from '../core/engine.js';
import { h, icon, todayKey, fmtCN, fmtMoney } from '../core/util.js';
import { openModal, formDlg, actionSheet, confirmDlg, toast, configure } from '../core/fx.js';
import { makeZip, readZip } from '../core/zip.js';
import { fillAvatar, clearAvatarCache } from '../core/avatar.js';
import { APP_NAME, APP_VERSION, APP_AUTHOR, RELEASE_HIGHLIGHTS } from '../core/appmeta.js';
import * as sound from '../core/sound.js';

export async function renderMine(view, ctx) {
  const { refreshSettings, setProfile, canInstallApp, promptInstallApp } = await import('../main.js');
  const [profile, settings, appMeta, pets, S, taskN, photoN, journalN] = await Promise.all([
    loadKV('profile'),
    loadKV('settings'),
    loadKV('app_meta'),
    all('pets'),
    Promise.resolve(stats() || {}),
    count('tasks').catch(() => 0),
    count('photos').catch(() => 0),
    count('journal').catch(() => 0),
  ]);
  const bal = balance();
  view.innerHTML = '';
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const hasSW = !!navigator.serviceWorker;

  // 资料卡
  const avatarEl = profile.avatarId ? h('div', { class: 'avatar', style: 'width:64px;height:64px;overflow:hidden' }) : h('div', { class: 'avatar-fb', style: 'width:64px;height:64px;font-size:22px' }, (profile.nickname || profile.account || '友')[0]);
  const profileCard = h('div', { class: 'card mine-profile-card', style: 'display:flex;align-items:center;gap:14px' },
    avatarEl,
    h('div', { class: 'row-main' },
      h('div', { style: 'font-size:17px;font-weight:800' }, profile.nickname || profile.account || '未设置'),
      h('div', { class: 'row-sub' }, h('span', null, `账户 ${profile.account || '—'}`), h('span', null, appMeta.createdAt ? `建档于 ${fmtCN(new Date(appMeta.createdAt).toISOString().slice(0, 10))}` : null))),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editProfile(ctx) }, icon('edit'), '编辑'));
  if (profile.avatarId) fillAvatar(avatarEl, profile.avatarId);

  // 积分
  const ptsCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('points'), '积分',
      h('button', { class: 'more', onclick: () => pointsDetail() }, '全部明细', icon('right'))),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat-cell' }, h('div', { class: 'v num', style: 'color:var(--reward)' }, String(bal)), h('div', { class: 'k' }, '当前余额')),
      h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, `${S.badgeCount || 0}/120`), h('div', { class: 'k' }, '徽章')),
      h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, String(S.focusMin || 0)), h('div', { class: 'k' }, '专注分钟'))),
    bal < 0 ? h('div', { class: 'form-hint', style: 'margin-top:8px;color:var(--accent)' }, `有 ${-bal} 待抵扣积分：撤销产生的差额将由之后的积分自动抵扣，已兑换的物品不受影响。`) : null,
    h('button',{class:'btn btn-soft btn-sm mine-reward-link',onclick:()=>{location.hash='#/home?tab=rewards&sub=shop';}},icon('gift'),'去商城'));

    // 显示与声音
  const themeSelect = h('select',{class:'input setting-select','aria-label':'显示模式'},
    h('option',{value:'warm',selected:settings.theme!=='dark'},'浅色手账'),
    h('option',{value:'dark',selected:settings.theme==='dark'},'夜读模式'));
  themeSelect.addEventListener('change',async()=>{await patchKV('settings',{theme:themeSelect.value});await refreshSettings();});
  const motionSelect = h('select',{class:'input setting-select','aria-label':'动画效果'},
    [['rich','完整动画'],['light','轻量动画'],['off','关闭动画']].map(([value,label])=>h('option',{value,selected:settings.motion===value},label)));
  motionSelect.addEventListener('change',async()=>{await patchKV('settings',{motion:motionSelect.value});await refreshSettings();});
  const soundSelect = h('select',{class:'input setting-select','aria-label':'声音效果'},
    h('option',{value:'on',selected:!settings.muted},'开启'),h('option',{value:'off',selected:!!settings.muted},'关闭'));
  soundSelect.addEventListener('change',async()=>{
    const muted=soundSelect.value==='off';await patchKV('settings',{muted});const s=await import('../core/sound.js');s.setMuted(muted);if(!muted){await s.unlockAudio();s.play('tap');}
    await refreshSettings();
  });
  const volume=h('input',{class:'input range mine-volume',type:'range',min:'0',max:'100',value:settings.volume,'aria-label':'声效音量',oninput:async e=>{await patchKV('settings',{volume:Number(e.target.value)});const s=await import('../core/sound.js');s.setVolume(Number(e.target.value));}});
  const setCard = h('section',{class:'card mine-settings-card'},
    h('div',{class:'card-title'},icon('settings'),'显示与声音'),
    settingRow('显示模式',themeSelect),
    settingRow('动画效果',motionSelect),
    settingRow('声音效果',soundSelect),
    settingRow('声效音量',h('div',{class:'setting-volume'},volume,h('button',{class:'btn btn-ghost btn-sm',onclick:async()=>{const s=await import('../core/sound.js');await s.unlockAudio();s.play('complete');}},'试听'))));

  // 数据与备份
  const dataCard = h('section',{class:'card'},
    h('div',{class:'card-title'},icon('download'),'数据与备份'),
    h('div',{class:'mine-menu-list'},
      mineMenu('导出备份',appMeta.lastBackupAt?`上次备份 ${fmtCN(new Date(appMeta.lastBackupAt).toISOString().slice(0,10))}`:'建议定期保存一份完整备份','download',exportBackup),
      mineMenu('导入恢复','从之前导出的备份恢复本机数据','upload',()=>importBackup(ctx)),
      mineMenu('存储空间','查看照片、记录等本机占用','settings',storageInfo),
      mineMenu('清空全部数据','此操作不可撤销','trash',dangerZone,'danger')));

  // 应用
  const appCard = h('section',{class:'card'},
    h('div',{class:'card-title'},icon('home'),'应用'),
    h('div',{class:'mine-menu-list'},
      mineMenu(canInstallApp()?'添加到主屏幕':'安装方式',standalone?'当前已作为独立应用运行':'添加到主屏幕后使用更方便','download',async()=>{
        if(canInstallApp()){const ok=await promptInstallApp();toast(ok?'安装提示已打开':'本次未安装',{ic:ok?'check':'info'});ctx.rerender();}else installGuide();
      }),
      mineMenu('检查更新',`当前版本 v${APP_VERSION}`,'refresh',async()=>{const m=await import('../main.js');m.checkForUpdate();}),
      mineMenu('版本说明','查看这次更新了什么','edit',releaseNotes)));

  // 关于
  const aboutCard = h('section',{class:'mine-about-inline'},
    h('b',null,APP_NAME),
    h('span',null,'把普通日子变成看得见的成就'),
    h('small',null,`v${APP_VERSION} · 制作人 ${APP_AUTHOR} · 数据仅保存在本机`));

  let encourageCard = null;
  const activePet = pets.find(p => p.petId === appMeta.activePet) || pets[0];
  if (activePet) {
    const { petFigure } = await import('../ui/paper.js');
    encourageCard = h('section',{class:'mine-encourage-card mine-blend-section'},
      h('div',{class:'mine-encourage-copy'},h('b',null,'生活或许不完美，'),h('span',null,'但依然值得期待。')),
      h('div',{class:'mine-encourage-pet'},petFigure(activePet)));
  }
  view.append(...[profileCard, ptsCard, setCard, dataCard, appCard, encourageCard, aboutCard].filter(Boolean));
}
function settingRow(label, ctrl) {
  return h('label',{class:'setting-row'},h('span',null,label),ctrl);
}
function mineMenu(title, sub, ic, onClick, tone='') {
  return h('button',{class:'mine-menu-item'+(tone?' '+tone:''),onclick:onClick},
    h('span',{class:'mine-menu-icon'},icon(ic)),
    h('span',{class:'mine-menu-copy'},h('b',null,title),sub?h('small',null,sub):null),icon('right'));
}

async function editProfile(ctx) {
  const { setProfile } = await import('../main.js');
  const profile = await loadKV('profile');
  const nickInp = h('input', { class: 'input', value: profile.nickname || '', placeholder: '昵称', maxlength: '12' });
  const avatarEl = h('div', { class: 'avatar-fb', style: 'width:72px;height:72px;font-size:12px;margin:0 auto;flex-wrap:wrap;line-height:1.3' }, '换头像');
  if (profile.avatarId) { avatarEl.className = 'avatar'; avatarEl.style.cssText = 'width:72px;height:72px;margin:0 auto;overflow:hidden'; fillAvatar(avatarEl, profile.avatarId); }
  let avatarId = profile.avatarId;
  avatarEl.addEventListener('click', () => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const { cropAndSave } = await import('./onboard.js');
      const id = await cropAndSave(f);
      if (id) { avatarId = id; avatarEl.className = 'avatar'; avatarEl.style.cssText = 'width:72px;height:72px;margin:0 auto;overflow:hidden'; fillAvatar(avatarEl, id); }
    });
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 8000);
  });
  openModal({
    title: '编辑资料',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, avatarEl),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '昵称'), nickInp),
      h('div', { class: 'form-hint' }, '账户名用于本机档案标识；换设备时可以通过备份迁移资料')),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: '保存', cls: 'btn-primary', onClick: async (c) => {
          await patchKV('profile', { nickname: nickInp.value.trim() || profile.account, avatarId });
          await setProfile(await loadKV('profile'));
          toast('已保存');
          c(); ctx.rerender();
        },
      },
    ],
  });
}

async function pointsDetail() {
  const rows = (await all('points')).sort((a, b) => b.ts - a.ts).slice(0, 100);
  const list = h('div');
  if (!rows.length) list.append(h('div', { class: 'empty' }, '还没有积分流水'));
  for (const r of rows) {
    list.append(h('div', { class: 'row-item' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', style: 'font-size:13.5px' }, r.reason),
        h('div', { class: 'row-sub' }, h('span', null, fmtCN(r.dateKey)), h('span', null, new Date(r.ts).toTimeString().slice(0, 5)))),
      h('span', { class: 'row-pts' + (r.delta < 0 ? ' neg' : '') }, (r.delta > 0 ? '+' : '') + r.delta)));
  }
  openModal({ title: `积分明细（余额 ${balance()}）`, content: list });
}

async function exportBackup() {
  toast('正在打包备份…', { ic: 'download' });
  const data = await snapshotData();
  const media = await mediaIds();
  const files = [{ name: 'data.json', data: JSON.stringify(data) }];
  for (const m of media) {
    const row = await get('photos', m.id).catch(() => null);
    if (!row) continue;
    files.push({ name: `media/${m.id}`, data: row.blob });
    if (row.thumb && row.thumb !== row.blob) files.push({ name: `media/${m.id}_t`, data: row.thumb });
  }
  const blob = await makeZip(files);
  const a = h('a', { href: URL.createObjectURL(blob), download: `${APP_NAME}_backup_v${APP_VERSION}_${todayKey()}_${String(new Date().getHours()).padStart(2,'0')}${String(new Date().getMinutes()).padStart(2,'0')}.zip` });
  document.body.append(a); a.click(); a.remove();
  await patchKV('app_meta', { lastBackupAt: Date.now() });
  toast(`备份完成（含 ${media.length} 张照片）`, { ic: 'check' });
  window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
}

async function importBackup(ctx) {
  const inp = h('input', { type: 'file', accept: '.zip', style: 'display:none' });
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      toast('正在读取备份…', { ic: 'download' });
      const files = await readZip(await f.arrayBuffer());
      const dataFile = files.find((x) => x.name === 'data.json');
      if (!dataFile) { toast('备份里没有找到 data.json', { ic: 'error' }); return; }
      const data = JSON.parse(new TextDecoder().decode(dataFile.data));
      if (!data.schemaVersion || !data.points) { toast('文件格式不对，无法导入', { ic: 'error' }); return; }
      const counts = Object.entries(data).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).slice(0, 8).join(' · ');
      const ok = await confirmDlg('确认恢复备份？',
        h('div', null,
          h('div', null, `备份时间：${data.exportedAt ? data.exportedAt.slice(0, 10) : '未知'}`),
          h('div', null, counts),
          h('div', { style: 'margin-top:6px;color:var(--danger)' }, '将整体替换当前所有数据（照片、账本、积分、徽章、宠物、背包、设置）。建议先导出一份当前数据。')),
        { okLabel: '替换', danger: true });
      if (!ok) return;
      const mediaFiles = files.filter((x) => x.name.startsWith('media/'));
      await restoreData(data);
      for (const mf of mediaFiles) {
        const id = mf.name.slice(6).replace(/_t$/, '');
        const isThumb = mf.name.endsWith('_t');
        const row = (await get('photos', id)) || { id, blob: null, thumb: null };
        if (isThumb) row.thumb = new Blob([mf.data]); else row.blob = new Blob([mf.data]);
        await put('photos', row);
      }
      const { initEngine } = await import('../core/engine.js');
      await initEngine();
      toast('恢复完成，积分与徽章已重新校验', { ic: 'check' });
      ctx.rerender();
      window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
    } catch (e) {
      console.error(e);
      toast('导入失败：' + (e.message || '文件无法解析'), { ic: 'error' });
    }
  });
  document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 8000);
}

async function storageInfo() {
  let text = '存储占用需要浏览器支持 navigator.storage 估算。';
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    text = `已用约 ${(est.usage / 1048576).toFixed(1)} MB，配额约 ${(est.quota / 1048576).toFixed(0)} MB。`;
  }
  const photos = await all('photos');
  openModal({
    title: '存储占用',
    content: h('div', { class: 'confirm-msg' },
      h('div', null, text),
      h('div', { style: 'margin-top:6px' }, `本地照片 ${photos.length} 张`),
      h('div', { style: 'margin-top:6px;color:var(--accent)' }, '注意：iPhone Safari 可能在较长时间不访问后清理网站数据。把本应用「添加到主屏幕」并定期导出备份，是最稳妥的保护方式。'),
      h('div', { style: 'margin-top:6px' }, `当前环境：${window.location.protocol.startsWith('https') ? 'HTTPS / 可注册离线缓存' : '非 HTTPS / PWA 能力可能受限'}`)),
    actions: [{ label: '知道了', cls: 'btn-primary', onClick: (c) => c() }],
  });
}


function releaseNotes() {
  openModal({
    title: `版本说明 · v${APP_VERSION}`,
    content: h('div', { class: 'form-list' },
      h('div', { class: 'card', style: 'margin:0;padding:12px;background:var(--surface2);box-shadow:none' },
        RELEASE_HIGHLIGHTS.map((t, i) => h('div', { class: 'row-item', style: i === RELEASE_HIGHLIGHTS.length - 1 ? 'border-bottom:0' : '' },
          h('span', { class: 'tag tag-pri', style: 'margin-right:2px' }, String(i + 1).padStart(2, '0')),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, t)))))),
    actions: [{ label: '知道了', cls: 'btn-primary', onClick: (c) => c() }],
  });
}

function installGuide() {
  openModal({
    title: '安装方式',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'confirm-msg' }, '不同浏览器入口不一样。如果当前浏览器没出现“添加到主屏幕”按钮，可以按下面方式手动安装。'),
      h('div', { class: 'card', style: 'margin:0;padding:12px;background:var(--surface2);box-shadow:none' },
        h('div', { class: 'row-item' }, h('span', { class: 'tag tag-pri' }, 'iPhone / iPad'), h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, 'Safari → 分享 → 添加到主屏幕'))),
        h('div', { class: 'row-item' }, h('span', { class: 'tag tag-pri' }, 'Android'), h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, 'Chrome → 菜单 → 安装应用 / 添加到主屏幕'))),
        h('div', { class: 'row-item', style: 'border-bottom:0' }, h('span', { class: 'tag tag-pri' }, '桌面端'), h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, 'Chrome / Edge 地址栏右侧一般会出现安装图标')))),
      h('div', { class: 'form-hint' }, '安装后体验更像独立 App，也更方便长期保存本地数据。')),
    actions: [{ label: '知道了', cls: 'btn-primary', onClick: (c) => c() }],
  });
}

async function dangerZone() {
  const inp = h('input', { class: 'input', placeholder: '输入「清空」以确认' });
  openModal({
    title: '清空全部数据',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'confirm-msg', style: 'color:var(--danger)' }, '将删除本机档案、全部记录、积分、徽章、宠物与背包，回到首次建档。此操作不可撤销，建议先导出备份。'),
      inp),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: '永久清空', cls: 'btn-danger', onClick: async (c) => {
          if (inp.value.trim() !== '清空') { toast('请输入「清空」两个字', { ic: 'error' }); return; }
          await clearAllForReset();
          c();
          location.reload();
        },
      },
    ],
  });
}


async function exportDiagnostics() {
  const [profile, settings, appMeta, taskN, photoN, journalN, pointsN, badgesN, petsN] = await Promise.all([
    loadKV('profile'), loadKV('settings'), loadKV('app_meta'), count('tasks').catch(() => 0), count('photos').catch(() => 0), count('journal').catch(() => 0), count('points').catch(() => 0), count('badges').catch(() => 0), count('pets').catch(() => 0),
  ]);
  const payload = {
    app: APP_NAME,
    version: APP_VERSION,
    dbName: DB_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    env: {
      href: location.href,
      protocol: location.protocol,
      host: location.host,
      standalone: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
      userAgent: navigator.userAgent,
      language: navigator.language,
      serviceWorker: 'serviceWorker' in navigator,
    },
    profile: { account: profile.account || '', nickname: profile.nickname || '', hasAvatar: !!profile.avatarId },
    settings: { theme: settings.theme, motion: settings.motion, muted: settings.muted, volume: settings.volume },
    appMeta: { createdAt: appMeta.createdAt, lastBackupAt: appMeta.lastBackupAt, onboarded: appMeta.onboarded },
    counts: { tasks: taskN, journal: journalN, photos: photoN, points: pointsN, badges: badgesN, pets: petsN },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `${APP_NAME}_diagnostics_v${APP_VERSION}_${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  toast('诊断文件已导出', { ic: 'check' });
}

async function preflightCheck() {
  const [profile, appMeta] = await Promise.all([loadKV('profile'), loadKV('app_meta')]);
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const httpsOk = window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  const backupOk = !!appMeta.lastBackupAt;
  const installOk = standalone || canInstallApp();
  const checklist = [
    { ok: backupOk, t: '备份', d: backupOk ? '已做过至少一次本机导出备份。' : '建议先导出一份 ZIP 备份，再长期使用或换设备。' },
    { ok: httpsOk, t: '运行环境', d: httpsOk ? '当前环境可用 HTTPS / localhost，PWA 能力可正常启用。' : '当前不是 HTTPS，GitHub Pages 发布后会恢复完整 PWA 能力。' },
    { ok: installOk, t: '安装能力', d: installOk ? (standalone ? '当前已经是独立安装形态。' : '当前浏览器支持安装，适合添加到主屏幕。') : '本浏览器未暴露安装提示，可按手动安装指引操作。' },
    { ok: !!(profile.nickname || profile.account), t: '本机档案', d: profile.nickname || profile.account ? `当前档案：${profile.nickname || profile.account}` : '还没有明确的档案名。' },
  ];
  openModal({
    title: '上线前检查详情',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'confirm-msg' }, '这不是技术测试报告，而是当前设备这一份应用是否适合正式长期使用的快速检查。'),
      h('div', { class: 'card', style: 'margin:0;padding:12px;background:var(--surface2);box-shadow:none' },
        checklist.map((x, i) => h('div', { class: 'row-item', style: i === checklist.length - 1 ? 'border-bottom:0' : '' },
          h('span', { class: 'tag ' + (x.ok ? 'tag-pri' : 'tag-acc'), style: 'min-width:42px;text-align:center;justify-content:center' }, x.ok ? '通过' : '待补'),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, x.t), h('div', { class: 'row-sub' }, x.d)) ))),
      h('div', { class: 'form-hint' }, '如果你是准备直接上传 GitHub 仓库，静态文件本身已经可以用；这里只是在检查“当前这台设备上这份数据”是否已准备妥当。')),
    actions: [{ label: '知道了', cls: 'btn-primary', onClick: (c) => c() }],
  });
}
