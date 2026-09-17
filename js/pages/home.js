// 今天没白过 · 「家园」页：家园场景 / 商城 / 背包 / 徽章收藏册与展示栏
import { all, get, put, del, loadKV, saveKV, patchKV } from '../core/db.js';
import { PETS, SHOP, SHOP_CATS, BADGES, BADGE_SERIES, badgeById, badgeRarity, stageOf, STAGES, shopById, isUnlocked, unlockText, POINTS } from '../core/catalog.js';
import { purchaseItem, useConsumable, equipItem, petInteract, claimPet, savePetName, setActivePet, balance, stats, getActivePet, grantGrowth } from '../core/engine.js';
import { shopArt, badgeArt, setBadgeIndex } from '../core/art.js';
import { renderHomeScene, petNode, petAct, floatFx, petSVG, HOME_SLOTS } from '../core/pets.js';
import { h, icon, fmtMin, todayKey, fmtCN } from '../core/util.js';
import { openModal, actionSheet, confirmDlg, formDlg, queueSettle, toast, burstAt, sparkleAt, pulse } from '../core/fx.js';
import { fillBadgeImgs } from './today.js';
import * as sound from '../core/sound.js';

let curTab = 'home';
let shopCat = 'food';
let badgeFilter = { series: null, got: null };

export async function renderHome(view, ctx) {
  view.innerHTML = '';
  const seg = h('div', { class: 'seg', style: 'margin-bottom:12px' },
    [['home', '家园'], ['shop', '商城'], ['bag', '背包'], ['badges', '徽章']].map(([id, nm]) =>
      h('button', { class: curTab === id ? 'on' : '', onclick: () => { curTab = id; sound.play('tap'); ctx.rerender(); } }, nm)));
  view.append(seg);
  const box = h('div');
  view.append(box);
  if (curTab === 'home') await renderHomeTab(box, ctx);
  else if (curTab === 'shop') await renderShop(box, ctx);
  else if (curTab === 'bag') await renderBag(box, ctx);
  else await renderBadges(box, ctx);
}

function badgeFxColors(points = 10) {
  const rar = badgeRarity(points);
  if (rar.stars >= 3) return ['#D8A94D', '#F2D98C', '#D78367', '#FFF6DF'];
  if (rar.stars === 2) return ['#748F72', '#A8C4A0', '#D8A94D', '#F7F1D8'];
  return ['#7A8FB5', '#9AB5C9', '#D8A94D'];
}
function playBadgeTapFx(anchor, got, points = 10) {
  const node = anchor?.closest?.('.badge-cell, .showcase-slot, .badge-detail-hero') || anchor;
  if (node) pulse(node);
  if (got) {
    sound.play('badge');
    const colors = badgeFxColors(points);
    burstAt(anchor || node, { colors, count: 18 + Math.min(10, badgeRarity(points).stars * 4), spread: 58, rise: 74 });
    sparkleAt(anchor || node, { colors: [colors[colors.length - 1] || '#FFF6DF', colors[0], colors[1] || colors[0]], count: 7 + badgeRarity(points).stars, radius: 34 + badgeRarity(points).stars * 6 });
  } else {
    sound.play('tap');
  }
}

// ---- 家园 ----
async function renderHomeTab(box, ctx) {
  const [pets, appMeta, layout, S, unlocked] = await Promise.all([all('pets'), loadKV('app_meta'), loadKV('home_layout'), Promise.resolve(stats() || {}), all('badges')]);
  if (!pets.length) {
    box.append(h('div', { class: 'card' }, h('div', { class: 'empty' }, '还没有伙伴，回到建档流程重新领取')));
    return;
  }
  const active = pets.find((p) => p.petId === appMeta.activePet) || pets[0];
  const gotMap = new Map(unlocked.map((u) => [u.badgeId, u]));
  const def = PETS.find((p) => p.petId === active.petId);
  const st = stageOf(active.growth || 0);
  const prog = stageProgressOf(active.growth || 0);
  let petWrapRef = null;

  // 宠物切换条
  const tabs = h('div', { class: 'pet-tabs' });
  for (const def0 of PETS) {
    const owned = pets.some((p) => p.petId === def0.petId);
    const tab = h('button', {
      class: 'pet-tab' + (def0.petId === active.petId ? ' on' : '') + (owned ? '' : ' locked'),
      onclick: async () => {
        if (owned) { await setActivePet(def0.petId); ctx.rerender(); return; }
        const u = def0.unlock;
        if (u && S) {
          if (u.badges && (S.badgeCount || 0) < u.badges) { toast(u.unlockText || `需解锁${u.badges}枚徽章`, { ic: 'badge' }); return; }
          if (u.stage && (S.petMaxStage || 1) < u.stage) { toast(u.unlockText || `需宠物达到阶段${u.stage}`, { ic: 'pet' }); return; }
        }
        const r = await claimPet(def0.petId);
        if (r.err) toast(r.err, { ic: 'error' });
        else { queueSettle([{ ic: 'pet', label: `新伙伴 ${def0.name} 加入了`, sub: def0.species }]); ctx.rerender(); }
      },
    }, owned ? `${def0.name}${def0.petId === active.petId ? ' · 当前' : ''}` : `🔒 ${def0.name}`);
    tabs.append(tab);
  }

  const sceneBox = h('div', { class: 'card', style: 'padding:10px' });
  const petWrap = renderHomeScene(sceneBox, layout, active, {
    stage: st.n,
    onClickPet: () => touchPet(),
  });
  petWrapRef = petWrap;

  // 成长与状态
  const info = h('div', { class: 'row-sub', style: 'margin-top:10px;align-items:center;flex-wrap:wrap' },
    h('span', { class: 'tag stage-chip' }, `阶段${st.n} · ${st.name}`),
    h('span', { class: 'num' }, `成长值 ${active.growth || 0}`),
    prog.next ? h('span', null, `距「${prog.next.name}」还差 ${prog.next.min - (active.growth || 0)}`) : h('span', null, '已是最高阶段'),
    h('span', null, def.species));
  const growthBar = h('div', { class: 'growth-line' }, h('div', { class: 'bar gold', style: 'flex:1' }, h('i', { style: `width:${Math.round(prog.ratio * 100)}%` })));
  const nameRow = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:6px' },
    h('b', { style: 'font-size:16px' }, active.name || def.name),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
      const v = await formDlg({ title: '给伙伴起名 / 改名', fields: [{ key: 'n', label: '名字（12字内）', type: 'text', value: active.name || def.name }] });
      if (v && v.n.trim()) { await savePetName(active, v.n); toast('已保存'); ctx.rerender(); }
    } }, icon('edit')));

  const actions = h('div', { class: 'pet-actions' },
    actBtn('touch', '摸摸', 'heart', touchPet),
    actBtn('feed', '喂食', 'gift', feedPet),
    actBtn('play', '玩耍', 'pet', playPet),
    actBtn('name', '改名', 'edit', async () => {
      const v = await formDlg({ title: '给伙伴起名 / 改名', fields: [{ key: 'n', label: '名字（12字内）', type: 'text', value: active.name || def.name }] });
      if (v && v.n.trim()) { await savePetName(active, v.n); toast('已保存'); ctx.rerender(); }
    }));

  function actBtn(_k, label, ic, fn) {
    return h('button', { class: 'btn btn-soft', onclick: fn }, icon(ic), label);
  }
  async function touchPet() {
    sound.play('pet');
    petAct(petWrapRef, 'touch');
    pulse(petWrapRef);
    burstAt(petWrapRef, { colors: ['#E8657A', '#F0A2B2', '#F2D98C'], count: 10, spread: 36, rise: 52 });
    floatFx(sceneBox, 'heart');
    await petInteract({ touch: true });
  }
  async function feedPet() {
    const inv = await all('inventory');
    const foods = inv.filter((i) => i.qty > 0 && (shopById(i.itemId) || {}).cat === 'food');
    if (!foods.length) { toast('背包里还没有食物，去商城看看', { ic: 'shop' }); return; }
    const it = foods[Math.floor(Math.random() * foods.length)];
    const item = shopById(it.itemId);
    await useConsumable(it.itemId);
    sound.play('pet');
    petAct(petWrapRef, 'eat');
    pulse(petWrapRef);
    burstAt(petWrapRef, { colors: ['#D8A94D', '#F2D98C', '#FFF6DF'], count: 10, spread: 38, rise: 54 });
    floatFx(sceneBox, 'star');
    await petInteract({ food: true, itemId: it.itemId });
    toast(`${active.name || def.name} 吃掉了${item.name}`, { ic: 'gift' });
    ctx.rerender();
  }
  async function playPet() {
    const inv = await all('inventory');
    const toys = inv.filter((i) => i.qty > 0 && (shopById(i.itemId) || {}).cat === 'toy');
    if (!toys.length) { toast('还没有玩具，商城的毛线球不错', { ic: 'shop' }); return; }
    const it = toys[Math.floor(Math.random() * toys.length)];
    sound.play('pet');
    petAct(petWrapRef, 'play');
    pulse(petWrapRef);
    burstAt(petWrapRef, { colors: ['#7A8FB5', '#9AB5C9', '#D8A94D'], count: 10, spread: 44, rise: 54 });
    floatFx(sceneBox, 'note');
    await petInteract({ toy: true, itemId: it.itemId });
    ctx.rerender();
  }
  async function dressPet() {
    const inv = await all('inventory');
    const outfits = inv.filter((i) => i.qty > 0 && (shopById(i.itemId) || {}).cat === 'outfit');
    const eq = active.equipped || {};
    const slotName = { head: '头部', neck: '颈部', body: '身体' };
    const items = [];
    for (const slot of ['head', 'neck', 'body']) {
      items.push({ ic: 'close', label: `卸下${slotName[slot]}装扮`, sub: eq[slot] ? (shopById(eq[slot]) || {}).name : '（未装备）', onClick: async () => { await equipItem(active, slot, null); ctx.rerender(); } });
    }
    for (const o of outfits) {
      const item = shopById(o.itemId);
      const slot = ['S022', 'S023', 'S025', 'S027', 'S031'].includes(item.id) ? 'head' : ['S021', 'S024', 'S028'].includes(item.id) ? 'neck' : 'body';
      items.push({ ic: 'star', label: `装备「${item.name}」`, sub: slotName[slot], onClick: async () => { await equipItem(active, slot, item.id); queueSettle([{ ic: 'star', label: `换上了${item.name}` }]); ctx.rerender(); } });
    }
    if (!outfits.length) toast('还没有装扮，商城的格纹领巾是第一件', { ic: 'shop' });
    await actionSheet('装扮 · ' + (active.name || def.name), items);
  }

  box.append(tabs, sceneBox, nameRow, info, growthBar, actions,
    h('div', { class: 'form-hint', style: 'text-align:center;margin-top:10px;line-height:1.8' },
      '几天不打开也不会有惩罚：宠物不会离开，成长不清零。'));
  // 展示栏
  const showcase = await loadKV('showcase');
  const scCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('badge'), '精选徽章展示栏', h('span', { class: 'tag tag-pri' }, `${showcase.length}/10`),
      h('button', { class: 'more', onclick: () => { curTab = 'badges'; ctx.rerender(); } }, '编辑', icon('right'))));
  const strip = h('div', { class: 'showcase-strip' });
  for (let i = 0; i < 10; i++) {
    const id = showcase[i];
    const b = id ? badgeById(id) : null;
    const got = id ? gotMap.get(id) : null;
    strip.append(h('button', { class: 'showcase-slot' + (id ? ' filled' : ''), onclick: (e) => {
      if (!id || !b) { sound.play('tap'); return; }
      playBadgeTapFx(e.currentTarget, true, b.points);
      badgeDetail(b, got, e.currentTarget);
    } }, id ? h('img', { src: badgeArt(id), alt: b?.name || '' }) : '空'));
  }
  scCard.append(strip);
  box.append(scCard);
}
function stageProgressOf(g) {
  const cur = stageOf(g);
  const next = STAGES.find((s) => s.n === cur.n + 1) || null;
  return { cur, next, ratio: next ? (g - cur.min) / (next.min - cur.min) : 1 };
}

// ---- 商城 ----
async function renderShop(box, ctx) {
  const S = stats() || {};
  const [inv, pets] = await Promise.all([all('inventory'), all('pets')]);
  const invMap = new Map(inv.map((i) => [i.itemId, i]));
  const ctxUn = { maxStage: S.petMaxStage || 1, badgeCount: S.badgeCount || 0, seriesComplete: S.seriesComplete || 0 };
  const bal = balance();
  const head = h('div', { class: 'card', style: 'padding:10px 14px;display:flex;align-items:center;gap:8px' },
    h('span', { style: 'font-size:13px;color:var(--muted)' }, '积分余额'),
    h('b', { class: 'num', style: 'font-size:18px;color:var(--reward)' }, String(bal)),
    h('span', { style: 'flex:1' }),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { curTab = 'bag'; ctx.rerender(); } }, icon('bag'), '背包'));
  const seg = h('div', { class: 'seg', style: 'margin-bottom:10px' },
    SHOP_CATS.map((c) => h('button', { class: shopCat === c.id ? 'on' : '', onclick: (e) => { shopCat = c.id; [...seg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sound.play('tap'); drawGrid(); } }, c.name)));
  const gridWrap = h('div');
  box.append(head, seg, gridWrap);
  async function drawGrid() {
    gridWrap.innerHTML = '';
    const items = SHOP.filter((s) => s.cat === shopCat);
    const grid = h('div', { class: 'shop-grid' });
    for (const item of items) {
      const unl = isUnlocked(item, ctxUn);
      const owned = invMap.get(item.id);
      const cell = h('button', { class: 'shop-cell' + (unl ? '' : ' locked'), onclick: () => itemModal(item, owned, ctx) },
        owned && item.type === 'perm' ? h('span', { class: 'owned' }, '已拥有') : owned ? h('span', { class: 'owned' }, `×${owned.qty}`) : null,
        h('img', { src: shopArt(item.id), alt: item.name }),
        h('div', { class: 'nm' }, item.name),
        h('div', { class: 'pr' }, unl ? `${item.price} 积分` : (unlockText(item) || '未开放')));
      grid.append(cell);
    }
    gridWrap.append(grid);
  }
  drawGrid();
}
async function itemModal(item, owned, ctx) {
  const S = stats() || {};
  const unl = isUnlocked(item, { maxStage: S.petMaxStage || 1, badgeCount: S.badgeCount || 0, seriesComplete: S.seriesComplete || 0 });
  const bal = balance();
  const canBuy = unl && !(item.type === 'perm' && owned && owned.qty > 0) && bal >= item.price;
  openModal({
    title: item.name,
    content: h('div', null,
      h('img', { src: shopArt(item.id), alt: item.name, style: 'width:200px;height:200px;border-radius:20px;display:block;margin:0 auto;background:var(--surface2)' }),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:10px' },
        h('span', { class: 'tag tag-acc' }, `${item.price} 积分`),
        h('span', { class: 'tag' }, item.type === 'consumable' ? '消耗品' : '永久'),
        owned ? h('span', { class: 'tag tag-pri' }, item.type === 'perm' ? '已拥有' : `拥有 ×${owned.qty}`) : null),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:6px' }, item.desc),
      !unl ? h('div', { class: 'form-hint', style: 'text-align:center;margin-top:8px' }, '解锁条件：' + unlockText(item)) : null,
      !canBuy && unl ? h('div', { class: 'form-hint', style: 'text-align:center;margin-top:8px' },
        item.type === 'perm' && owned ? '永久物品已拥有，不会重复扣分' : bal < item.price ? `积分还差 ${item.price - bal}，去做点事吧` : '') : null),
    actions: [
      { label: '关闭', onClick: (c) => c() },
      {
        label: canBuy ? `确认兑换（${item.price} 积分）` : (unl ? '积分不足' : '未解锁'), cls: 'btn-primary', disabled: !canBuy,
        onClick: async (c) => {
          const r = await purchaseItem(item);
          if (r.err) { toast(r.err, { ic: 'error' }); return; }
          c();
          queueSettle([{ ic: 'gift', label: `获得「${item.name}」`, sub: item.type === 'consumable' ? '已放入背包' : '永久物品已入库', points: -item.price, growth: 0 }]);
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}

// ---- 背包 ----
async function renderBag(box, ctx) {
  const [inv, pets, appMeta] = await Promise.all([all('inventory'), all('pets'), loadKV('app_meta')]);
  const active = pets.find((p) => p.petId === appMeta.activePet) || pets[0];
  const cardC = h('div', { class: 'card' }, h('div', { class: 'card-title' }, icon('gift'), '消耗品'));
  const cardP = h('div', { class: 'card' }, h('div', { class: 'card-title' }, icon('bag'), '永久物品'));
  let hasC = false, hasP = false;
  for (const it of inv) {
    const item = shopById(it.itemId);
    if (!item || it.qty <= 0) continue;
    if (item.type === 'consumable') {
      hasC = true;
      cardC.append(h('div', { class: 'row-item inv-row' },
        h('img', { src: shopArt(item.id), style: 'width:44px;height:44px;border-radius:12px', alt: item.name }),
        h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px' }, item.name), h('div', { class: 'row-sub' }, item.desc)),
        h('span', { class: 'qty num' }, `×${it.qty}`),
        h('button', { class: 'btn btn-soft btn-sm', onclick: async () => { await useConsumable(item.id); await petInteract({ food: item.cat === 'food', toy: item.cat === 'toy', itemId: item.id }); sound.play('pet'); toast(`用掉了「${item.name}」`); ctx.rerender(); } }, '使用')));
    } else {
      hasP = true;
      const usable = ['food', 'toy', 'outfit'].includes(item.cat);
      cardP.append(h('div', { class: 'row-item inv-row' },
        h('img', { src: shopArt(item.id), style: 'width:44px;height:44px;border-radius:12px', alt: item.name }),
        h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px' }, item.name), h('div', { class: 'row-sub' }, catLabel(item.cat))),
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => usePerm(item, ctx) }, catLabelUse(item.cat))));
    }
  }
  if (!hasC) cardC.append(h('div', { class: 'empty' }, '背包里还没有消耗品'));
  if (!hasP) cardP.append(h('div', { class: 'empty' }, '兑换的永久物品会出现在这里'));
  box.append(cardC, cardP,
    h('div', { class: 'form-hint', style: 'text-align:center;line-height:1.8' },
      '家具与背景在「家园」的编辑里摆放；装扮在宠物装扮里穿戴。'));
}
function catLabel(cat) { return { food: '食物', toy: '玩具', outfit: '装扮', furniture: '家具', bg: '背景', display: '展示' }[cat] || cat; }
function catLabelUse(cat) { return { toy: '玩耍', outfit: '穿戴', furniture: '摆放', bg: '设为背景', display: '展示' }[cat] || '查看'; }
async function usePerm(item, ctx) {
  if (item.cat === 'toy') {
    sound.play('pet');
    await petInteract({ toy: true, itemId: item.id });
    toast('和伙伴玩了一会儿', { ic: 'pet' });
    ctx.rerender();
    return;
  }
  if (item.cat === 'outfit') { curTab = 'home'; ctx.rerender(); toast('在家园的「装扮」里穿戴', { ic: 'star' }); return; }
  if (item.cat === 'bg') {
    const layout = await loadKV('home_layout');
    layout.bg = item.id;
    await saveKV('home_layout', layout);
    toast('背景已更换，去家园看看', { ic: 'home' });
    ctx.rerender();
    return;
  }
  // 家具/展示：选择槽位
  const accept = item.cat === 'display' ? ['wall1', 'wall2', 'cabinet'] : ['bed', 'desk1', 'desk2', 'ground1', 'ground2', 'rug', 'wall1', 'wall2', 'cabinet'];
  const layout = await loadKV('home_layout');
  const items = HOME_SLOTS.filter((s) => accept.includes(s.key)).map((s) => ({
    ic: 'home', label: s.name, sub: layout[s.key] && layout[s.key] !== item.id ? `当前：${(shopById(layout[s.key]) || {}).name}` : layout[s.key] === item.id ? '已在这里' : '空',
    onClick: async () => {
      layout[s.key] = layout[s.key] === item.id ? null : item.id;
      await saveKV('home_layout', layout);
      toast(layout[s.key] ? `已放到「${s.name}」` : '已收起');
      ctx.rerender();
    },
  }));
  await actionSheet(`摆放「${item.name}」`, items);
}

// ---- 徽章收藏册 ----
async function renderBadges(box, ctx) {
  const [unlocked, showcase, S] = await Promise.all([all('badges'), loadKV('showcase'), Promise.resolve(stats() || {})]);
  const gotMap = new Map(unlocked.map((u) => [u.badgeId, u]));
  const filterRow = h('div', { class: 'seg', style: 'margin-bottom:8px' },
    [['all', '全部'], ['got', '已获得'], ['nogot', '未获得']].map(([id, nm]) =>
      h('button', { class: badgeFilter.got === id || (id === 'all' && !badgeFilter.got) ? 'on' : '', onclick: (e) => { badgeFilter.got = id === 'all' ? null : id; [...filterRow.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sound.play('tap'); drawBook(); } }, nm)));
  const serieSeg = h('div', { class: 'seg', style: 'margin-bottom:12px' },
    h('button', { class: !badgeFilter.series ? 'on' : '', onclick: (e) => { badgeFilter.series = null; [...serieSeg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); drawBook(); } }, '12系列'),
    BADGE_SERIES.map((s) => h('button', { class: badgeFilter.series === s ? 'on' : '', onclick: (e) => { badgeFilter.series = s; [...serieSeg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); drawBook(); } }, s.slice(0, 2))));
  const bookWrap = h('div');
  box.append(
    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('badge'), '收藏进度'),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, `${unlocked.length}/120`), h('div', { class: 'k' }, '已解锁')),
        h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, `${S.seriesComplete || 0}/12`), h('div', { class: 'k' }, '系列集齐')),
        h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, `${showcase.length}/10`), h('div', { class: 'k' }, '展示栏')))),
    filterRow, serieSeg, bookWrap);
  async function drawBook() {
    bookWrap.innerHTML = '';
    for (const serie of BADGE_SERIES) {
      if (badgeFilter.series && badgeFilter.series !== serie) continue;
      const list = BADGES.filter((b) => b.series === serie).filter((b) => badgeFilter.got === null || (badgeFilter.got === 'got' ? gotMap.has(b.id) : !gotMap.has(b.id)));
      const gotN = BADGES.filter((b) => b.series === serie && gotMap.has(b.id)).length;
      const total = BADGES.filter((b) => b.series === serie).length;
      const head = h('div', { class: 'serie-head' }, serie, h('span', { class: 'tag' + (gotN === total ? ' tag-pri' : '') }, `${gotN}/${total}`));
      const grid = h('div', { class: 'badge-grid' });
      for (const b of list) {
        const got = gotMap.get(b.id);
        grid.append(h('button', { class: 'badge-cell' + (got ? ' got' : ''), onclick: (e) => { playBadgeTapFx(e.currentTarget, !!got, b.points); badgeDetail(b, got, e.currentTarget); } },
          h('div', { class: 'badge-imgbox' + (got ? '' : ' locked') }, h('img', { src: badgeArt(b.id), alt: b.name, loading: 'lazy' })),
          h('span', { class: 'nm' }, b.name)));
      }
      bookWrap.append(head, grid);
    }
  }
  drawBook();
}
function badgeDetail(b, got, anchor = null) {
  const rar = badgeRarity(b.points);
  const preview = h('button', { class: 'badge-detail-hero' + (got ? ' got' : ''), onclick: (e) => playBadgeTapFx(e.currentTarget, !!got, b.points) },
    h('img', { src: badgeArt(b.id), alt: b.name, style: 'width:140px;height:140px;border-radius:50%;margin:4px auto;background:transparent;object-fit:cover' + (got ? '' : ';filter:grayscale(1) opacity(0.45)') }),
    h('span', { class: 'badge-detail-hint' }, got ? '反复点它也会继续撒彩花' : '解锁后可再次互动'));
  openModal({
    title: got ? b.name : '未解锁',
    content: h('div', { style: 'text-align:center' },
      preview,
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:8px' },
        h('span', { class: 'tag' }, b.series), h('span', { class: 'tag tag-acc' }, rar.name + ' · +' + b.points)),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:6px' }, b.cond),
      got ? h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:6px' }, `解锁于 ${fmtCN(new Date(got.ts).toISOString().slice(0, 10))}`) : null,
      got ? h('div', { class: 'row-sub', style: 'justify-content:center' }, '依据：' + (got.basis || b.cond)) : h('div', { class: 'row-sub', style: 'justify-content:center' }, '继续记录，它会来的')),
    actions: got ? [
      {
        label: '放入展示栏', cls: 'btn-primary', onClick: async (c) => {
          const showcase = await loadKV('showcase');
          if (showcase.includes(b.id)) { toast('已在展示栏中'); playBadgeTapFx(anchor || preview, true, b.points); return; }
          if (showcase.length >= 10) { toast('展示栏满10枚了，先取下一枚', { ic: 'error' }); return; }
          showcase.push(b.id);
          await saveKV('showcase', showcase);
          playBadgeTapFx(anchor || preview, true, b.points);
          toast('已放入展示栏');
          c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
      { label: '关闭', onClick: (c) => c() },
    ] : [{ label: '关闭', onClick: (c) => c() }],
  });
}

