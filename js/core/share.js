// 预览与导出共用同一 Canvas，避免 foreignObject/外部样式造成假成功或画布污染。
import { h, todayKey } from './util.js';
import { openModal, toast } from './fx.js';
import { loadPeriodSummary, isDateKey } from './record-summary.js';
import { drawShareCanvas, canvasBlob } from './share-renderer.js';

export async function openSharePanel({type='day',dateKey=todayKey()}={}) {
  let period = ['day','week','month'].includes(type) ? type : 'day';
  let anchor = isDateKey(dateKey) ? dateKey : todayKey(), template='journal', ratio='long';
  let renderID=0, currentCanvas=null, closed=false, rendering=Promise.resolve(), note='';
  const selected={tasks:false,focus:true,badges:true,pet:true};
  const preview=h('div',{class:'repair-share-preview'});
  const status=h('div',{class:'form-hint',role:'status','aria-live':'polite'});
  const exportBtn=h('button',{class:'btn btn-primary btn-block',disabled:true},'生成分享卡');
  const panel=h('div',{class:'repair-share-panel'});
  function selection(options,get,set) {
    const group=h('div',{class:'repair-seg'});
    for (const [id,label] of options) group.append(h('button',{class:get()===id?'on':'',onclick:() => {
      set(id); [...group.children].forEach((b,i) => b.classList.toggle('on',options[i][0]===get())); refresh();
    }},label));
    return group;
  }
  panel.append(selection([['journal','生活手账'],['achievement','伙伴成就卡']],()=>template,v=>template=v));
  panel.append(selection([['day','日分享'],['week','周分享'],['month','月分享']],()=>period,v=>period=v));
  const date=h('input',{class:'input',type:'date',value:anchor,max:todayKey(),'aria-label':'分享日期',onchange:e=>{
    if (isDateKey(e.target.value)) {anchor=e.target.value;refresh();}
  }});
  panel.append(date,selection([['long','长图'],['4x3','4:3']],()=>ratio,v=>ratio=v));
  const controls=h('div',{class:'repair-share-controls'});
  for (const [id,label] of [['tasks','展示事项名称（可能包含隐私）'],['focus','专注时间'],['badges','新徽章'],['pet','宠物元素']]) {
    controls.append(h('label',null,h('input',{type:'checkbox',checked:selected[id],onchange:e=>{selected[id]=e.target.checked;refresh();}}),label));
  }
  panel.append(controls,h('textarea',{class:'input repair-share-note',rows:2,maxlength:120,placeholder:'写一句自己的感受（可选，120字内）',
    oninput:e=>{note=e.target.value;refresh();}}),h('div',{class:'form-hint'},'按所选日期汇总；周从周一开始。默认不展示事项名称、日记正文、账目金额或个人账户名。'),status,preview,exportBtn);
  function refresh() {
    const id=++renderID;
    exportBtn.disabled=true; exportBtn.textContent='生成分享卡'; currentCanvas=null; status.textContent='正在生成预览…'; preview.setAttribute('aria-busy','true');
    const state={period,anchor,template,ratio,note,selected:{...selected}};
    rendering=(async()=>{
      try {
        const data=await loadPeriodSummary(state.period,state.anchor);
        const canvas=await drawShareCanvas(data,{template:state.template,ratio:state.ratio,note:state.note,...state.selected});
        if (closed||id!==renderID) return;
        currentCanvas=canvas; preview.replaceChildren(canvas); exportBtn.disabled=false;
        status.textContent=`${data.range.start} 至 ${data.range.end} · ${data.validCount}条有效记录 · ${data.recordDays}个记录日`;
      } catch(e) {
        if (closed||id!==renderID) return;
        preview.replaceChildren();status.textContent='预览失败：'+(e.message||'请重试');
        preview.append(h('button',{class:'btn btn-soft',onclick:refresh},'重试预览'));
      } finally {if(id===renderID)preview.setAttribute('aria-busy','false');}
    })();
    return rendering;
  }
  exportBtn.addEventListener('click',async()=>{
    if(exportBtn.disabled||!currentCanvas)return;
    exportBtn.disabled=true;exportBtn.textContent='正在生成…';
    const captured=currentCanvas, id=renderID, filename=`今天没白过-${period}-${anchor}-${template}.png`;
    try {
      const blob=await canvasBlob(captured);
      if(closed||id!==renderID)return;
      const url=URL.createObjectURL(blob),a=h('a',{href:url,download:filename});
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast('PNG 已生成，已请求浏览器保存',{ic:'download'});
    } catch(e) {toast('导出失败：'+(e.message||'请重试'),{ic:'error'});}
    finally {if(!closed&&id===renderID){exportBtn.disabled=!currentCanvas;exportBtn.textContent='生成分享卡';}}
  });
  openModal({title:'生成生活分享卡',content:panel,onClose:()=>{closed=true;renderID++;currentCanvas=null;},actions:[{label:'关闭',onClick:c=>c()}]});
  refresh();
}
