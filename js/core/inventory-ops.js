// Read, validate and write within ONE IndexedDB transaction, including concurrent tabs.
import { db } from './db.js';
import { uid,todayKey } from './util.js';
export function buyAtomic(item){
  return new Promise((resolve,reject)=>{
    const tx=db().transaction(['points','inventory','events'],'readwrite');let failure=null,result={err:'兑换未完成'};
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('兑换失败，未提交扣款'));tx.onerror=()=>reject(tx.error||new Error('兑换失败'));
    const rows=tx.objectStore('points').getAll();
    rows.onsuccess=()=>{
      const balance=rows.result.reduce((n,r)=>n+Number(r.delta||0),0);
      const inventory=tx.objectStore('inventory'),req=inventory.get(item.id);
      req.onsuccess=()=>{
        try {
        const owned=req.result;
        if(item.type==='perm'&&owned?.qty>0){result={err:'永久物品已拥有，不能重复兑换'};return;}
        if(balance<item.price){result={err:'积分不足'};return;}
        const now=Date.now(),row={id:uid('pt'),dedupe:uid('buy'),ts:now,dateKey:todayKey(),delta:-item.price,reason:`兑换「${item.name}」`,kind:'purchase',cls:'purchase',sourceEventId:null};
        const inv={...(owned||{itemId:item.id,firstAt:now}),qty:(owned?.qty||0)+1,lastAt:now};
        tx.objectStore('points').put(row);inventory.put(inv);
        tx.objectStore('events').put({id:uid('ev'),ts:now,dateKey:todayKey(),kind:'purchase',refId:item.id,meta:{name:item.name}});
        result={ok:true,item,inv,balance:balance-item.price};
        } catch(error) {failure=error;tx.abort();}
      };
    };
  });
}
export function consumeAtomic(itemId,petEvent=null){
  return new Promise((resolve,reject)=>{
    const stores=petEvent?['inventory','events']:['inventory'];const tx=db().transaction(stores,'readwrite');let used=false,failure=null;
    tx.oncomplete=()=>resolve(used);tx.onabort=()=>reject(failure||tx.error||new Error('道具使用失败'));tx.onerror=()=>reject(tx.error||new Error('道具使用失败'));
    const st=tx.objectStore('inventory'),req=st.get(itemId);
    req.onsuccess=()=>{
      try {
      const row=req.result;if(!row||row.qty<=0)return;
      if(row.qty===1)st.delete(itemId);else st.put({...row,qty:row.qty-1});
      if(petEvent)tx.objectStore('events').put(petEvent);used=true;
      } catch(error){failure=error;tx.abort();}
    };
  });
}
