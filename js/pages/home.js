// 今天没白过 · 「家园」页：家园场景 / 商城 / 背包 / 徽章收藏册与展示栏
import { all, get, put, del, loadKV, saveKV, patchKV } from '../core/db.js';
import { PETS, SHOP, SHOP_CATS, BADGES, BADGE_SERIES, badgeById, badgeRarity, stageOf, STAGES, shopById, isUnlocked, unlockText, POINTS } from '../core/catalog.js';
import { purchaseItem, useConsumable, equipItem, petInteract, claimPet, savePetName, setActivePet, balance, stats, getActivePet, grantGrowth } from '../core/engine.js';
import { shopArt, badgeArt, setBadgeIndex } from '../core/art.js';
import { renderHomeScene, petNode, petAct, floatFx, petSVG, HOME_SLOTS } from '../core/pets.js';
import { h, icon, fmtMin, todayKey, fmtCN } from '../core/util.js';
import { openModal, actionSheet, confirmDlg, formDlg, queueSettle, toast, burstAt, sparkleAt, pulse } from '../core/fx.js';
import * as sound from '../core/sound.js';

let curTab = 'home';
let shopCat = 'food';
let badgeFilter = { series: null, got: null };

export async function renderHome(view, ctx) {
  const requestedTab = ctx.routeParams?.get('tab');
  if (['home','shop','bag','badges'].includes(requestedTab)) curTab = requestedTab;
  view.innerHTML = '';
  view.dataset.homeTab = curTab;
  const seg = h('div', { class: 'seg', style: 'margin-bottom:12px' },
    [['home', '伙伴'], ['shop', '商城'], ['bag', '背包'], ['badges', '徽章']].map(([id, nm]) =>
      h('button', { class: curTab === id ? 'on' : '', onclick: () => { curTab = id; sound.play('tap'); location.hash = '#/home?tab=' + id; } }, nm)));
  view.append(seg);
  const routeCtx = { ...ctx, rerender: () => { if (ctx.routeParams) ctx.routeParams.set('tab', curTab); return ctx.rerender('home?tab=' + curTab); } };
  const box = h('div');
  view.append(box);
  if (curTab === 'home') await renderHomeTab(box, routeCtx);
  else if (curTab === 'shop') await renderShop(box, routeCtx);
  else if (curTab === 'bag') await renderBag(box, routeCtx);
  else await renderBadges(box, routeCtx);
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
  const [pets, appMeta, unlocked, inventory, petLogs] = await Promise.all([all('pets'),loadKV('app_meta'),all('badges'),all('inventory'),all('petlog')]);
  if(!pets.length){box.append(h('div',{class:'card'},h('p',{class:'paper-empty'},'当前档案还没有伙伴。请先检查备份与档案状态，不需要清空记录。')));return;}
  const active=pets.find(p=>p.petId===appMeta.activePet)||pets[0];
  const def=PETS.find(p=>p.petId===active.petId)||PETS[0];
  const S=stats()||{}, progress=stageProgressOf(active.growth||0);
  const { petFigure,petResponse } = await import('../ui/paper.js');
  box.classList.add('paper-companion','paper-reference-companion');
  const go=tab=>{location.hash='#/home?tab='+tab;};

  const tabs=h('div',{class:'ref-pet-switcher','aria-label':'选择伙伴'});
  for(const item of PETS){const owned=pets.some(p=>p.petId===item.petId);tabs.append(h('button',{
    class:'ref-pet-chip'+(item.petId===active.petId?' on':''),'aria-pressed':String(item.petId===active.petId),onclick:async()=>{
      if(owned){await setActivePet(item.petId);await ctx.rerender();return;}
      if(item.unlock?.badges&&(S.badgeCount||0)<item.unlock.badges){toast(item.unlockText,{ic:'badge'});return;}
      if(item.unlock?.stage&&(S.petMaxStage||1)<item.unlock.stage){toast(item.unlockText,{ic:'pet'});return;}
      const result=await claimPet(item.petId);if(result.err){toast(result.err,{ic:'error'});return;}
      queueSettle([{ic:'pet',label:`新伙伴 ${item.name} 加入了`,sub:item.species}]);await ctx.rerender();
    }},petFigure({petId:item.petId,name:item.name}),h('span',null,item.name),owned?null:h('small',null,'待解锁')));}
  box.append(tabs);

  const bubble=h('p',{class:'ref-room-bubble','aria-live':'polite'},'今天天气真好！一起玩吧？ ♡');
  const scene=h('section',{class:'ref-room card','aria-label':(active.name||def.name)+'的陪伴场景'});
  const background=h('img',{class:'ref-room-bg',src:'./assets/ui/quiet-room.webp',alt:'',decoding:'async',draggable:'false'});
  background.addEventListener('error',()=>{background.hidden=true;scene.classList.add('asset-fallback');});
  let figure, actionBusy=false, actionButtons=[];
  figure=petFigure(active,{interactive:true,onDispose:ctx.onDispose,onClick:()=>runInteraction('touch')});
  scene.append(background,
    h('span',{class:'ref-room-plant plant-left','aria-hidden':'true'}),h('span',{class:'ref-room-plant plant-right','aria-hidden':'true'}),
    h('div',{class:'ref-room-chalk'},'小日子',h('br'),'慢慢过 ♡'),
    h('div',{class:'ref-room-bed','aria-hidden':'true'},h('span',null)),
    h('div',{class:'ref-room-ball','aria-hidden':'true'}),
    h('div',{class:'ref-room-pet'},figure),bubble,
    h('div',{class:'ref-room-bowl','aria-hidden':'true'},'✦'));
  box.append(scene);

  async function rename(){
    const values=await formDlg({title:'给伙伴起名 / 改名',fields:[{key:'n',label:'名字（12字内）',type:'text',value:active.name||def.name}]});
    if(values?.n?.trim()){await savePetName(active,values.n);toast('已保存');await ctx.rerender();}
  }
  const ownedAt=Number(active.ownedAt)||Date.now();
  const togetherDays=Math.max(1,Math.floor((Date.now()-ownedAt)/86400000)+1);
  const realLifeLogs=petLogs.filter(row=>row && row.exempt!==true).length;
  const stateCard=h('section',{class:'card ref-pet-status'},
    h('div',{class:'ref-pet-identity'},h('div',null,h('h1',null,active.name||def.name,h('button',{class:'ref-inline-edit','aria-label':'给伙伴改名',onclick:rename},icon('edit'))),h('p',null,`陪伴了 ${togetherDays} 天`),h('small',null,'🌱 每一天，都在慢慢变好！'))),
    h('div',{class:'ref-pet-metrics'},
      petMetric('heart','陪伴',`${togetherDays}天`),
      petMetric('star','阶段',progress.cur.name),
      petMetric('pet','成长值',active.growth||0),
      petMetric('badge','徽章',unlocked.length)));
  box.append(stateCard);

  const actionDefs=[['touch','摸摸','轻轻回应你','heart'],['feed','喂食','选择一份食物','gift'],['encourage','鼓励','送一句加油','star'],['play','玩耍','选个喜欢的玩具','pet']];
  const actions=h('div',{class:'ref-pet-actions'});
  for(const [kind,label,sub,ic] of actionDefs){const button=h('button',{class:'ref-pet-action action-'+kind,onclick:()=>runInteraction(kind)},
    h('span',{class:'ref-pet-action-art','aria-hidden':'true'},icon(ic)),h('b',null,label),h('small',null,sub));actionButtons.push(button);actions.append(button);}
  box.append(actions);

  async function runInteraction(kind){
    if(actionBusy||!figure.isConnected)return;actionBusy=true;actionButtons.forEach(button=>button.disabled=true);figure.disabled=true;
    try{
      let text='',motion='touch';
      if(kind==='feed'||kind==='play'){
        const category=kind==='feed'?'food':'toy';
        const available=(await all('inventory')).some(row=>row.qty>0&&shopById(row.itemId)?.cat===category);
        if(!available){const agreed=await confirmDlg('背包里还没有'+(category==='food'?'食物':'玩具'),'可以去商城看看，用已有积分兑换。',{okLabel:'去商城'});if(agreed)go('shop');return;}
        const { choosePetItem }=await import('../core/item-picker.js');const result=await choosePetItem(category);if(!result?.ok)return;
        text=kind==='feed'?`吃到了${result.item.name}，谢谢你。`:`一起玩${result.item.name}吧。`;motion=kind==='feed'?'eat':'play';
      }else{
        await petInteract({touch:true});text=kind==='encourage'?'收到你的加油啦，也给你一份。':'蹭蹭你，我在呢。';motion=kind==='encourage'?'happy':'touch';
      }
      sound.play('pet');petResponse(figure,bubble,text,motion);toast(text,{ic:'heart'});if(kind==='feed'||kind==='play')await refreshProps();
    }catch(error){console.error(error);toast(error.message||'这次操作未完成，请重试',{ic:'error'});}
    finally{actionBusy=false;actionButtons.forEach(button=>button.disabled=false);figure.disabled=false;}
  }

  const growth=h('section',{class:'card ref-growth-card'},
    h('div',{class:'ref-card-head'},h('h2',null,'🌱 TA在慢慢长大'),h('div',{class:'ref-growth-note'},'再多一些陪伴，',h('br'),'就能解锁下一个阶段啦！')),
    h('ol',{class:'ref-growth-track'},STAGES.map(st=>h('li',{class:st.n<=progress.cur.n?'reached':''},h('span',null,icon('pet')),h('b',null,st.name)))));
  box.append(growth);

  const gotMap=new Map(unlocked.map(row=>[row.badgeId,row]));
  const showcase=await loadKV('showcase');
  const chosen=Array.isArray(showcase)?showcase.filter(id=>gotMap.has(id)&&badgeById(id)):[];
  const recent=[...unlocked].sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0)).map(row=>row.badgeId).filter(id=>badgeById(id));
  const ids=[...new Set([...chosen,...recent])].slice(0,3);
  const badgeCard=h('section',{class:'card ref-memory-card ref-badges-card'},h('div',{class:'ref-card-head'},h('h2',null,'⭐ 纪念徽章'),h('button',{class:'more',onclick:()=>go('badges')},`已获得 ${unlocked.length}`,icon('right'))));
  const badgeGrid=h('div',{class:'ref-memory-badges'});
  for(const id of ids){const b=badgeById(id),got=gotMap.get(id);badgeGrid.append(h('button',{onclick:e=>{playBadgeTapFx(e.currentTarget,true,b.points);badgeDetail(b,got,e.currentTarget);}},h('img',{src:badgeArt(id),alt:b.name,loading:'lazy'}),h('b',null,b.name),h('small',null,got?.ts?fmtCN(new Date(got.ts).toISOString().slice(0,10)):'')));}
  if(!ids.length)badgeGrid.append(h('p',{class:'paper-empty'},'还没有徽章。先记下一件真实的小事吧。'));
  badgeCard.append(badgeGrid);

  const memoryCard=h('section',{class:'card ref-memory-card'},h('div',{class:'ref-card-head'},h('h2',null,'▣ 我们的回忆'),h('button',{class:'more',onclick:()=>{location.hash='#/footprint';}},icon('right'))),
    h('div',{class:'ref-polaroid'},h('div',{class:'ref-polaroid-pet'},petFigure(active)),h('small',null,`已经一起走过 ${togetherDays} 天`),h('b',null,realLifeLogs?`留下 ${realLifeLogs} 次成长记录`:'第一段回忆，等你来写')));
  box.append(h('div',{class:'ref-memory-grid'},badgeCard,memoryCard));

  const props=h('section',{class:'card ref-props'},h('div',{class:'ref-card-head'},h('h2',null,'👜 小道具'),h('button',{class:'more',onclick:()=>go('bag')},'背包',icon('right'))),h('p',{class:'ref-props-sub'},'这些小物件能让相处更有趣～'));
  const propsList=h('div',{class:'ref-prop-list'});props.append(propsList);box.append(props,h('p',{class:'paper-page-note'},'几天不见也没关系，成长和收藏都还在。'));
  async function refreshProps(){
    const rows=(await all('inventory')).filter(row=>row.qty>0&&['food','toy'].includes(shopById(row.itemId)?.cat)).slice(0,3);propsList.replaceChildren();
    if(!rows.length){propsList.append(h('p',{class:'paper-empty'},'背包还是空的，已有积分可以兑换食物和玩具。'),h('button',{class:'btn btn-soft btn-sm',onclick:()=>go('shop')},'去看看道具'));return;}
    for(const row of rows){const item=shopById(row.itemId);propsList.append(h('button',{class:'ref-prop',onclick:()=>go('bag')},h('img',{src:shopArt(item.id),alt:'',loading:'lazy'}),h('span',null,item.name),h('small',null,item.type==='consumable'?`×${row.qty}`:'永久')));}
  }
  await refreshProps();
  function petMetric(ic,label,value){return h('div',{class:'ref-pet-metric'},h('span',null,icon(ic)),h('b',null,label),h('small',null,String(value)));}
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

