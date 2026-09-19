// Explicit, user-confirmed updates. Never auto-reload while someone is editing.
import { h } from './util.js';
import { openModal, toast } from './fx.js';
let registration=null,offeredWorker=null,checking=false;
function supported(){return 'serviceWorker' in navigator && (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname));}
export async function registerUpdates(){
  if(!supported())return null;
  try {
    registration=await navigator.serviceWorker.register(new URL('../../sw.js',import.meta.url),{updateViaCache:'none'});
    const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed' && navigator.serviceWorker.controller)offerUpdate(worker);});};
    registration.addEventListener('updatefound',()=>watch(registration.installing));
    watch(registration.installing);
    if(registration.waiting&&navigator.serviceWorker.controller)offerUpdate(registration.waiting);
    return registration;
  } catch(error){console.warn('离线缓存注册未成功',error);return null;}
}
function offerUpdate(worker,manual=false){
  if(!worker || (!manual&&worker===offeredWorker))return;
  // Don't cover a form with another blocking prompt. The user can check again in settings.
  if(!manual&&document.querySelector('.modal-back.show')){toast('新版本已就绪，可在“我的”检查更新。',{ms:3000});return;}
  offeredWorker=worker;
  openModal({title:'新版本已就绪',content:h('p',null,'更新会重新载入页面。请先保存正在填写的内容；已保存的本机记录不会被清空。'),actions:[
    {label:'稍后',onClick:close=>close()},
    {label:'已保存，立即更新',cls:'btn-primary',onClick:async close=>{
      close();
      await new Promise((resolve,reject)=>{
        const change=()=>{clearTimeout(timer);resolve();location.reload();};
        const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',change);reject(new Error('更新尚未完成，未强制刷新。请稍后重试。'));},15000);
        navigator.serviceWorker.addEventListener('controllerchange',change,{once:true});
        try{worker.postMessage({type:'SKIP_WAITING'});}catch(error){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',change);reject(error);}
      });
    }},
  ]});
}
function waitForInstall(worker,onProgress=()=>{}){
  if(!worker){onProgress(90,'没有需要安装的新文件');return Promise.resolve();}
  if(['installed','activated'].includes(worker.state)){onProgress(95,'新版资源已经准备好');return Promise.resolve();}
  if(worker.state==='redundant')return Promise.reject(new Error('新版安装已被浏览器取消，请稍后重试'));
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.removeEventListener('statechange',onState);reject(new Error('新版资源仍在准备，请稍后再检查'));},20000);
    function onState(){
      const map={installing:[62,'正在下载并校验新版资源'],installed:[95,'新版资源已经准备好'],activating:[97,'正在切换新版'],activated:[100,'更新完成'],redundant:[0,'新版安装被取消']};
      const row=map[worker.state];if(row)onProgress(row[0],row[1]);
      if(['installed','activated'].includes(worker.state)){clearTimeout(timer);worker.removeEventListener('statechange',onState);resolve();}
      if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',onState);reject(new Error('新版安装已被浏览器取消，请稍后重试'));}
    }
    worker.addEventListener('statechange',onState);onState();
  });
}

export async function checkUpdates(){
  if(!supported()){toast('当前环境不支持应用更新',{ic:'error'});return;}
  if(checking)return;checking=true;
  const label=h('div',{class:'update-progress-label',role:'status','aria-live':'polite'},'正在准备检查…');
  const value=h('span',{class:'update-progress-value'},'0%');
  const fill=h('i',{class:'update-progress-fill',style:'width:0%'});
  const bar=h('div',{class:'update-progress-track',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':'0'},fill);
  const setProgress=(n,text)=>{const v=Math.max(0,Math.min(100,Math.round(n)));fill.style.width=v+'%';value.textContent=v+'%';bar.setAttribute('aria-valuenow',String(v));if(text)label.textContent=text;};
  const modal=openModal({title:'检查更新',content:h('div',{class:'update-progress-card'},h('div',{class:'update-progress-head'},label,value),bar,h('p',{class:'form-hint'},'会依次检查版本、准备资源并确认更新状态。')),actions:[]});
  try{
    setProgress(12,'正在定位本应用的更新服务…');
    const reg=registration || await navigator.serviceWorker.getRegistration(new URL('../../',import.meta.url).href) || await registerUpdates();
    if(!reg)throw new Error('离线缓存尚未初始化，请联网重试');
    setProgress(30,'正在向站点请求最新版本…');
    await reg.update();
    setProgress(reg.installing?52:78,reg.installing?'发现新版，正在准备资源…':'版本检查完成，正在确认状态…');
    await waitForInstall(reg.installing,(n,text)=>setProgress(n,text));
    if(reg.waiting){setProgress(100,'新版已经准备好');await new Promise(r=>setTimeout(r,180));modal.close();offerUpdate(reg.waiting,true);}
    else {setProgress(100,'已经是最新版本');await new Promise(r=>setTimeout(r,320));modal.close();toast('检查完成，当前没有等待安装的新版本',{ic:'check'});}
  }catch(error){modal.close();toast(error.message||'检查更新失败',{ic:'error',ms:3500});}
  finally{checking=false;}
}
