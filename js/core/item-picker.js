// A choice is not a use: consume stock and append the pet event only after confirmation.
import { all } from './db.js';
import { shopById } from './catalog.js';
import { usePetItem } from './engine.js';
import { h } from './util.js';
import { openModal, toast } from './fx.js';
import { shopArt } from './art.js';
import { loadRepairStyles } from './analytics.js';

export async function choosePetItem(category) {
  loadRepairStyles();
  if (!['food','toy'].includes(category)) return null;
  const rows = (await all('inventory')).filter(row => row.qty > 0 && shopById(row.itemId)?.cat === category);
  if (!rows.length) { toast(category === 'food' ? '背包没有食物，可以去商城兑换。' : '背包没有玩具，可以去商城兑换。', { ic:'shop' }); return null; }
  return new Promise(resolve => {
    let settled = false, pending = false;
    const finish = result => { if (!settled) { settled=true; resolve(result); } };
    const content=h('div',{class:'repair-item-list'});
    const controls=[];
    for (const row of rows) {
      const item=shopById(row.itemId);
      const control=h('button',{class:'repair-item-choice',onclick:async()=>{
        if(pending||settled)return;
        pending=true; controls.forEach(b=>b.disabled=true);
        try {
          const result=await usePetItem(item.id);
          if(result.err) { toast(result.err,{ic:'error'}); return; }
          finish(result); modal.close();
        } finally { pending=false; controls.forEach(b=>b.disabled=false); }
      }},h('img',{src:shopArt(item.id),alt:'',style:'width:58px;height:58px;object-fit:contain'}),h('span',null,item.name),h('small',null,item.type==='consumable'?`剩余 ${row.qty} · 使用1份`:'永久玩具 · 不消耗'));
      controls.push(control);content.append(control);
    }
    // Once an item action starts, don't allow cancellation to race the atomic commit.
    const modal=openModal({title:category==='food'?'选择要喂的食物':'选择玩具',content,onClose:()=>finish(null),canClose:()=>!pending});
  });
}
