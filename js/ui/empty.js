import { all, loadKV } from '../core/db.js';
import { PETS } from '../core/catalog.js';
import { h, icon } from '../core/util.js';

const lines = {
  tasks: ['今天还没有待办。', '留一点空白也很好，想做什么时我陪你一起开始。'],
  habits: ['今天还没有习惯。', '从一件很小的事开始，就已经很棒了。'],
  records: ['这里还没有记录。', '先留下一件今天真实发生的小事吧。'],
  badges: ['第一枚徽章还在路上。', '继续认真生活，它会自己来到你身边。'],
  bag: ['小背包现在还是空的。', '去商城挑一点喜欢的小东西吧。'],
  rewards: ['这里还没有自定义奖励。', '给努力生活的自己留一个小期待吧。'],
  generic: ['这里暂时是空的。', '慢慢来，新的内容会一点点长出来。'],
};

export async function petEmptyState(kind='generic', {actionLabel='', onAction=null, compact=false}={}) {
  const [pets, meta] = await Promise.all([all('pets').catch(()=>[]), loadKV('app_meta').catch(()=>({}))]);
  const active = pets.find(p=>p.petId===meta.activePet) || pets[0] || null;
  const copy = lines[kind] || lines.generic;
  const box = h('div',{class:'pet-empty-state'+(compact?' compact':'')},
    h('div',{class:'pet-empty-copy'},h('b',null,copy[0]),h('span',null,copy[1])));
  if(active){
    try { const {petFigure}=await import('./paper.js'); box.append(h('div',{class:'pet-empty-figure'},petFigure(active))); }
    catch {}
  } else box.append(h('span',{class:'pet-empty-fallback','aria-hidden':'true'},icon('pet')));
  if(actionLabel&&onAction) box.append(h('button',{class:'btn btn-soft btn-sm pet-empty-action',onclick:onAction},actionLabel,icon('right')));
  return box;
}
