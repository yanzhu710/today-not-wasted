import { BADGES, SHOP, badgeById } from './catalog.js';
import { all, loadKV, saveKV } from './db.js';
import { stats } from './engine.js';
import { h } from './util.js';
import { badgeArt } from './art.js';
import { openModal, toast } from './fx.js';
const metrics=new Map();
const seq=(start,targets,get,unit)=>targets.forEach((target,i)=>metrics.set('A'+String(start+i).padStart(3,'0'),{get,target,unit}));
seq(11,[60,180,300,600,1200,1800,3000,6000,12000,21900],s=>s.focusMin||0,'分钟');
seq(21,[1,5,10,25,50],s=>s.catStats?.sport?.count||0,'次');
seq(26,[1000,2500,5000,10000],s=>s.catStats?.sport?.min||0,'分钟');
seq(30,[100],s=>s.catStats?.sport?.days?.size||0,'天');
seq(31,[1,3,10,25,50,100],s=>s.catStats?.cook?.count||0,'次');
seq(37,[7,30,60,100],s=>s.catStats?.cook?.days?.size||0,'天');
seq(41,[1,5,15,30,60,100],s=>s.catStats?.tidy?.count||0,'次');
seq(47,[1,20,50,100],s=>s.checklistDone||0,'张');
seq(51,[1,3,7,15,30,60,100],s=>s.journalDays?.size||0,'天');
seq(58,[50],s=>s.journalPhotoCount||0,'篇');seq(59,[12],s=>s.monthReviewCount||0,'次');seq(60,[365],s=>s.journalDays?.size||0,'天');
seq(63,[1,3,5,10,25,50],s=>s.goalDone||0,'个');seq(69,[1],s=>Number(s.goalWith5StepsDone)||0,'个');seq(70,[100],s=>s.milestoneDone||0,'个');
seq(71,[1,3,7,30,100],s=>s.ledgerDays?.size||0,'天');seq(76,[300],s=>s.ledgerCount||0,'笔');
seq(78,[3,12],s=>s.ledgerReviewMonths?.size||0,'次');seq(80,[1000],s=>s.ledgerCount||0,'笔');
seq(85,[10,50],s=>s.petInteractions||0,'次');seq(87,[2,3,4,5],s=>s.petMaxStage||1,'阶段');
seq(94,[5,10,20,30,40],s=>s.permItems||0,'件');seq(99,[10],s=>s.showcaseCount||0,'枚');seq(100,[1],s=>s.seriesComplete||0,'系列');
seq(101,[3,6,9,12],s=>s.months?.size||0,'个月');seq(109,[100,365],s=>s.days?.size||0,'天');
seq(111,[3,5,7,9],s=>s.cats?.size||0,'类');seq(115,[7,30,100,365],s=>s.days?.size||0,'天');seq(119,[30,60],s=>s.badgeCount||0,'枚');
export function badgeProgress(badge,S={}) {
  const m=metrics.get(badge.id);let achieved=false;try{achieved=!!badge.check(S);}catch{}
  if(!m)return {ratio:achieved?1:0,current:achieved?1:0,target:1,text:achieved?'已满足条件':badge.cond,numeric:false};
  const current=Math.max(0,Number(m.get(S))||0), remain=Math.max(0,m.target-current);
  return {current,target:m.target,ratio:Math.min(1,current/m.target),numeric:true,text:`${current}/${m.target} ${m.unit}${remain?` · 还差 ${remain} ${m.unit}`:' · 已满足条件'}`};
}
function paused(b) {
  if(['A092','A093'].includes(b.id))return true;
  if(/^A09[4-8]$/.test(b.id))return metrics.get(b.id).target>SHOP.filter(s=>['food','toy'].includes(s.cat)&&s.type==='perm').length;
  return false;
}
export async function trackingCard() {
  const [cfg,rows]=await Promise.all([loadKV('tracked_badge'),all('badges')]);
  const b=badgeById(cfg.badgeId),got=b&&rows.some(r=>r.badgeId===b.id);
  const card=h('div',{class:'card',id:'tracked-badge-card'});
  card.append(h('div',{class:'card-title'},b?'当前追踪':'选择一枚想获得的徽章',
    h('button',{class:'more',onclick:chooseTrackedBadge},b?'更换':'选择')));
  if(b) {
    const p=badgeProgress(b,stats()||{});
    card.append(h('div',{class:'row-item'},h('img',{src:badgeArt(b.id),alt:b.name,style:'width:56px;height:56px;object-fit:contain'}),
      h('div',{class:'row-main'},h('b',null,b.name),h('div',{class:'row-sub'},got?'已获得，去看看下一枚吧':paused(b)?'涉及暂不开放的功能，可更换目标':p.text))));
    if(p.numeric&&!paused(b))card.append(h('div',{class:'bar'},h('i',{style:`width:${got?100:Math.round(p.ratio*100)}%`})));
  } else card.append(h('div',{class:'form-hint'},'选你喜欢的系列，不用同时追求所有成就。'));
  card.append(h('button',{class:'btn btn-soft btn-sm',onclick:()=>{location.hash='#/home?tab=badges';}},'打开收藏册'));
  return card;
}
export async function chooseTrackedBadge() {
  const [rows,cfg]=await Promise.all([all('badges'),loadKV('tracked_badge')]);const got=new Set(rows.map(r=>r.badgeId));
  let saving=false;const list=h('div',{style:'max-height:52vh;overflow:auto'});
  const search=h('input',{class:'input',placeholder:'搜索徽章名称或系列','aria-label':'搜索徽章'});
  const render=()=>{
    list.replaceChildren();
    for(const b of BADGES.filter(b=>!got.has(b.id)&&!paused(b)&&(b.name+b.series).includes(search.value.trim()))) {
      const p=badgeProgress(b,stats()||{});
      list.append(h('button',{class:'row-item',style:'width:100%;text-align:left',onclick:async()=>{
        if(saving)return;saving=true;
        try{await saveKV('tracked_badge',{badgeId:b.id});m.close();window.dispatchEvent(new CustomEvent('tjmbg:rerender'));toast('已追踪「'+b.name+'」');}
        catch(e){saving=false;toast('保存失败，请重试',{ic:'error'});}
      }},h('div',{class:'row-main'},h('b',null,b.name),h('div',{class:'row-sub'},b.series+' · '+p.text))));
    }
  };
  search.addEventListener('input',render);
  const m=openModal({title:'追踪一枚徽章',content:h('div',null,search,list),actions:[
    {label:'取消追踪',onClick:async c=>{await saveKV('tracked_badge',{});c();window.dispatchEvent(new CustomEvent('tjmbg:rerender'));}},
    {label:'关闭',onClick:c=>c()},
  ]});render();
}
