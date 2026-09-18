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
function waitForInstall(worker){
  if(!worker||['installed','activated','redundant'].includes(worker.state))return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.removeEventListener('statechange',onState);reject(new Error('新版资源仍在准备，请稍后再检查'));},15000);
    function onState(){if(['installed','activated','redundant'].includes(worker.state)){clearTimeout(timer);worker.removeEventListener('statechange',onState);resolve();}}
    worker.addEventListener('statechange',onState);onState();
  });
}
export async function checkUpdates(){
  if(!supported()){toast('当前环境不支持应用更新',{ic:'error'});return;}
  if(checking)return;checking=true;
  const modal=openModal({title:'检查更新',content:h('p',{role:'status'},'正在向站点检查版本，没有模拟进度。')});
  try{
    const reg=registration || await navigator.serviceWorker.getRegistration(new URL('../../',import.meta.url).href) || await registerUpdates();
    if(!reg)throw new Error('离线缓存尚未初始化，请联网重试');
    await reg.update();await waitForInstall(reg.installing);
    modal.close();
    if(reg.waiting)offerUpdate(reg.waiting,true);
    else toast('检查完成，当前没有等待安装的新版本',{ic:'check'});
  }catch(error){modal.close();toast(error.message||'检查更新失败',{ic:'error',ms:3500});}
  finally{checking=false;}
}
