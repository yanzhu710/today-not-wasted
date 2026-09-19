import { all, loadKV } from '../core/db.js';
import { h, icon } from '../core/util.js';

const lines = {
  tasks: ['今天先留一点空白。', '想做什么时，我陪你一起开始。'],
  tasksUpcoming: ['接下来还没有安排。', '有想做的事，再慢慢放进来就好。'],
  habits: ['还没有需要打卡的习惯。', '从一件很小的事开始，也会慢慢长成日常。'],
  goals: ['还没有正在追的目标。', '先写下一个真正想做到的事吧。'],
  wishes: ['愿望这里还空着。', '不用着急，想到的时候再告诉我。'],
  records: ['这里还没有记录。', '先留下一件今天真实发生的小事吧。'],
  journal: ['今天还没有写下心情。', '一句话也好，我会陪你把它收好。'],
  badges: ['第一枚徽章还在路上。', '继续认真生活，它会自己来到你身边。'],
  bag: ['小背包现在还是空的。', '去商城挑一点喜欢的小东西吧。'],
  bagConsumable: ['这里还没有小道具。', '以后得到的食物和玩具会放在这里。'],
  bagPermanent: ['还没有收藏物品。', '喜欢的东西，会慢慢把这里填满。'],
  rewards: ['这里还没有自定义奖励。', '给努力生活的自己留一个小期待吧。'],
  memory: ['我们的回忆还在开头。', '留下一条真实记录，以后这里会慢慢变丰富。'],
  inspiration: ['收藏夹现在很轻。', '遇到喜欢的生活灵感，再把它留下来。'],
  generic: ['这里现在刚好是空的。', '慢慢来，新的内容会一点点长出来。'],
};

export async function petEmptyState(kind='generic', {actionLabel='', onAction=null, compact=false}={}) {
  const [pets, meta] = await Promise.all([all('pets').catch(()=>[]), loadKV('app_meta').catch(()=>({}))]);
  const active = pets.find(p=>p.petId===meta.activePet) || pets[0] || null;
  const copy = lines[kind] || lines.generic;
  const box = h('div',{class:'pet-empty-state pet-empty-blend'+(compact?' compact':'')},
    h('div',{class:'pet-empty-copy'},h('b',null,copy[0]),h('span',null,copy[1])));
  if(active){
    try { const {petFigure}=await import('./paper.js'); box.append(h('div',{class:'pet-empty-figure'},petFigure(active))); }
    catch {}
  } else box.append(h('span',{class:'pet-empty-fallback','aria-hidden':'true'},icon('pet')));
  if(actionLabel&&onAction) box.append(h('button',{class:'btn btn-soft btn-sm pet-empty-action',onclick:onAction},actionLabel,icon('right')));
  return box;
}
