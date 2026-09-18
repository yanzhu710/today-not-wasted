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

// Custom real-life rewards use the same all-or-nothing rule as shop purchases.
// The reward row is the idempotency guard, so rapid taps / multiple tabs cannot
// charge twice for the same redemption.
export function redeemCustomRewardAtomic(rewardId){
  return new Promise((resolve,reject)=>{
    const tx=db().transaction(['points','custom_rewards','events'],'readwrite');
    let failure=null,result={err:'奖励兑换未完成'};
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failure||tx.error||new Error('奖励兑换失败，积分未扣除'));
    tx.onerror=()=>reject(tx.error||new Error('奖励兑换失败'));
    const pointsReq=tx.objectStore('points').getAll();
    pointsReq.onsuccess=()=>{
      const bal=pointsReq.result.reduce((n,r)=>n+Number(r.delta||0),0);
      const rewards=tx.objectStore('custom_rewards');
      const req=rewards.get(rewardId);
      req.onsuccess=()=>{
        try {
          const reward=req.result;
          if(!reward){result={err:'这条奖励不存在或已经被删除'};return;}
          if(reward.redeemedAt||reward.fulfilledAt||reward.doneAt){result={err:'这条奖励已经兑换过了'};return;}
          const cost=Math.max(0,Number(reward.cost)||0);
          if(bal<cost){result={err:'积分还不够'};return;}
          const now=Date.now();
          if(cost>0){
            tx.objectStore('points').put({
              id:uid('pt'),dedupe:`custom:${reward.id}:redeem`,ts:now,dateKey:todayKey(),
              delta:-cost,reason:`兑换现实奖励「${reward.title}」`,kind:'purchase',cls:'purchase',sourceEventId:null,
            });
          }
          const next={...reward,redeemedAt:now};
          rewards.put(next);
          tx.objectStore('events').put({
            id:uid('ev'),ts:now,dateKey:todayKey(),kind:'purchase',refId:reward.id,
            meta:{name:reward.title,customReward:true,cost},
          });
          result={ok:true,reward:next,balance:bal-cost,cost};
        } catch(error){failure=error;tx.abort();}
      };
    };
  });
}
