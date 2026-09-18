// Explicit progress metadata from the pinned catalogue; never evaluate strings as code.
import { BADGES, badgeById } from './catalog.js';
import { all, loadKV, saveKV } from './db.js';
import { computeStats } from './engine.js';
import { h } from './util.js';
import { formDlg, toast } from './fx.js';
import { badgeArt } from './art.js';
import { loadRepairStyles } from './analytics.js';
const PROGRESS = {
  "A011": {
    "path": "focusMin",
    "target": 60,
    "signature": "gt(S.focusMin,60)"
  },
  "A012": {
    "path": "focusMin",
    "target": 180,
    "signature": "gt(S.focusMin,180)"
  },
  "A013": {
    "path": "focusMin",
    "target": 300,
    "signature": "gt(S.focusMin,300)"
  },
  "A014": {
    "path": "focusMin",
    "target": 600,
    "signature": "gt(S.focusMin,600)"
  },
  "A015": {
    "path": "focusMin",
    "target": 1200,
    "signature": "gt(S.focusMin,1200)"
  },
  "A016": {
    "path": "focusMin",
    "target": 1800,
    "signature": "gt(S.focusMin,1800)"
  },
  "A017": {
    "path": "focusMin",
    "target": 3000,
    "signature": "gt(S.focusMin,3000)"
  },
  "A018": {
    "path": "focusMin",
    "target": 6000,
    "signature": "gt(S.focusMin,6000)"
  },
  "A019": {
    "path": "focusMin",
    "target": 12000,
    "signature": "gt(S.focusMin,12000)"
  },
  "A020": {
    "path": "focusMin",
    "target": 21900,
    "signature": "gt(S.focusMin,21900)"
  },
  "A021": {
    "path": "catStats.sport.count",
    "target": 1,
    "signature": "S_of(S,SPORT).count>=1"
  },
  "A022": {
    "path": "catStats.sport.count",
    "target": 5,
    "signature": "S_of(S,SPORT).count>=5"
  },
  "A023": {
    "path": "catStats.sport.count",
    "target": 10,
    "signature": "S_of(S,SPORT).count>=10"
  },
  "A024": {
    "path": "catStats.sport.count",
    "target": 25,
    "signature": "S_of(S,SPORT).count>=25"
  },
  "A025": {
    "path": "catStats.sport.count",
    "target": 50,
    "signature": "S_of(S,SPORT).count>=50"
  },
  "A026": {
    "path": "catStats.sport.min",
    "target": 1000,
    "signature": "S_of(S,SPORT).min>=1000"
  },
  "A027": {
    "path": "catStats.sport.min",
    "target": 2500,
    "signature": "S_of(S,SPORT).min>=2500"
  },
  "A028": {
    "path": "catStats.sport.min",
    "target": 5000,
    "signature": "S_of(S,SPORT).min>=5000"
  },
  "A029": {
    "path": "catStats.sport.min",
    "target": 10000,
    "signature": "S_of(S,SPORT).min>=10000"
  },
  "A030": {
    "path": "catStats.sport.days.size",
    "target": 100,
    "signature": "S_of(S,SPORT).days.size>=100"
  },
  "A031": {
    "path": "catStats.cook.count",
    "target": 1,
    "signature": "S_of(S,COOK).count>=1"
  },
  "A032": {
    "path": "catStats.cook.count",
    "target": 3,
    "signature": "S_of(S,COOK).count>=3"
  },
  "A033": {
    "path": "catStats.cook.count",
    "target": 10,
    "signature": "S_of(S,COOK).count>=10"
  },
  "A034": {
    "path": "catStats.cook.count",
    "target": 25,
    "signature": "S_of(S,COOK).count>=25"
  },
  "A035": {
    "path": "catStats.cook.count",
    "target": 50,
    "signature": "S_of(S,COOK).count>=50"
  },
  "A036": {
    "path": "catStats.cook.count",
    "target": 100,
    "signature": "S_of(S,COOK).count>=100"
  },
  "A037": {
    "path": "catStats.cook.days.size",
    "target": 7,
    "signature": "S_of(S,COOK).days.size>=7"
  },
  "A038": {
    "path": "catStats.cook.days.size",
    "target": 30,
    "signature": "S_of(S,COOK).days.size>=30"
  },
  "A039": {
    "path": "catStats.cook.days.size",
    "target": 60,
    "signature": "S_of(S,COOK).days.size>=60"
  },
  "A040": {
    "path": "catStats.cook.days.size",
    "target": 100,
    "signature": "S_of(S,COOK).days.size>=100"
  },
  "A041": {
    "path": "catStats.tidy.count",
    "target": 1,
    "signature": "S_of(S,TIDY).count>=1"
  },
  "A042": {
    "path": "catStats.tidy.count",
    "target": 5,
    "signature": "S_of(S,TIDY).count>=5"
  },
  "A043": {
    "path": "catStats.tidy.count",
    "target": 15,
    "signature": "S_of(S,TIDY).count>=15"
  },
  "A044": {
    "path": "catStats.tidy.count",
    "target": 30,
    "signature": "S_of(S,TIDY).count>=30"
  },
  "A045": {
    "path": "catStats.tidy.count",
    "target": 60,
    "signature": "S_of(S,TIDY).count>=60"
  },
  "A046": {
    "path": "catStats.tidy.count",
    "target": 100,
    "signature": "S_of(S,TIDY).count>=100"
  },
  "A047": {
    "path": "checklistDone",
    "target": 1,
    "signature": "S.checklistDone>=1"
  },
  "A048": {
    "path": "checklistDone",
    "target": 20,
    "signature": "S.checklistDone>=20"
  },
  "A049": {
    "path": "checklistDone",
    "target": 50,
    "signature": "S.checklistDone>=50"
  },
  "A050": {
    "path": "checklistDone",
    "target": 100,
    "signature": "S.checklistDone>=100"
  },
  "A051": {
    "path": "journalDays.size",
    "target": 1,
    "signature": "S.journalDays.size>=1"
  },
  "A052": {
    "path": "journalDays.size",
    "target": 3,
    "signature": "S.journalDays.size>=3"
  },
  "A053": {
    "path": "journalDays.size",
    "target": 7,
    "signature": "S.journalDays.size>=7"
  },
  "A054": {
    "path": "journalDays.size",
    "target": 15,
    "signature": "S.journalDays.size>=15"
  },
  "A055": {
    "path": "journalDays.size",
    "target": 30,
    "signature": "S.journalDays.size>=30"
  },
  "A056": {
    "path": "journalDays.size",
    "target": 60,
    "signature": "S.journalDays.size>=60"
  },
  "A057": {
    "path": "journalDays.size",
    "target": 100,
    "signature": "S.journalDays.size>=100"
  },
  "A058": {
    "path": "journalPhotoCount",
    "target": 50,
    "signature": "S.journalPhotoCount>=50"
  },
  "A059": {
    "path": "monthReviewCount",
    "target": 12,
    "signature": "S.monthReviewCount>=12"
  },
  "A060": {
    "path": "journalDays.size",
    "target": 365,
    "signature": "S.journalDays.size>=365"
  },
  "A061": {
    "path": "goalCreated",
    "target": 1,
    "signature": "S.goalCreated>=1"
  },
  "A062": {
    "path": "milestoneDone",
    "target": 1,
    "signature": "S.milestoneDone>=1"
  },
  "A063": {
    "path": "goalDone",
    "target": 1,
    "signature": "S.goalDone>=1"
  },
  "A064": {
    "path": "goalDone",
    "target": 3,
    "signature": "S.goalDone>=3"
  },
  "A065": {
    "path": "goalDone",
    "target": 5,
    "signature": "S.goalDone>=5"
  },
  "A066": {
    "path": "goalDone",
    "target": 10,
    "signature": "S.goalDone>=10"
  },
  "A067": {
    "path": "goalDone",
    "target": 25,
    "signature": "S.goalDone>=25"
  },
  "A068": {
    "path": "goalDone",
    "target": 50,
    "signature": "S.goalDone>=50"
  },
  "A069": {
    "path": "goalWith5StepsDone",
    "target": 1,
    "signature": "S.goalWith5StepsDone>=1"
  },
  "A070": {
    "path": "milestoneDone",
    "target": 100,
    "signature": "S.milestoneDone>=100"
  },
  "A071": {
    "path": "ledgerDays.size",
    "target": 1,
    "signature": "S.ledgerDays.size>=1"
  },
  "A072": {
    "path": "ledgerDays.size",
    "target": 3,
    "signature": "S.ledgerDays.size>=3"
  },
  "A073": {
    "path": "ledgerDays.size",
    "target": 7,
    "signature": "S.ledgerDays.size>=7"
  },
  "A074": {
    "path": "ledgerDays.size",
    "target": 30,
    "signature": "S.ledgerDays.size>=30"
  },
  "A075": {
    "path": "ledgerDays.size",
    "target": 100,
    "signature": "S.ledgerDays.size>=100"
  },
  "A076": {
    "path": "ledgerCount",
    "target": 300,
    "signature": "S.ledgerCount>=300"
  },
  "A078": {
    "path": "ledgerReviewMonths.size",
    "target": 3,
    "signature": "S.ledgerReviewMonths.size>=3"
  },
  "A079": {
    "path": "ledgerReviewMonths.size",
    "target": 12,
    "signature": "S.ledgerReviewMonths.size>=12"
  },
  "A080": {
    "path": "ledgerCount",
    "target": 1000,
    "signature": "S.ledgerCount>=1000"
  },
  "A085": {
    "path": "petInteractions",
    "target": 10,
    "signature": "S.petInteractions>=10"
  },
  "A086": {
    "path": "petInteractions",
    "target": 50,
    "signature": "S.petInteractions>=50"
  },
  "A087": {
    "path": "petMaxStage",
    "target": 2,
    "signature": "S.petMaxStage>=2"
  },
  "A088": {
    "path": "petMaxStage",
    "target": 3,
    "signature": "S.petMaxStage>=3"
  },
  "A089": {
    "path": "petMaxStage",
    "target": 4,
    "signature": "S.petMaxStage>=4"
  },
  "A090": {
    "path": "petMaxStage",
    "target": 5,
    "signature": "S.petMaxStage>=5"
  },
  "A091": {
    "path": "shopPurchases",
    "target": 1,
    "signature": "S.shopPurchases>=1"
  },
  "A094": {
    "path": "permItems",
    "target": 5,
    "signature": "S.permItems>=5"
  },
  "A095": {
    "path": "permItems",
    "target": 10,
    "signature": "S.permItems>=10"
  },
  "A096": {
    "path": "permItems",
    "target": 20,
    "signature": "S.permItems>=20"
  },
  "A097": {
    "path": "permItems",
    "target": 30,
    "signature": "S.permItems>=30"
  },
  "A098": {
    "path": "permItems",
    "target": 40,
    "signature": "S.permItems>=40"
  },
  "A099": {
    "path": "showcaseCount",
    "target": 10,
    "signature": "S.showcaseCount>=10"
  },
  "A100": {
    "path": "seriesComplete",
    "target": 1,
    "signature": "S.seriesComplete>=1"
  },
  "A101": {
    "path": "months.size",
    "target": 3,
    "signature": "S.months.size>=3"
  },
  "A102": {
    "path": "months.size",
    "target": 6,
    "signature": "S.months.size>=6"
  },
  "A103": {
    "path": "months.size",
    "target": 9,
    "signature": "S.months.size>=9"
  },
  "A104": {
    "path": "months.size",
    "target": 12,
    "signature": "S.months.size>=12"
  },
  "A109": {
    "path": "days.size",
    "target": 100,
    "signature": "S.days.size>=100"
  },
  "A110": {
    "path": "days.size",
    "target": 365,
    "signature": "S.days.size>=365"
  },
  "A111": {
    "path": "cats.size",
    "target": 3,
    "signature": "S.cats.size>=3"
  },
  "A112": {
    "path": "cats.size",
    "target": 5,
    "signature": "S.cats.size>=5"
  },
  "A113": {
    "path": "cats.size",
    "target": 7,
    "signature": "S.cats.size>=7"
  },
  "A114": {
    "path": "cats.size",
    "target": 9,
    "signature": "S.cats.size>=9"
  },
  "A115": {
    "path": "days.size",
    "target": 7,
    "signature": "S.days.size>=7"
  },
  "A116": {
    "path": "days.size",
    "target": 30,
    "signature": "S.days.size>=30"
  },
  "A117": {
    "path": "days.size",
    "target": 100,
    "signature": "S.days.size>=100"
  },
  "A118": {
    "path": "days.size",
    "target": 365,
    "signature": "S.days.size>=365"
  },
  "A119": {
    "path": "badgeCount",
    "target": 30,
    "signature": "S.badgeCount>=30"
  },
  "A120": {
    "path": "badgeCount",
    "target": 60,
    "signature": "S.badgeCount>=60"
  }
};
const PAUSED = new Set(['A092','A093','A094','A095','A096','A097','A098']);
export function badgeProgress(badge, S, earned=false) {
  if (!badge) return {text:'请选择徽章',ratio:null};
  if (earned) return {text:'已获得 · 可以选择下一个目标',ratio:1};
  if (PAUSED.has(badge.id)) return {text:'相关家具／穿戴收藏功能暂缓开放，历史成就保留。',ratio:null};
  const entry=PROGRESS[badge.id];
  const signature=badge.check.toString().split('=>').slice(1).join('=>').replace(/\s/g,'');
  if (entry && signature===entry.signature) {
    const raw=entry.path.split('.').reduce((value,key)=>value?.[key],S);
    const value=Number(raw||0);
    if (Number.isFinite(value)) {
      const unit=entry.path.endsWith('min')||entry.path==='focusMin'?'分钟':entry.path.endsWith('days.size')||entry.path.endsWith('Days.size')?'天':'';
      return {current:value,target:entry.target,ratio:Math.min(1,Math.max(0,value/entry.target)),text:`当前 ${value} / ${entry.target}${unit} · 还差 ${Math.max(0,entry.target-value)}${unit}`};
    }
  }
  let reached=false;try{reached=!!badge.check(S);}catch{}
  return {text:reached?'已达到条件，正在核对成就':'尚未达到条件 · '+badge.cond,ratio:null};
}
export async function setTrackedBadge(id) {
  if (!badgeById(id) || PAUSED.has(id)) throw new Error('该徽章暂不能作为追踪目标');
  await saveKV('badge_tracking',{badgeId:id});
  window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
}
export async function renderTrackedBadge(container) {
  loadRepairStyles();
  const [saved,unlocked,S]=await Promise.all([loadKV('badge_tracking'),all('badges'),computeStats()]);
  const earned=new Set(unlocked.map(r=>r.badgeId));
  const explicit=badgeById(saved.badgeId);
  const badge=explicit||BADGES.find(b=>!earned.has(b.id)&&!PAUSED.has(b.id));
  if(!badge)return;
  const progress=badgeProgress(badge,S,earned.has(badge.id));
  const choose=async()=>{
    const available=BADGES.filter(b=>!earned.has(b.id)&&!PAUSED.has(b.id));
    if(!available.length){toast('当前可追踪徽章都已获得');return;}
    const selected=await formDlg({title:'选择一枚想获得的徽章',fields:[{key:'badgeId',label:'目标徽章',type:'select',value:badge.id,options:available.map(b=>[b.id,`${b.series} · ${b.name}`])}],submitLabel:'追踪这枚徽章'});
    if(selected)await setTrackedBadge(selected.badgeId);
  };
  const card=h('section',{class:'card repair-tracked'},h('div',{class:'card-title'},explicit?'正在追踪':'推荐徽章',h('button',{class:'more',onclick:choose},explicit?'更换目标':'选择目标')),
    h('div',{class:'repair-track-row'},h('img',{src:badgeArt(badge.id),alt:badge.name,style:'width:68px;height:68px;object-fit:contain;flex:none'}),h('div',null,h('b',null,badge.name),h('p',{class:'repair-caption'},badge.cond),h('p',{class:'repair-caption'},progress.text))));
  if(progress.ratio!=null)card.append(h('div',{class:'bar'},h('i',{style:`width:${progress.ratio*100}%`})));
  card.append(h('button',{class:'btn btn-ghost btn-sm',onclick:()=>location.hash='#/home?tab=badges'},'打开徽章收藏册'));
  container.append(card);
}
