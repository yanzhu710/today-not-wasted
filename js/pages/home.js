// 今天没白过 · 「家园」页：家园场景 / 商城 / 背包 / 徽章收藏册与展示栏
import { all, get, put, del, loadKV, saveKV, patchKV } from '../core/db.js';
import { PETS, SHOP, SHOP_CATS, BADGES, BADGE_SERIES, badgeById, badgeRarity, stageOf, STAGES, shopById, isUnlocked, unlockText, POINTS } from '../core/catalog.js';
import { purchaseItem, redeemCustomReward, useConsumable, usePetItem, equipItem, petInteract, claimPet, savePetName, setActivePet, balance, stats, getActivePet, grantGrowth } from '../core/engine.js';
import { shopArt, badgeArt, setBadgeIndex } from '../core/art.js';
import { renderHomeScene, petNode, petAct, floatFx, petSVG, HOME_SLOTS } from '../core/pets.js';
import { h, icon, fmtMin, todayKey, fmtCN, uid } from '../core/util.js';
import { openModal, actionSheet, confirmDlg, formDlg, queueSettle, toast, burstAt, sparkleAt, pulse } from '../core/fx.js';
import * as sound from '../core/sound.js';
import { routeTabs } from '../ui/tabs.js';

let shopCat = 'food';
let badgeFilter = { series: null, got: null };

export async function renderHome(view, ctx) {
  const rawTab = ctx.routeParams?.get('tab') || 'home';
  const legacy = { shop:'rewards', bag:'rewards' };
  const tab = ['home','badges','rewards'].includes(rawTab) ? rawTab : (legacy[rawTab] || 'home');
  let rewardSub = ctx.routeParams?.get('sub') || (rawTab === 'bag' ? 'owned' : 'shop');
  if (!['shop','custom','owned'].includes(rewardSub)) rewardSub = 'shop';
  if (legacy[rawTab]) history.replaceState(null,'','#/home?tab=rewards&sub='+rewardSub);
  view.replaceChildren();
  view.dataset.homeTab = tab;
  view.append(routeTabs({
    value: tab,
    ariaLabel: '伙伴页面',
    items: [
      { id:'home', label:'伙伴', href:'home?tab=home' },
      { id:'badges', label:'徽章', href:'home?tab=badges' },
      { id:'rewards', label:'商城', href:'home?tab=rewards&sub=shop' },
    ],
  }));
  const box = h('div');
  view.append(box);
  const navigate = (nextTab, sub = null) => {
    location.hash = '#/home?tab=' + nextTab + (sub ? '&sub=' + sub : '');
  };
  const routeCtx = { ...ctx, activeTab:tab, rewardSub, navigate, rerender:(spec)=>ctx.rerender(spec || ('home?tab='+tab+(tab==='rewards'?'&sub='+rewardSub:''))) };
  if (tab === 'home') await renderHomeTab(box, routeCtx);
  else if (tab === 'badges') await renderBadges(box, routeCtx);
  else await renderRewardCenter(box, routeCtx, rewardSub);
}

async function renderRewardCenter(box, ctx, sub) {
  let rewardPet = null;
  try {
    const active = await getActivePet();
    if (active) { const { petFigure } = await import('../ui/paper.js'); rewardPet = petFigure(active); }
  } catch {}
  box.append(h('section',{class:'card reward-center-head reward-art-banner'},
    h('div',{class:'reward-banner-copy'},
      h('span',{class:'reward-banner-kicker'},'REWARD CORNER'),
      h('div',{class:'card-title'},icon('gift'),'商城',h('span',{class:'reward-balance num'},balance()+' 积分')),
      h('p',{class:'row-sub'},'把认真生活换成一点喜欢的东西。道具、奖励和已经兑换的收藏都在这里。'),
      h('div',{class:'reward-banner-tags'},h('span',null,'努力有回声'),h('span',null,'小小奖励也值得'))),
    rewardPet ? h('div',{class:'reward-banner-pet'},rewardPet) : h('div',{class:'reward-banner-gift','aria-hidden':'true'},'🎁')));
  box.append(routeTabs({
    value: sub,
    ariaLabel:'奖励分类',
    className:'reward-subtabs',
    items:[
      {id:'shop',label:'道具',href:'home?tab=rewards&sub=shop'},
      {id:'custom',label:'自定义奖励',href:'home?tab=rewards&sub=custom'},
      {id:'owned',label:'我的物品',href:'home?tab=rewards&sub=owned'},
    ],
  }));
  if (sub === 'custom') await renderCustomRewards(box, ctx);
  else if (sub === 'owned') await renderBag(box, ctx);
  else await renderShop(box, ctx);
}

async function renderCustomRewards(box, ctx) {
  const rows = (await all('custom_rewards')).filter(r=>!r.redeemedAt&&!r.fulfilledAt&&!r.doneAt).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  const addBtn = h('button',{class:'btn btn-primary btn-sm reward-add-btn',onclick:()=>openCustomRewardDialog(ctx)},icon('plus'),'制作新奖励');
  box.append(h('section',{class:'reward-custom-hero reward-blend-section'},
    h('div',{class:'reward-custom-copy'},
      h('span',{class:'reward-custom-kicker'},'MY REWARD'),
      h('b',null,'把喜欢的东西做成自己的奖励'),
      h('p',null,'上传一张喜欢的图片，把它做成带白边的贴纸奖励。图片只保存在这台设备上。'),
      h('div',{class:'reward-feature-chips'},h('span',null,'✓ 保护主体'),h('span',null,'✓ 手绘白边'),h('span',null,'✓ 本机保存'))),
    addBtn));
  if(!rows.length){
    const {petEmptyState}=await import('../ui/empty.js');
    box.append(await petEmptyState('rewards',{actionLabel:'制作第一个奖励',onAction:()=>openCustomRewardDialog(ctx)}));
    return;
  }
  const section=h('section',{class:'reward-custom-list'},h('div',{class:'section-inline-title'},h('b',null,'已上架的自定义奖励'),h('span',null,`${rows.length} 个`)));
  const grid=h('div',{class:'reward-custom-grid'});section.append(grid);
  for(const r of rows){
    const art=h('div',{class:'reward-sticker-frame'});
    if(r.photoId){const img=h('img',{alt:r.title,loading:'lazy'});art.append(img);loadRewardImage(img,r.photoId);} else art.append(h('span',{class:'reward-sticker-fallback'},icon('gift')));
    grid.append(h('article',{class:'reward-product-card'},art,h('b',null,r.title),h('span',{class:'reward-price'},r.cost?`${r.cost} 积分`:'免费领取'),
      h('button',{class:'btn btn-soft btn-sm reward-exchange-btn',onclick:()=>ctx.navigate('rewards','shop')},'去商城'),
      h('button',{class:'reward-delete-link','aria-label':'删除奖励',onclick:async()=>deleteCustomReward(r,ctx)},'删除')));
  }
  box.append(section);
}

async function openCustomRewardDialog(ctx){
  const titleInp=h('input',{class:'input',placeholder:'例如：看一场电影',maxlength:'30'});
  const costInp=h('input',{class:'input',type:'number',min:'0',step:'1',placeholder:'例如 80'});
  const status=h('div',{class:'reward-cutout-status'},h('span',{class:'status-dot'}),h('span',null,'等待选择图片'));
  const preview=h('div',{class:'reward-upload-preview'},h('div',{class:'reward-upload-empty'},icon('camera'),h('span',null,'上传图片，自动生成白边贴纸')));
  let photoId=null, previewUrl=null, busy=false, sourceFile=null, currentMode='auto';
  const choose=h('button',{class:'btn btn-soft btn-sm',onclick:()=>pick()},icon('camera'),'选择图片');
  const modeButton=h('button',{class:'btn btn-ghost btn-sm',hidden:true,onclick:async()=>{
    if(!sourceFile||busy)return;currentMode=currentMode==='poster'?'auto':'poster';await process(sourceFile,currentMode);
    modeButton.textContent=currentMode==='poster'?'尝试自动抠图':'保留完整图片';
  }},'保留完整图片');
  async function process(file,mode='auto'){
    choose.disabled=true;modeButton.disabled=true;busy=true;status.className='reward-cutout-status working';status.lastElementChild.textContent=mode==='poster'?'正在生成完整图片贴纸…':'正在制作白边贴纸…';
    try{
      const {saveRewardSticker}=await import('../core/reward-art.js');const next=await saveRewardSticker(file,{mode});if(photoId)await del('photos',photoId).catch(()=>{});photoId=next;
      const row=await get('photos',photoId);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(row.thumb||row.blob);preview.replaceChildren(h('img',{src:previewUrl,alt:'奖励周边预览'}));choose.replaceChildren(icon('camera'),'更换图片');
      status.className='reward-cutout-status done';status.lastElementChild.textContent=mode==='poster'?'已保留完整图片并生成白边':'白边贴纸已生成';modeButton.hidden=false;
      toast('贴纸已经做好啦',{ic:'check'});
    }catch(error){status.className='reward-cutout-status error';status.lastElementChild.textContent='处理失败，请换一张更清晰的图片';toast(error.message||'图片处理失败',{ic:'error'});}finally{choose.disabled=false;modeButton.disabled=false;busy=false;}
  }
  async function pick(){
    const input=h('input',{type:'file',accept:'image/*',style:'display:none'});document.body.append(input);
    input.addEventListener('change',async()=>{const file=input.files?.[0];input.remove();if(!file)return;sourceFile=file;currentMode='auto';modeButton.textContent='保留完整图片';await process(file,'auto');});
    input.click();setTimeout(()=>input.isConnected&&input.remove(),8000);
  }
  let finalized=false;
  openModal({title:'制作自定义奖励',content:h('div',{class:'form-list'},
    h('div',{class:'form-item'},h('span',{class:'form-label'},'奖励图片'),preview,status,h('div',{class:'btn-row reward-image-actions'},choose,modeButton),h('span',{class:'form-hint'},'建议选择主体清楚、背景简单的图片；如果自动贴纸不满意，可以直接保留完整图片。')),
    h('div',{class:'form-item'},h('span',{class:'form-label'},'奖励内容'),titleInp),
    h('div',{class:'form-item'},h('span',{class:'form-label'},'所需积分'),costInp)),actions:[
      {label:'取消',onClick:async close=>{if(photoId)await del('photos',photoId).catch(()=>{});if(previewUrl)URL.revokeObjectURL(previewUrl);photoId=null;previewUrl=null;finalized=true;close();}},
      {label:'放进商城',cls:'btn-primary',onClick:async close=>{if(busy)return;const title=titleInp.value.trim();if(!title){toast('先写奖励内容',{ic:'error'});return;}await put('custom_rewards',{id:uid('cr'),title,cost:Math.max(0,Number(costInp.value)||0),photoId,redeemedAt:null,fulfilledAt:null,doneAt:null,createdAt:Date.now()});if(previewUrl)URL.revokeObjectURL(previewUrl);photoId=null;previewUrl=null;finalized=true;close();toast('已经放进你的商城',{ic:'gift'});ctx.rerender('home?tab=rewards&sub=custom');}}
    ],onClose:()=>{if(finalized)return;if(previewUrl)URL.revokeObjectURL(previewUrl);if(photoId)del('photos',photoId).catch(()=>{});}});
}

function rewardMiniArt(r){const box=h('span',{class:'reward-mini-art'});if(r.photoId){const img=h('img',{alt:'',loading:'lazy'});box.append(img);loadRewardImage(img,r.photoId);}else box.append(icon('gift'));return box;}
async function loadRewardImage(img,photoId){const row=await get('photos',photoId).catch(()=>null);if(!row)return;const url=URL.createObjectURL(row.thumb||row.blob);img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});img.src=url;}
async function deleteCustomReward(r,ctx){if(!(await confirmDlg('删除这条奖励？','已扣除的积分不会自动退回。',{danger:true,okLabel:'删除'})))return;await del('custom_rewards',r.id);if(r.photoId)await del('photos',r.photoId).catch(()=>{});ctx.rerender('home?tab=rewards&sub=custom');}

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
  if(!pets.length){box.append(h('div',{class:'card'},h('p',{class:'paper-empty'},'还没有伙伴，先完成初始伙伴选择吧。')));return;}
  const active=pets.find(p=>p.petId===appMeta.activePet)||pets[0];
  const def=PETS.find(p=>p.petId===active.petId)||PETS[0];
  const S=stats()||{}, progress=stageProgressOf(active.growth||0);
  const { petFigure,petResponse } = await import('../ui/paper.js');
  box.classList.add('paper-companion','paper-reference-companion');
  const go=(tab,sub=null)=>ctx.navigate(tab,sub);

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
    h('div',{class:'ref-room-pet'},figure),bubble);
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

  const actionDefs=[['touch','摸摸','heart'],['feed','喂食','gift'],['encourage','鼓励','star'],['play','玩耍','pet']];
  const actions=h('div',{class:'ref-pet-actions'});
  for(const [kind,label,ic] of actionDefs){const button=h('button',{class:'ref-pet-action action-'+kind,onclick:()=>runInteraction(kind)},
    h('span',{class:'ref-pet-action-art','aria-hidden':'true'},icon(ic)),h('b',null,label));actionButtons.push(button);actions.append(button);}
  box.append(actions);

  async function runInteraction(kind){
    if(actionBusy||!figure.isConnected)return;actionBusy=true;actionButtons.forEach(button=>button.disabled=true);figure.disabled=true;
    try{
      let text='',motion='touch';
      if(kind==='feed'||kind==='play'){
        const category=kind==='feed'?'food':'toy';
        const available=(await all('inventory')).some(row=>row.qty>0&&shopById(row.itemId)?.cat===category);
        if(!available){const agreed=await confirmDlg('背包里还没有'+(category==='food'?'食物':'玩具'),'可以去商城看看，用已有积分兑换。',{okLabel:'去商城'});if(agreed)go('rewards','shop');return;}
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
  if(!ids.length){const {petEmptyState}=await import('../ui/empty.js');badgeGrid.append(await petEmptyState('badges',{compact:true,actionLabel:'去记录',onAction:()=>{location.hash='#/today';}}));}
  badgeCard.append(badgeGrid);

  const memoryCard=h('section',{class:'card ref-memory-card'},h('div',{class:'ref-card-head'},h('h2',null,'▣ 我们的回忆'),h('button',{class:'more',onclick:()=>{location.hash='#/footprint';}},icon('right'))),
    h('div',{class:'ref-polaroid'},h('div',{class:'ref-polaroid-pet'},petFigure(active)),h('small',null,`已经一起走过 ${togetherDays} 天`),h('b',null,realLifeLogs?`留下 ${realLifeLogs} 次成长记录`:'第一段回忆，等你来写')));
  box.append(h('div',{class:'ref-memory-grid'},badgeCard,memoryCard));

  const props=h('section',{class:'card ref-props'},h('div',{class:'ref-card-head'},h('h2',null,'👜 小道具'),h('button',{class:'more',onclick:()=>go('rewards','owned')},'背包',icon('right'))),h('p',{class:'ref-props-sub'},'这些小物件能让相处更有趣～'));
  const propsList=h('div',{class:'ref-prop-list'});props.append(propsList);box.append(props,h('p',{class:'paper-page-note'},'几天不见也没关系，成长和收藏都还在。'));
  async function refreshProps(){
    const rows=(await all('inventory')).filter(row=>row.qty>0&&['food','toy'].includes(shopById(row.itemId)?.cat)).slice(0,3);propsList.replaceChildren();
    if(!rows.length){const {petEmptyState}=await import('../ui/empty.js');propsList.append(await petEmptyState('bag',{compact:true,actionLabel:'去商城',onAction:()=>go('rewards','shop')}));return;}
    for(const row of rows){const item=shopById(row.itemId);propsList.append(h('button',{class:'ref-prop',onclick:()=>go('rewards','owned')},h('img',{src:shopArt(item.id),alt:'',loading:'lazy'}),h('span',null,item.name),h('small',null,item.type==='consumable'?`×${row.qty}`:'永久')));}
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
  const head = h('div', { class: 'reward-shop-intro' },
    h('div',null,h('b',null,'宠物道具'),h('span',null,'只保留真正能使用的食物和玩具。')),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => ctx.navigate('rewards','owned') }, icon('bag'), '已拥有'));
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
  await renderUserRewardShop(box,ctx);
}
async function renderUserRewardShop(box,ctx){
  const rows=(await all('custom_rewards')).filter(r=>!r.redeemedAt&&!r.fulfilledAt&&!r.doneAt).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const section=h('section',{class:'card user-reward-shop'},h('div',{class:'card-title'},'我的奖励周边',h('button',{class:'more',onclick:()=>ctx.navigate('rewards','custom')},icon('plus'),'制作')));
  if(!rows.length){const {petEmptyState}=await import('../ui/empty.js');section.append(await petEmptyState('rewards',{compact:true,actionLabel:'制作奖励',onAction:()=>ctx.navigate('rewards','custom')}));box.append(section);return;}
  const grid=h('div',{class:'reward-custom-grid'});section.append(grid);
  rows.forEach(r=>{const art=h('div',{class:'reward-sticker-frame'});if(r.photoId){const img=h('img',{alt:r.title,loading:'lazy'});art.append(img);loadRewardImage(img,r.photoId);}else art.append(h('span',{class:'reward-sticker-fallback'},icon('gift')));
    grid.append(h('article',{class:'reward-product-card'},art,h('b',null,r.title),h('span',{class:'reward-price'},r.cost?`${r.cost} 积分`:'免费领取'),h('button',{class:'btn btn-primary btn-sm reward-exchange-btn',onclick:async e=>{const btn=e.currentTarget;if(btn.disabled)return;btn.disabled=true;try{const result=await redeemCustomReward(r.id);if(result?.err){toast(result.err,{ic:'error'});return;}toast('兑换成功，已放进待兑现',{ic:'gift'});ctx.rerender('home?tab=rewards&sub=shop');}finally{btn.disabled=false;}}},r.cost?'确认兑换':'领取')));
  });box.append(section);
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
        label: canBuy ? `确认兑换 · ${item.price}积分` : (unl ? '积分不足' : '未解锁'), cls: 'btn-primary exchange-confirm', disabled: !canBuy,
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
        h('button', { class: 'btn btn-soft btn-sm', onclick: async (e) => {
          const btn=e.currentTarget; if(btn.disabled)return; btn.disabled=true;
          try { const result=await usePetItem(item.id); if(result?.err){toast(result.err,{ic:'error'});return;} sound.play('pet'); toast(`用掉了「${item.name}」`); ctx.rerender(); }
          finally { btn.disabled=false; }
        } }, '使用')));
    } else {
      hasP = true;
      cardP.append(h('div', { class: 'row-item inv-row' },
        h('img', { src: shopArt(item.id), style: 'width:44px;height:44px;border-radius:12px', alt: item.name }),
        h('div', { class: 'row-main' }, h('div', { class: 'row-title', style: 'font-size:13.5px' }, item.name), h('div', { class: 'row-sub' }, catLabel(item.cat))),
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => usePerm(item, ctx) }, catLabelUse(item.cat))));
    }
  }
  if (!hasC) cardC.append(h('div', { class: 'empty' }, '背包里还没有消耗品'));
  if (!hasP) cardP.append(h('div', { class: 'empty' }, '兑换的永久物品会出现在这里'));
  const rewardHistory = await renderRedeemedRewards(ctx);
  box.append(cardC, cardP, rewardHistory,
    h('div', { class: 'form-hint', style: 'text-align:center;line-height:1.8' },
      '食物和玩具可以直接使用；旧家具与穿戴只保留历史收藏，不再提供新的操作入口。'));
}
async function renderRedeemedRewards(ctx){
  const rows=(await all('custom_rewards')).filter(r=>r.redeemedAt||r.fulfilledAt||r.doneAt).sort((a,b)=>(b.redeemedAt||b.doneAt||0)-(a.redeemedAt||a.doneAt||0));
  const section=h('section',{class:'card reward-history-card'},h('div',{class:'card-title'},icon('gift'),'我的奖励'));
  if(!rows.length){section.append(h('div',{class:'row-sub'},'兑换后的自定义奖励会出现在这里。'));return section;}
  const pending=rows.filter(r=>!(r.fulfilledAt||r.doneAt));
  const done=rows.filter(r=>r.fulfilledAt||r.doneAt);
  const appendRow=(r,fulfilled)=>section.append(h('div',{class:'reward-custom-row reward-history-row'},rewardMiniArt(r),
    h('div',{class:'row-main'},h('b',{class:'row-title'+(fulfilled?' done':'')},r.title),h('div',{class:'row-sub'},r.cost?`${r.cost} 积分`:'无需积分',fulfilled?' · 已完成':' · 待兑现')),
    fulfilled?null:h('button',{class:'btn btn-soft btn-sm',onclick:async()=>{r.fulfilledAt=Date.now();r.doneAt=r.fulfilledAt;await put('custom_rewards',r);toast('已记下这份奖励',{ic:'check'});ctx.rerender('home?tab=rewards&sub=owned');}},'已经享受')));
  if(pending.length)section.append(h('div',{class:'reward-history-title'},'待兑现'));
  pending.forEach(r=>appendRow(r,false));
  if(done.length)section.append(h('div',{class:'reward-history-title'},'已完成'));
  done.forEach(r=>appendRow(r,true));
  return section;
}

function catLabel(cat) { return { food: '食物', toy: '玩具', outfit: '装扮', furniture: '家具', bg: '背景', display: '展示' }[cat] || cat; }
function catLabelUse(cat) { return cat === 'toy' ? '玩耍' : '历史收藏'; }
async function usePerm(item, ctx) {
  if (item.cat === 'toy') {
    const result=await usePetItem(item.id);
    if(result?.err){toast(result.err,{ic:'error'});return;}
    sound.play('pet');
    toast('和伙伴玩了一会儿', { ic: 'pet' });
    ctx.rerender();
    return;
  }
  toast('这件收藏现在可以查看，暂时不能使用。', { ic: 'bag', ms: 3200 });
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

