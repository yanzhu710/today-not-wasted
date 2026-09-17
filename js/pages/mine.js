// 今天没白过 · 「我的」页：个人资料 / 积分明细 / 自定义奖励 / 设置 / 备份与数据管理 / 关于
import { all, get, put, del, count, loadKV, saveKV, patchKV, snapshotData, restoreData, mediaIds, clearEverything, SCHEMA_VERSION, DB_NAME } from '../core/db.js';
import { POINTS, GROWTH, BADGES } from '../core/catalog.js';
import { balance, stats, clearAllForReset, grantOnce, recomputeStats, confirmReview } from '../core/engine.js';
import { h, icon, todayKey, fmtCN, fmtMoney, uid } from '../core/util.js';
import { openModal, formDlg, actionSheet, confirmDlg, toast, configure } from '../core/fx.js';
import { makeZip, readZip } from '../core/zip.js';
import { refreshSettings, setProfile, canInstallApp, promptInstallApp } from '../main.js';
import { fillAvatar } from './onboard.js';
import { APP_NAME, APP_VERSION, APP_AUTHOR, RELEASE_HIGHLIGHTS } from '../core/appmeta.js';
import * as sound from '../core/sound.js';

export async function renderMine(view, ctx) {
  const [profile, settings, appMeta, S, taskN, photoN, journalN] = await Promise.all([
    loadKV('profile'),
    loadKV('settings'),
    loadKV('app_meta'),
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
  const profileCard = h('div', { class: 'card', style: 'display:flex;align-items:center;gap:14px' },
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
    bal < 0 ? h('div', { class: 'form-hint', style: 'margin-top:8px;color:var(--accent)' }, `有 ${-bal} 待抵扣积分：撤销产生的差额将由之后的积分自动抵扣，已兑换的物品不受影响。`) : null);

  // 自定义现实奖励
  const rewardCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('gift'), '自定义现实奖励',
      h('button', { class: 'more', onclick: async () => {
        const v = await formDlg({
          title: '新增现实奖励',
          fields: [
            { key: 't', label: '奖励内容', type: 'text', placeholder: '例如：完成目标后看一场电影' },
            { key: 'c', label: '所需积分（可选，用积分兑换）', type: 'number', placeholder: '如 100' },
          ],
          submitLabel: '添加',
        });
        if (!v || !v.t.trim()) return;
        await put('custom_rewards', { id: uid('cr'), title: v.t.trim(), cost: Number(v.c) || 0, doneAt: null, createdAt: Date.now() });
        ctx.rerender();
      } }, icon('plus'), '添加')));
  const rewards = await all('custom_rewards');
  if (!rewards.length) rewardCard.append(h('div', { class: 'empty' }, '给自己定一个现实奖励，系统只记录状态，不负责兑现'));
  for (const r of rewards) {
    rewardCard.append(h('div', { class: 'row-item' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', style: 'font-size:13.5px' + (r.doneAt ? ' done' : '') }, r.title),
        h('div', { class: 'row-sub' }, r.cost ? h('span', { class: 'num' }, `${r.cost} 积分`) : h('span', null, '达标后自取'), r.doneAt ? h('span', null, `已兑换 ${fmtCN(new Date(r.doneAt).toISOString().slice(0, 10))}`) : null)),
      !r.doneAt && r.cost ? h('button', { class: 'btn btn-soft btn-sm', onclick: async () => {
        if (balance() < r.cost) { toast('积分还不够', { ic: 'error' }); return; }
        await grantOnce('custom:' + r.id + ':' + Date.now(), { delta: -r.cost, reason: `兑换现实奖励「${r.title}」`, kind: 'purchase', cls: 'purchase' });
        r.doneAt = Date.now();
        await put('custom_rewards', r);
        sound.play('purchase');
        toast('已兑换，去享受吧');
        ctx.rerender();
      } }, '兑换') : null,
      !r.doneAt && !r.cost ? h('button', { class: 'btn btn-soft btn-sm', onclick: async () => { r.doneAt = Date.now(); await put('custom_rewards', r); toast('恭喜，记录已更新'); ctx.rerender(); } }, '标记完成') : null,
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: async () => { await del('custom_rewards', r.id); ctx.rerender(); } }, icon('trash'))));
  }

  // 设置
  const setCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('settings'), '外观与体验'),
    setRow('主题', h('div', { class: 'seg', style: 'width:190px' },
      h('button', { class: settings.theme !== 'dark' ? 'on' : '', onclick: async (e) => { await patchKV('settings', { theme: 'warm' }); await refreshSettings(); e.currentTarget.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === 0)); } }, '温暖手账'),
      h('button', { class: settings.theme === 'dark' ? 'on' : '', onclick: async (e) => { await patchKV('settings', { theme: 'dark' }); await refreshSettings(); e.currentTarget.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === 1)); } }, icon('moon'), '夜读'))),
    setRow('动效', h('div', { class: 'seg', style: 'width:230px' },
      ['rich', 'light', 'off'].map((m, i) => h('button', { class: settings.motion === m ? 'on' : '', onclick: async (e) => { await patchKV('settings', { motion: m }); await refreshSettings(); e.currentTarget.parentElement.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i)); } }, ['丰富', '轻', '关'][i])))),
    setRow('声音', h('div', { style: 'display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-end' },
      h('button', { class: 'iconbtn', style: 'width:38px;height:38px', onclick: async () => { const { toggleMute } = await import('../main.js'); toggleMute(); setTimeout(() => ctx.rerender(), 100); } }, icon(settings.muted ? 'muted' : 'volume')),
      h('input', { class: 'input range', type: 'range', min: '0', max: '100', value: settings.volume, style: 'width:130px', oninput: async (e) => { await patchKV('settings', { volume: Number(e.target.value) }); const { setVolume } = await import('../core/sound.js'); setVolume(Number(e.target.value)); } }),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { const s = await import('../core/sound.js'); s.unlockAudio(); s.play('complete'); } }, '试听'))),
    h('div', { class: 'form-hint', style: 'margin-top:4px' }, '系统开启「减少动态效果」时会自动进入轻动效；静音开关随时可以在顶部使用'));

  // 数据与备份
  const dataCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('download'), '备份与数据'),
    h('div', { class: 'form-hint', style: 'margin-bottom:8px' },
      appMeta.lastBackupAt ? `上次备份：${fmtCN(new Date(appMeta.lastBackupAt).toISOString().slice(0, 10))} ${new Date(appMeta.lastBackupAt).toTimeString().slice(0, 5)}` : '还没有备份过。数据只存在这台设备上，建议定期导出'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-primary btn-sm', style: 'flex:1', onclick: exportBackup }, icon('download'), '导出备份'),
      h('button', { class: 'btn btn-ghost btn-sm', style: 'flex:1', onclick: () => importBackup(ctx) }, icon('upload'), '导入恢复')),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn btn-ghost btn-sm', style: 'flex:1', onclick: storageInfo }, icon('settings'), '存储占用'),
      h('button', { class: 'btn btn-danger btn-sm', style: 'flex:1', onclick: dangerZone }, icon('trash'), '清空全部数据')));

  // 系统状态
  const statusCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('search'), '设备与状态'),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat-cell' }, h('div', { class: 'v' }, standalone ? '已安装' : '网页'), h('div', { class: 'k' }, '运行形态')),
      h('div', { class: 'stat-cell' }, h('div', { class: 'v' }, canInstallApp() ? '可安装' : '已处理'), h('div', { class: 'k' }, '安装状态')),
      h('div', { class: 'stat-cell' }, h('div', { class: 'v' }, hasSW ? 'PWA' : 'Web'), h('div', { class: 'k' }, '离线能力'))),
    h('div', { class: 'row-sub', style: 'margin-top:10px;gap:6px' },
      h('span', { class: 'tag tag-pri' }, `任务 ${taskN}`),
      h('span', { class: 'tag' }, `日记 ${journalN}`),
      h('span', { class: 'tag' }, `照片 ${photoN}`),
      h('span', { class: 'tag tag-acc' }, `Schema v${SCHEMA_VERSION}`)),
    h('div', { class: 'form-hint', style: 'margin-top:8px;line-height:1.8' },
      appMeta.lastBackupAt ? `最近一次备份：${fmtCN(new Date(appMeta.lastBackupAt).toISOString().slice(0, 10))} ${new Date(appMeta.lastBackupAt).toTimeString().slice(0, 5)}。` : '还没有导出备份，正式长期使用前建议先做一次完整备份。',
      ' 当前为纯本地模式，不依赖服务器。'));

  // 安装与发布
  const installCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('download'), '安装与发布'),
    h('div', { class: 'row-sub', style: 'margin-bottom:10px' }, '建议添加到主屏幕使用，也更有利于长期保留本地数据。'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ' + (canInstallApp() ? 'btn-primary' : 'btn-ghost') + ' btn-sm', style: 'flex:1', onclick: async () => {
        if (canInstallApp()) {
          const ok = await promptInstallApp();
          toast(ok ? '安装提示已弹出' : '本次未安装', { ic: ok ? 'check' : 'info' });
          ctx.rerender();
        } else installGuide();
      } }, icon('download'), canInstallApp() ? '添加到主屏幕' : '查看安装方式'),
      h('button', { class: 'btn btn-ghost btn-sm', style: 'flex:1', onclick: releaseNotes }, icon('edit'), '版本说明')));

  const preflightItems = [
    { ok: !!appMeta.lastBackupAt, label: '已做一次本机备份', sub: appMeta.lastBackupAt ? `最近备份 ${fmtCN(new Date(appMeta.lastBackupAt).toISOString().slice(0, 10))}` : '正式上线或迁移设备前建议先导出一次' },
    { ok: window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname), label: '运行环境支持 PWA', sub: window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname) ? '当前环境可注册 Service Worker' : 'GitHub Pages 发布后会自动变为 HTTPS' },
    { ok: standalone || canInstallApp(), label: '支持安装到主屏幕', sub: standalone ? '当前已是独立应用形态' : canInstallApp() ? '当前浏览器已给出安装提示能力' : '部分浏览器需要手动从菜单里安装' },
    { ok: !!profile.nickname || !!profile.account, label: '资料与本机档案已建立', sub: profile.nickname || profile.account ? `当前档案：${profile.nickname || profile.account}` : '建议先完成资料确认' },
    { ok: taskN + journalN + photoN > 0, label: '已有真实数据样例', sub: `任务 ${taskN} · 手账 ${journalN} · 照片 ${photoN}` },
  ];
  const passN = preflightItems.filter((x) => x.ok).length;
  const preflightCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('check'), '上线前检查', h('span', { class: 'tag ' + (passN === preflightItems.length ? 'tag-pri' : '') }, `${passN}/${preflightItems.length}`)),
    ...preflightItems.map((it, i) => h('div', { class: 'row-item', style: i === preflightItems.length - 1 ? 'border-bottom:0' : '' },
      h('span', { class: 'tag ' + (it.ok ? 'tag-pri' : 'tag-acc'), style: 'min-width:42px;text-align:center;justify-content:center' }, it.ok ? '通过' : '待补'),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, it.label),
        h('div', { class: 'row-sub' }, it.sub)))),
    h('div', { class: 'btn-row', style: 'margin-top:10px' },
      h('button', { class: 'btn btn-ghost btn-sm', style: 'flex:1', onclick: preflightCheck }, icon('search'), '查看详情'),
      h('button', { class: 'btn btn-soft btn-sm', style: 'flex:1', onclick: exportDiagnostics }, icon('download'), '导出诊断')));

  // 关于
  const aboutCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('heart'), '关于'),
    h('div', { style: 'text-align:center;padding:6px 0' },
      h('div', { style: 'font-size:18px;font-weight:800' }, APP_NAME),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:2px' }, '把普通日子变成看得见的成就'),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:10px' }, `版本 v${APP_VERSION} · 本机档案 · 全部免费`),
      h('div', { style: 'margin-top:12px;font-weight:700;color:var(--primary-deep)' }, `制作人：${APP_AUTHOR}`),
      h('div', { class: 'form-hint', style: 'margin-top:8px;line-height:1.9' },
        '数据仅保存在本机浏览器（IndexedDB），不上传任何服务器；不包含云端账户、支付与广告。节假日与调休数据来自国务院办公厅通知。')));

  view.append(profileCard, ptsCard, rewardCard, setCard, dataCard, statusCard, installCard, preflightCard, aboutCard);
}
function setRow(label, ctrl) {
  return h('div', { class: 'row-item' }, h('span', { style: 'font-size:14px;font-weight:600;flex:none' }, label), ctrl);
}

async function editProfile(ctx) {
  const profile = await loadKV('profile');
  const nickInp = h('input', { class: 'input', value: profile.nickname || '', placeholder: '昵称', maxlength: '12' });
  const avatarEl = h('div', { class: 'avatar-fb', style: 'width:72px;height:72px;font-size:24px;margin:0 auto' }, '换头像');
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
      h('div', { class: 'form-hint' }, '账户名是本机标识，不支持修改；没有退出账户的概念，换设备请用备份迁移')),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: '保存', cls: 'btn-primary', onClick: async (c) => {
          await patchKV('profile', { nickname: nickInp.value.trim() || profile.account, avatarId });
          setProfile(await loadKV('profile'));
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
      h('div', { class: 'confirm-msg' }, '这是当前的最终上线前精修版，重点补齐上线可用性、交互细节、设备侧稳定性与交付说明。'),
      h('div', { class: 'card', style: 'margin:0;padding:12px;background:var(--surface2);box-shadow:none' },
        RELEASE_HIGHLIGHTS.map((t, i) => h('div', { class: 'row-item', style: i === RELEASE_HIGHLIGHTS.length - 1 ? 'border-bottom:0' : '' },
          h('span', { class: 'tag tag-pri', style: 'margin-right:2px' }, String(i + 1).padStart(2, '0')),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px;white-space:normal' }, t))))),
      h('div', { class: 'form-hint' }, '如果后面还要继续迭代，建议下一步只补真实业务功能，不要再大改视觉骨架。')),
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
