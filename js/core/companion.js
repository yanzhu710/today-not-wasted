// 轻量陪伴：来自真实事件的反馈与记忆，不产生积分，不新增虚构记录。
import { all } from './db.js';
import { isValidRecord } from './record-summary.js';
import { h } from './util.js';
import { catName } from './catalog.js';
import { toast } from './fx.js';
export function companionResponse(e) {
  if(!e)return '今天从一件小事开始就好。';
  if(e.kind==='journal')return '你刚留下一页手账，这段心情有地方安放了。';
  if(e.kind==='ledger')return '这笔账已经记好，生活又清楚了一点。';
  return {study:'你刚记下一段学习阅读，给这点积累留个位置。',sport:'这段运动散步已经收好，脚步也有了记录。',
    cook:'你刚记录了做饭饮食，今天的烟火气留下了。',tidy:'这次整理已经记下，小小的改变也算数。'}[e.category] || '这件小事已经收好，今天又多了一点生活痕迹。';
}
export async function showLatestResponse() {
  const recent=(await all('events')).filter(isValidRecord).sort((a,b)=>b.ts-a.ts)[0];
  const text=companionResponse(recent);toast(text,{ic:'heart',ms:2600});
  document.querySelectorAll('[data-companion-message]').forEach(el=>{el.textContent=text;});
}
export async function memoriesCard(pet) {
  const evs=(await all('events')).filter(e=>isValidRecord(e)&&(!pet?.ownedAt||e.ts>=pet.ownedAt)).sort((a,b)=>a.ts-b.ts);
  const selected=[],seen=new Set();
  for(const e of evs){const key=e.kind==='journal'?'journal':e.category||e.kind;if(seen.has(key))continue;seen.add(key);selected.push(e);if(selected.length===6)break;}
  const card=h('div',{class:'card repair-memories'},h('div',{class:'card-title'},'一起留下的生活记忆'));
  if(!selected.length){const {petEmptyState}=await import('../ui/empty.js');card.append(await petEmptyState('memory',{compact:true}));}
  for(const e of selected)card.append(h('div',{class:'row-item'},h('div',{class:'row-main'},
    h('div',{class:'row-title'},e.kind==='journal'?'第一次留下手账':`第一段${catName(e.category)}记录`),
    h('div',{class:'row-sub'},e.dateKey+' · '+companionResponse(e)))));
  card.append(h('div',{class:'form-hint'},'这些回忆来自你真实留下的生活记录。'));
  return card;
}
