// 今天没白过 · 「家园」页：家园场景 / 商城 / 背包 / 徽章收藏册与展示栏
import { all, allByIndex, get, put, del, loadKV, saveKV, patchKV } from '../core/db.js';
import { PETS, SHOP, SHOP_CATS, BADGES, BADGE_SERIES, badgeById, badgeRarity, stageOf, stageProgress, STAGES, PRIMARY_PET_ID, CROWN_ITEM_ID, COMPANION_CONFIG, shopById, isUnlocked, unlockText, POINTS } from '../core/catalog.js';
import { purchaseItem, redeemCustomReward, usePetItem, petInteract, claimPetWithInvite, savePetName, setActivePet, coronateActivePet, balance, stats, getActivePet } from '../core/engine.js';
import { shopArt, badgeArt, setBadgeIndex } from '../core/art.js';
import { h, icon, fmtMin, todayKey, fmtCN, uid } from '../core/util.js';
import { openModal, actionSheet, confirmDlg, formDlg, queueSettle, toast, burstAt, sparkleAt, pulse } from '../core/fx.js';
import * as sound from '../core/sound.js';
import { routeTabs } from '../ui/tabs.js';
import { companionDisplayName, companionStage, companionStatus, coronationReady, companionMemories, syncCompanionMemories } from '../core/companion.js';

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
  const [pets, appMeta, unlocked, inventory, petLogs] = await Promise.all([all('pets'),loadKV('app_meta'),all('badges'),all('inventory'),allByIndex('petlog','dateKey',todayKey())]);
  const active=pets.find(p=>p.petId===appMeta.activePet)||pets.find(p=>p.petId===PRIMARY_PET_ID)||pets[0];
  if(!active){box.append(h('p',{class:'paper-empty'},'伙伴正在准备中，请重新打开一次。'));return;}
  const { petFigure,petResponse }=await import('../ui/paper.js');
  await syncCompanionMemories(active);
  const memories=await companionMemories(active.petId);
  const stage=companionStage(active), progress=stageProgress(active.growth||0,!!active.coronationAt), status=companionStatus(active);
  const togetherDays=Math.max(1,Math.floor((Date.now()-(Number(active.ownedAt)||Date.now()))/86400000)+1);
  const mode=appMeta.companionView==='cards'?'cards':'form';
  const todayLogs=petLogs.filter(l=>l.dateKey===todayKey()&&l.interaction&&Number(l.amount)>0);
  const totalRewarded=todayLogs.length,totalCap=Object.values(COMPANION_CONFIG.interactionDailyCaps).reduce((a,b)=>a+b,0);
  box.classList.add('companion-v25');

  async function renamePet(force=false){
    const v=await formDlg({title:force?'给你的伙伴起个名字':'给伙伴改名',submitLabel:'保存',fields:[{key:'n',label:'名字',type:'text',value:active.name||'',placeholder:'1–12 个字',required:true}]});
    if(!v?.n?.trim()){if(force)setTimeout(()=>renamePet(true),250);return;}
    await savePetName(active,v.n);await patchKV('profile',{petName:v.n.trim().slice(0,12)});toast('名字记住啦',{ic:'heart'});ctx.rerender('home?tab=home');
  }
  // v2.5.0：老用户迁移后如果没有自定义过伙伴名，第一次打开伙伴页也必须完成命名。
  if(!String(active.name||'').trim()&&!window.__tjmbgCompanionNamePrompted){
    window.__tjmbgCompanionNamePrompted=true;
    setTimeout(()=>renamePet(true),180);
  }

  const identity=h('section',{class:'companion-identity'},
    h('div',{class:'companion-name-block'},h('span',{class:'companion-kicker'},'MY COMPANION'),
      h('div',{class:'companion-name-line'},h('h1',null,companionDisplayName(active)),h('button',{class:'companion-inline-btn','aria-label':'改名',onclick:()=>renamePet(false)},icon('edit'))),
      h('p',null,`Lv.${stage.n} ${stage.name} · 已陪伴 ${togetherDays} 天`)),
    h('div',{class:'companion-head-actions'},
      h('button',{class:'iconbtn','aria-label':'伙伴资料',onclick:()=>openCompanionProfile(active,togetherDays,memories)},icon('book')),
      h('button',{class:'iconbtn','aria-label':'切换伙伴',onclick:()=>openPartnerBook(pets,active,ctx)},icon('pet'))));
  const modeSwitch=h('div',{class:'companion-view-switch','aria-label':'伙伴展示方式'},
    h('button',{class:mode==='form'?'on':'',onclick:async()=>{if(mode==='form')return;await patchKV('app_meta',{companionView:'form'});ctx.rerender('home?tab=home');}},'形态'),
    h('button',{class:mode==='cards'?'on':'',onclick:async()=>{if(mode==='cards')return;await patchKV('app_meta',{companionView:'cards'});ctx.rerender('home?tab=home');}},'闪卡'));
  box.append(identity,modeSwitch);

  if(mode==='cards'){
    const {renderFlashcards}=await import('../ui/flashcards.js');
    box.append(renderFlashcards(active,{onDispose:ctx.onDispose}));
    box.append(h('p',{class:'paper-page-note'},'闪卡会随着成长阶段逐张解锁。Lv.4 需要完成加冕仪式。'));
    return;
  }

  const bubble=h('p',{class:'companion-scene-bubble','aria-live':'polite'},status.text);
  let figure;
  const restAction=status.id==='困困'?'sleep':status.id==='开心'?'happy':'idle';
  figure=petFigure(active,{interactive:true,action:restAction,onDispose:ctx.onDispose,onClick:()=>runInteraction('touch')});
  const scene=h('section',{class:`companion-scene stage-${stage.n}`},
    h('span',{class:'companion-scene-sun','aria-hidden':'true'}),h('span',{class:'companion-scene-leaf leaf-a','aria-hidden':'true'}),h('span',{class:'companion-scene-leaf leaf-b','aria-hidden':'true'}),
    h('div',{class:'companion-scene-pet'},figure),bubble,
    h('span',{class:'companion-status-chip'},'今日状态 · '+status.id));
  box.append(scene);

  const growthCard=h('section',{class:'companion-growth-panel'},
    h('div',{class:'companion-growth-top'},
      h('div',null,h('span',{class:'companion-kicker'},'TOGETHER'),h('b',null,`陪伴值 ${Number(active.growth)||0}`),
        h('small',null,progress.coronationReady?'条件已达成，等待完成加冕':progress.next?`距离 Lv.${progress.next.n} 还差 ${progress.remain}`:'纪念期已解锁')),
      h('span',{class:'companion-stage-pill'},`Lv.${stage.n} ${stage.name}`)),
    h('progress',{class:'paper-progress',value:progress.next?Math.max(0,Math.min(1,progress.ratio)):1,max:'1','aria-label':'陪伴值进度'}),
    h('ol',{class:'companion-stage-track'},STAGES.map(st=>h('li',{class:(st.n<=stage.n?'reached ':'')+(st.n===4&&progress.coronationReady&&!active.coronationAt?'ready':'')},
      h('span',null,st.n===4?'♛':'♡'),h('b',null,`Lv.${st.n}`),h('small',null,st.name)))));
  box.append(growthCard);

  const interactions=h('section',{class:'companion-interactions'},
    h('div',{class:'companion-section-head'},h('div',null,h('h2',null,'和它待一会儿'),h('p',null,`今天已有 ${totalRewarded}/${totalCap} 次互动带来陪伴值；达到上限后仍然可以继续玩。`))),
    h('div',{class:'companion-action-grid'}));
  const actionGrid=interactions.lastElementChild;
  const defs=[['touch','摸摸','heart'],['feed','喂食','gift'],['play','玩耍','pet'],['encourage','鼓励','star']];
  let busy=false;const buttons=[],buttonByKind=new Map();
  defs.forEach(([kind,label,ic])=>{const cap=COMPANION_CONFIG.interactionDailyCaps[kind]||0,count=todayLogs.filter(l=>l.interaction===kind).length;const b=h('button',{class:'companion-action action-'+kind,onclick:()=>runInteraction(kind)},h('span',null,icon(ic)),h('b',null,label),h('small',null,count>=cap?'今天的陪伴值已收满':`${Math.min(count,cap)}/${cap} 次有陪伴值`));buttons.push(b);buttonByKind.set(kind,b);actionGrid.append(b);});
  box.append(interactions);

  async function runInteraction(kind){
    if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);figure.disabled=true;
    try{
      let result=null,item=null;
      if(kind==='feed'||kind==='play'){
        const cat=kind==='feed'?'food':'toy';
        const available=inventory.some(row=>row.qty>0&&shopById(row.itemId)?.cat===cat);
        if(!available){const go=await confirmDlg(cat==='food'?'还没有可以喂的食物':'还没有可以玩的玩具','去商城挑一个喜欢的，再回来互动吧。',{okLabel:'去商城'});if(go)ctx.navigate('rewards','shop');return;}
        const {choosePetItem}=await import('../core/item-picker.js');result=await choosePetItem(cat);if(!result?.ok)return;item=result.item;
      }else result=await petInteract({kind,touch:kind==='touch'});
      const lines={touch:'蹭蹭你，我在呢。',feed:item?`吃到了${item.name}，好满足。`:'吃饱啦。',play:item?`和你一起玩${item.name}最开心了。`:'一起玩一会儿吧。',encourage:'你已经很努力了，今天也要对自己好一点。'};
      petResponse(figure,bubble,lines[kind],kind);
      pulse(figure);
      const fxColors={touch:['#E8A0B4','#F5D7DE','#FFF4E8'],feed:['#E7B65A','#F2D98C','#F9E8C3'],play:['#7FA989','#B7CFB0','#F4E8B4'],encourage:['#D8A94D','#F2D98C','#FFF6DF']}[kind];
      sparkleAt(buttonByKind.get(kind)||figure,{colors:fxColors,count:7,radius:34});
      try { navigator.vibrate?.(kind==='play'?[18,26,18]:18); } catch {}
      if(result?.discovered){const found=result.discovered.type==='food'?shopById(result.discovered.itemId)?.name:result.discovered.type==='toy'?shopById(result.discovered.itemId)?.name:'摸摸';toast(`✨ 好像发现了它很喜欢「${found||'这个'}」`,{ic:'heart',ms:3200});}
      else if(result?.growth>0) toast(`陪伴值 +${result.growth}`,{ic:'heart'});
      else if(result?.capped) toast('今天的陪伴已经很满啦，继续互动也一样会回应你。',{ic:'heart',ms:2800});
      sound.play('pet');setTimeout(()=>ctx.rerender('home?tab=home'),1550);
    }catch(error){console.error(error);toast(error.message||'这次互动没有完成',{ic:'error'});}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);figure.disabled=false;}
  }

  const crownInv=inventory.find(row=>row.itemId===CROWN_ITEM_ID&&row.qty>0);
  if(stage.n===4){
    box.append(h('section',{class:'companion-crown crowned'},h('span',{class:'crown-symbol'},'♛'),h('div',null,h('b',null,'纪念期 · 已完成加冕'),h('p',null,`这次成长仪式完成于 ${fmtCN(new Date(active.coronationAt).toISOString().slice(0,10))}。Lv.4 闪卡已经解锁。`)),h('button',{class:'btn btn-soft btn-sm',onclick:async()=>{await patchKV('app_meta',{companionView:'cards'});ctx.rerender('home?tab=home');}},'查看纪念闪卡')));
  }else if(coronationReady(active)){
    box.append(h('section',{class:'companion-crown ready'},h('span',{class:'crown-symbol'},'♛'),h('div',null,h('b',null,'已经达到加冕条件'),h('p',null,crownInv?'加冕果实已经准备好了。完成仪式后会进入 Lv.4 纪念期。':'去商城兑换一颗加冕果实，再回来完成最后的成长仪式。')),
      crownInv?h('button',{class:'btn btn-primary btn-sm',onclick:async()=>{if(!(await confirmDlg('完成加冕仪式？','会消耗 1 颗加冕果实，并永久解锁 Lv.4 纪念期与最终闪卡。',{okLabel:'开始加冕'})))return;const r=await coronateActivePet();if(r?.err){toast(r.err,{ic:'error'});return;}petResponse(figure,bubble,'从今天开始，我们又多了一段值得珍藏的故事。','celebrate');toast('加冕完成 · Lv.4 纪念期已解锁',{ic:'badge',ms:3600});setTimeout(()=>ctx.rerender('home?tab=home'),2200);}},'喂食加冕果实'):h('button',{class:'btn btn-primary btn-sm',onclick:()=>{shopCat='growth';ctx.navigate('rewards','shop');}},'去商城兑换')));
  }

  const prefs=active.preferences||{food:[],toy:[],interaction:[]};
  const discovered=[...prefs.food.map(id=>['食物',shopById(id)?.name||id]),...prefs.toy.map(id=>['玩具',shopById(id)?.name||id]),...prefs.interaction.map(id=>['互动',id==='touch'?'摸摸':id])];
  box.append(h('section',{class:'companion-discovery'},
    h('div',{class:'companion-section-head'},h('div',null,h('h2',null,'慢慢发现它的喜好'),h('p',null,'不是一开始就知道答案，互动久了才会慢慢发现。'))),
    discovered.length?h('div',{class:'companion-pref-list'},discovered.map(([type,name])=>h('span',{class:'companion-pref-chip'},h('small',null,type),h('b',null,name)))):h('p',{class:'companion-soft-empty'},'目前还是秘密。试试不同的食物、玩具和互动方式。')));

  const memorySection=h('section',{class:'companion-memories'},
    h('div',{class:'companion-section-head'},h('div',null,h('h2',null,'我们的回忆'),h('p',null,`已经留下 ${memories.length} 个共同节点。`)),h('button',{class:'paper-text-link',onclick:()=>openMemories(memories)},'全部',icon('right'))),
    h('div',{class:'companion-memory-strip'}));
  const strip=memorySection.lastElementChild;
  memories.slice(-4).reverse().forEach(m=>strip.append(h('button',{class:'companion-memory-card',onclick:()=>openMemories(memories,m.id)},h('span',null,m.dateKey||''),h('b',null,m.title),h('small',null,m.note||''))));
  if(!memories.length)strip.append(h('p',{class:'companion-soft-empty'},'第一段回忆已经开始，继续一起生活就会慢慢变多。'));
  box.append(memorySection,h('p',{class:'paper-page-note'},'几天不见也没关系。陪伴值不会因为离开而下降，它会在这里等你。'));
}

async function openPartnerBook(pets,active,ctx){
  const items=PETS.map(def=>{const owned=pets.find(p=>p.petId===def.petId);if(owned)return {ic:def.petId===active.petId?'check':'pet',label:(owned.name||'未命名伙伴')+(def.petId===active.petId?' · 当前':''),sub:def.species,onClick:async()=>{if(def.petId!==active.petId){await setActivePet(def.petId);ctx.rerender('home?tab=home');}}};return {ic:'lock',label:'新伙伴 · 尚未解锁',sub:'有邀请号时可以在这里解锁',onClick:()=>invitePartner(def,ctx)};});
  await actionSheet('伙伴册',items);
}
async function invitePartner(def,ctx){
  const v=await formDlg({title:'该伙伴尚未解锁',submitLabel:'立即解锁',fields:[{key:'code',label:'邀请号',type:'text',placeholder:'请输入邀请号',required:true}]});
  if(!v?.code)return;const r=await claimPetWithInvite(def.petId,v.code);if(r?.err){toast(r.err,{ic:'error',ms:3000});return;}
  const named=await formDlg({title:'给新伙伴起个名字',submitLabel:'记住',fields:[{key:'name',label:'名字',type:'text',placeholder:'1–12 个字',required:true}]});
  if(named?.name?.trim()) await savePetName(r.pet,named.name.trim());
  toast('新伙伴已经加入',{ic:'pet'});ctx.rerender('home?tab=home');
}
function preferenceText(pet,type){
  const rows=pet.preferences?.[type]||[];if(!rows.length)return '还在慢慢发现';
  if(type==='interaction')return rows.map(v=>v==='touch'?'摸摸':v).join('、');
  return rows.map(id=>shopById(id)?.name||id).join('、');
}
function openCompanionProfile(pet,togetherDays,memories){
  const st=companionStage(pet),status=companionStatus(pet);
  openModal({title:(pet.name||'伙伴')+'的资料',content:h('div',{class:'companion-profile-sheet'},
    h('div',{class:'companion-profile-hero'},h('img',{src:`./assets/pets/ali/ali_lv${st.n}_idle.png`,alt:'',draggable:'false'}),h('div',null,h('b',null,pet.name||'你的伙伴'),h('span',null,`Lv.${st.n} ${st.name}`),h('small',null,`陪伴值 ${pet.growth||0}`))),
    h('dl',null,h('div',null,h('dt',null,'相遇日'),h('dd',null,fmtCN(new Date(pet.ownedAt||Date.now()).toISOString().slice(0,10)))),h('div',null,h('dt',null,'陪伴天数'),h('dd',null,`${togetherDays} 天`)),h('div',null,h('dt',null,'今日状态'),h('dd',null,status.id)),h('div',null,h('dt',null,'喜欢的食物'),h('dd',null,preferenceText(pet,'food'))),h('div',null,h('dt',null,'喜欢的玩具'),h('dd',null,preferenceText(pet,'toy'))),h('div',null,h('dt',null,'喜欢的互动'),h('dd',null,preferenceText(pet,'interaction'))),h('div',null,h('dt',null,'共同回忆'),h('dd',null,`${memories.length} 个`)))),actions:[{label:'关闭',onClick:c=>c()}]});
}
function openMemories(memories,focusId=null){
  const list=h('div',{class:'companion-memory-list'});
  [...memories].reverse().forEach(m=>list.append(h('article',{class:'companion-memory-row'+(m.id===focusId?' focus':'')},h('span',{class:'companion-memory-dot'}),h('div',null,h('time',null,m.dateKey||''),h('b',null,m.title),h('p',null,m.note||'')))));
  openModal({title:'我们的回忆',content:list,actions:[{label:'关闭',onClick:c=>c()}]});
}

function stageProgressOf(g,crowned=false){ return stageProgress(g,crowned); }

// ---- 商城 ----
async function renderShop(box, ctx) {
  const S = stats() || {};
  const [inv, pets, activePet] = await Promise.all([all('inventory'), all('pets'), getActivePet()]);
  const invMap = new Map(inv.map((i) => [i.itemId, i]));
  const ctxUn = { maxStage: S.petMaxStage || 1, badgeCount: S.badgeCount || 0, seriesComplete: S.seriesComplete || 0, coronationReady:coronationReady(activePet) };
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
        owned && (item.type === 'perm' || item.unique) ? h('span', { class: 'owned' }, '已拥有') : owned ? h('span', { class: 'owned' }, `×${owned.qty}`) : null,
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
  const activePet=await getActivePet();
  const unl = isUnlocked(item, { maxStage: S.petMaxStage || 1, badgeCount: S.badgeCount || 0, seriesComplete: S.seriesComplete || 0, coronationReady:coronationReady(activePet) });
  const bal = balance();
  const alreadyOwned = !!owned?.qty && (item.type === 'perm' || item.unique);
  const canBuy = unl && !alreadyOwned && !(item.id===CROWN_ITEM_ID && activePet?.coronationAt) && bal >= item.price;
  openModal({
    title: item.name,
    content: h('div', null,
      h('img', { src: shopArt(item.id), alt: item.name, style: 'width:200px;height:200px;border-radius:20px;display:block;margin:0 auto;background:var(--surface2)' }),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:10px' },
        h('span', { class: 'tag tag-acc' }, `${item.price} 积分`),
        h('span', { class: 'tag' }, item.type === 'consumable' ? '消耗品' : '永久'),
        owned ? h('span', { class: 'tag tag-pri' }, (item.type === 'perm' || item.unique) ? '已拥有' : `拥有 ×${owned.qty}`) : null),
      h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:6px' }, item.desc),
      item.id===CROWN_ITEM_ID ? h('div',{class:'coronation-shop-note'},icon('star'),coronationReady(activePet)?'加冕条件已满足：兑换后回伙伴页完成仪式。':activePet?.coronationAt?'已经完成加冕，不需要再次兑换。':`陪伴值达到 ${COMPANION_CONFIG.coronationGrowth} 后开放兑换。`) : null,
      !unl ? h('div', { class: 'form-hint', style: 'text-align:center;margin-top:8px' }, '解锁条件：' + unlockText(item)) : null,
      !canBuy && unl ? h('div', { class: 'form-hint', style: 'text-align:center;margin-top:8px' },
        alreadyOwned ? '已经拥有，不会重复扣分' : activePet?.coronationAt && item.id===CROWN_ITEM_ID ? '伙伴已经完成加冕' : bal < item.price ? `积分还差 ${item.price - bal}，去做点事吧` : '') : null),
    actions: [
      { label: '关闭', onClick: (c) => c() },
      {
        label: canBuy ? `确认兑换 · ${item.price}积分` : (alreadyOwned ? '已拥有' : activePet?.coronationAt && item.id===CROWN_ITEM_ID ? '已完成加冕' : (unl ? '积分不足' : '未解锁')), cls: 'btn-primary exchange-confirm', disabled: !canBuy,
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
        item.id===CROWN_ITEM_ID
          ? h('button',{class:'btn btn-primary btn-sm',onclick:()=>ctx.navigate('home')},'去加冕')
          : h('button', { class: 'btn btn-soft btn-sm', onclick: async (e) => {
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
  if (!hasC) { const {petEmptyState}=await import('../ui/empty.js'); cardC.append(await petEmptyState('bagConsumable',{compact:true})); }
  if (!hasP) { const {petEmptyState}=await import('../ui/empty.js'); cardP.append(await petEmptyState('bagPermanent',{compact:true})); }
  const rewardHistory = await renderRedeemedRewards(ctx);
  box.append(cardC, cardP, rewardHistory,
    h('div', { class: 'form-hint', style: 'text-align:center;line-height:1.8' },
      '食物和玩具可以直接使用；收藏过的物品会继续留在这里。'));
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
  const bookWrap = h('div', { class:'badge-book-wrap' });
  const filterText = h('span', { class:'badge-filter-text' });

  function statusLabel() {
    if (badgeFilter.got === 'got') return '已获得';
    if (badgeFilter.got === 'nogot') return '未获得';
    return '全部徽章';
  }
  function seriesLabel() { return badgeFilter.series || '全部系列'; }
  function updateFilterText() { filterText.textContent = `${statusLabel()} · ${seriesLabel()}`; }

  async function openFilter() {
    const v = await formDlg({
      title:'筛选徽章',
      submitLabel:'应用筛选',
      fields:[
        { key:'got', label:'解锁状态', type:'select', value:badgeFilter.got || 'all', options:[['all','全部徽章'],['got','已获得'],['nogot','未获得']] },
        { key:'series', label:'徽章系列', type:'select', value:badgeFilter.series || 'all', options:[['all','全部系列'], ...BADGE_SERIES.map((s)=>[s,s])] },
      ],
    });
    if (!v) return;
    badgeFilter.got = v.got === 'all' ? null : v.got;
    badgeFilter.series = v.series === 'all' ? null : v.series;
    updateFilterText();
    await drawBook();
  }

  const head = h('section', { class:'badge-library-head' },
    h('div', { class:'badge-library-title' },
      h('div', null, h('span', { class:'badge-library-kicker' }, '徽章册'), h('h2', null, '把走过的日子收进这里'), h('p', null, '重要的第一次、坚持和陪伴，都会慢慢留下来。')),
      h('button', { class:'btn btn-soft btn-sm', onclick:openFilter }, icon('settings'), '筛选')),
    h('div', { class:'badge-progress-strip' },
      h('div', null, h('b', { class:'num' }, `${unlocked.length}/120`), h('span', null, '已解锁')),
      h('div', null, h('b', { class:'num' }, `${S.seriesComplete || 0}/12`), h('span', null, '系列集齐')),
      h('div', null, h('b', { class:'num' }, `${showcase.length}/10`), h('span', null, '展示栏'))),
    h('button', { class:'badge-filter-bar', onclick:openFilter },
      h('span', null, icon('settings'), '当前筛选'), filterText, icon('right')));
  box.append(head, bookWrap);
  updateFilterText();

  async function drawBook() {
    bookWrap.replaceChildren();
    let rendered = 0;
    for (const serie of BADGE_SERIES) {
      if (badgeFilter.series && badgeFilter.series !== serie) continue;
      const allInSeries = BADGES.filter((b) => b.series === serie);
      const list = allInSeries.filter((b) => badgeFilter.got === null || (badgeFilter.got === 'got' ? gotMap.has(b.id) : !gotMap.has(b.id)));
      if (!list.length) continue;
      rendered += list.length;
      const gotN = allInSeries.filter((b) => gotMap.has(b.id)).length;
      const total = allInSeries.length;
      const section = h('section', { class:'badge-series-section' },
        h('div', { class:'serie-head' }, h('div', null, h('b', null, serie), h('small', null, `${gotN}/${total} 已解锁`)), gotN === total ? h('span', { class:'tag tag-pri' }, '已集齐') : null));
      const grid = h('div', { class:'badge-grid' });
      for (const b of list) {
        const got = gotMap.get(b.id);
        grid.append(h('button', { class:'badge-cell' + (got ? ' got' : ''), onclick:(e)=>{ playBadgeTapFx(e.currentTarget, !!got, b.points); badgeDetail(b, got, e.currentTarget); } },
          h('div', { class:'badge-imgbox' + (got ? '' : ' locked') }, h('img', { src:badgeArt(b.id), alt:b.name, loading:'lazy' })),
          h('span', { class:'nm' }, b.name)));
      }
      section.append(grid);
      bookWrap.append(section);
    }
    if (!rendered) {
      const { petEmptyState } = await import('../ui/empty.js');
      bookWrap.append(await petEmptyState('badges',{compact:true,actionLabel:'重置筛选',onAction:()=>{ badgeFilter={series:null,got:null}; updateFilterText(); drawBook(); }}));
    }
  }
  await drawBook();
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

