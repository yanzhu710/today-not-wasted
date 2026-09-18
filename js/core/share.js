// One Canvas renderer drives both preview and download. No foreignObject, CDN, or fake-success fallback.
import { h,todayKey } from './util.js';
import { loadPeriodStats,loadRepairStyles,isDateKey } from './analytics.js';
import { openModal,toast } from './fx.js';
import { catName } from './catalog.js';

export const SHARE_RATIOS={long:{w:750,h:1334,name:'长图'},'4x3':{w:800,h:600,name:'4:3'}};
const TEMPLATES=[['journal','生活手账'],['achievement','伙伴成就卡']];
const assetCache=new Map();
function loadImage(url){
  if(assetCache.has(url))return assetCache.get(url);
  const promise=new Promise((resolve,reject)=>{
    const img=new Image();img.crossOrigin='anonymous';
    const timer=setTimeout(()=>reject(new Error('素材加载超时，请联网重试或取消该素材')),10000);
    img.onload=()=>{clearTimeout(timer);resolve(img);};
    img.onerror=()=>{clearTimeout(timer);reject(new Error('分享素材加载失败，请联网重试或取消宠物/徽章图片'));};
    img.src=url;
  });assetCache.set(url,promise);promise.catch(()=>assetCache.delete(url));return promise;
}
function rounded(c,x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill();}
function text(c,value,x,y,size=24,color='#36473B',weight='normal'){
  c.fillStyle=color;c.font=`${weight} ${size}px system-ui,"Noto Sans CJK SC","Microsoft YaHei",sans-serif`;c.fillText(String(value),x,y);
}
function lines(c,value,width,size,max=2){
  c.font=`${size}px system-ui,"Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
  let result=[],line='';const chars=Array.from(String(value||'').replace(/\s+/g,' '));
  for(let i=0;i<chars.length;i++){
    const char=chars[i];
    if(c.measureText(line+char).width>width&&line){result.push(line);line='';if(result.length===max){let last=result[max-1];while(last&&c.measureText(last+'…').width>width)last=last.slice(0,-1);result[max-1]=last+'…';return result;}}
    line+=char;
  }
  if(line)result.push(line);return result;
}
function fit(c,img,x,y,w,h){const r=Math.min(w/img.naturalWidth,h/img.naturalHeight),iw=img.naturalWidth*r,ih=img.naturalHeight*r;c.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
export async function renderShareCanvas(data,options={}){
  const opts={template:'journal',ratio:'long',items:false,focus:true,badges:true,pet:true,note:'',...options};
  if(!SHARE_RATIOS[opts.ratio])throw new Error('未知图片比例');
  const {w,h:height}=SHARE_RATIOS[opts.ratio];const compact=opts.ratio!=='long';
  const pet=opts.pet&&data.activePet&&data.petDef?await loadImage(new URL(`../../assets/pets/${data.petDef.petId}.png`,import.meta.url).href):null;
  const badgeRows=opts.badges?data.badges.slice(0,compact?3:5):[];
  const badgeImages=await Promise.all(badgeRows.map(b=>loadImage(new URL(`../../assets/badges/${b.id}.png`,import.meta.url).href)));
  if(document.fonts?.ready)await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=height*2;
  const c=canvas.getContext('2d');if(!c)throw new Error('浏览器不支持图片生成');c.scale(2,2);
  const journal=opts.template==='journal';
  c.fillStyle=journal?'#FFFBF0':'#F1F4ED';c.fillRect(0,0,w,height);
  if(journal){c.strokeStyle='#E6DFC8';c.lineWidth=1;for(let y=40;y<height;y+=34){c.beginPath();c.moveTo(32,y);c.lineTo(w-32,y);c.stroke();}}
  rounded(c,30,30,w-60,height-60,28,journal?'rgba(255,253,245,.7)':'#FFFDF7');
  rounded(c,42,42,150,34,17,'#DEE8D7');text(c,'今天没白过',57,66,19,'#4D6856','bold');
  text(c,({day:'这一天的小成就',week:'这一周的小成就',month:'这个月的小成就'}[data.range.type]),46,compact?111:132,compact?32:38,'#344B3A','bold');
  text(c,data.range.label,46,compact?143:171,compact?18:22,'#697766');
  const note=opts.note.trim()||(data.eventCount?`留下 ${data.eventCount} 条记录，让普通日子有迹可循。`:'空白也值得被温柔地保留。');
  const noteLines=lines(c,note,w-(compact?250:96),compact?19:25,2);
  noteLines.forEach((s,i)=>text(c,s,46,(compact?178:224)+i*(compact?26:34),compact?19:25,'#73816D'));
  if(pet){
    if(compact)fit(c,pet,w-198,91,150,153);
    else{fit(c,pet,journal?w-310:(w-240)/2,journal?250:276,240,246);c.textAlign='center';text(c,data.activePet.name||data.petDef.name,journal?w-190:w/2,548,23,'#4F6857','bold');c.textAlign='left';}
  }
  const metrics=[['记录日',data.recordDays+'天'],['完成事项',String(data.completedCount)]];
  if(opts.focus)metrics.push(['有效专注',Math.round(data.focusMin*10)/10+'分']);
  if(opts.badges)metrics.push(['新徽章',String(data.badgeCount)]);
  const metricsY=compact?238:(pet?596:330), availableW=w-92, gap=10, cellW=(availableW-gap*(metrics.length-1))/metrics.length;
  metrics.forEach(([label,value],i)=>{
    const x=46+i*(cellW+gap);rounded(c,x,metricsY,cellW,compact?77:112,16,i%2?'#F8EBD9':'#EAF0E3');
    text(c,value,x+12,metricsY+(compact?32:48),compact?25:31,'#4B6451','bold');text(c,label,x+12,metricsY+(compact?60:83),compact?16:20,'#78806D');
  });
  let y=metricsY+(compact?110:172);
  if(opts.items&&data.completedItems.length){
    text(c,'我想留下的几件事',46,y,compact?21:25,'#4D6652','bold');y+=compact?31:42;
    const limit=compact?2:5, maxWidth=compact?w-330:w-108, fontSize=compact?18:24;
    const bottom=compact?height-142:(badgeImages.length?height-280:height-156);
    let shown=0;
    for(const item of data.completedItems.slice(0,limit)) {
      const wrapped=lines(c,`· ${item.title}`,maxWidth,fontSize,compact?1:2);
      const lineHeight=compact?27:34;
      if(y+wrapped.length*lineHeight>bottom)break;
      for(const line of wrapped){text(c,line,50,y,fontSize);y+=lineHeight;}
      shown++;
    }
    if(data.completedItems.length>shown)text(c,`另有 ${data.completedItems.length-shown} 件，完整记录留在应用里。`,50,y+7,compact?15:18,'#78806D');

  }else{
    text(c,data.eventCount?'把普通日子，收进生活的收藏册。':'今天从一件小事开始就好。',46,y,compact?20:26,'#687B64');
    text(c,'不必展示全部，记录本身就有意义。',46,y+(compact?30:42),compact?16:22,'#919985');
  }
  if(badgeImages.length){
    const by=compact?360:height-230, size=compact?65:82;
    const bx=compact?w-260:46;
    text(c,`新收藏 ${data.badgeCount} 枚`,bx,by-12,compact?17:22,'#73816D','bold');
    badgeImages.forEach((img,i)=>fit(c,img,bx+i*(size+8),by,size,size));
  }
  const footer=height-67;c.strokeStyle='#DBDCCB';c.beginPath();c.moveTo(46,footer-27);c.lineTo(w-46,footer-27);c.stroke();
  text(c,opts.pet&&data.activePet?`与 ${data.activePet.name||data.petDef?.name||'伙伴'} 一起留下的时光`:'生活成就手账',46,footer,compact?16:21,'#74826D');
  canvas.setAttribute('aria-label',`${data.range.label} 分享卡：${data.completedCount}件事项，${data.recordDays}个记录日`);
  canvas.style.cssText='display:block;width:100%;height:auto;max-width:100%;border-radius:14px';
  return canvas;
}
export function canvasPNG(canvas){
  return new Promise((resolve,reject)=>{
    try{canvas.toBlob(blob=>blob&&blob.size?resolve(blob):reject(new Error('图片生成失败，请重试')),'image/png');}
    catch(error){reject(new Error('图片无法导出：'+error.message));}
  });
}
export function downloadPNG(blob,name){
  const url=URL.createObjectURL(blob),a=h('a',{href:url,download:name,style:'display:none'});
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function openSharePanel({type='day',dateKey:anchor=todayKey()}={}){
  loadRepairStyles();if(!isDateKey(anchor))anchor=todayKey();
  const state={type:['day','week','month'].includes(type)?type:'day',anchor,template:'journal',ratio:'long',items:false,focus:true,badges:true,pet:true,note:''};
  let sequence=0,readyCanvas=null,readyData=null,closed=false,exporting=false,timer;
  const panel=h('div',{class:'repair-share'}),preview=h('div',{class:'repair-share-preview'}),status=h('p',{class:'repair-caption',role:'status','aria-live':'polite'});
  const exportButton=h('button',{class:'btn btn-primary btn-block',disabled:true,onclick:async()=>{
    if(!readyCanvas||exporting)return;exporting=true;exportButton.disabled=true;
    try{
      const exportCanvas=readyCanvas, data=readyData;
      const blob=await canvasPNG(exportCanvas);
      downloadPNG(blob,`今天没白过_${data.range.type}_${data.range.start}_${data.range.end}.png`);
      status.textContent='PNG 已生成。若浏览器没有自动保存，请点击下方图片链接；打开后可长按保存。';
      const previousLink=panel.querySelector('.repair-save-link');if(previousLink)previousLink.remove();
      const blobURL=URL.createObjectURL(blob);
      const link=h('a',{class:'btn btn-soft repair-save-link',href:blobURL,target:'_blank',rel:'noopener',style:'text-align:center'},'打开生成的 PNG 图片');
      panel.append(link);setTimeout(()=>URL.revokeObjectURL(blobURL),120000);
    }catch(error){status.textContent=error.message;toast(error.message,{ic:'error'});}
    finally{exporting=false;if(!closed)exportButton.disabled=!readyCanvas;}
  }},'保存 PNG 图片');
  function group(values,key){const row=h('div',{class:'seg'},values.map(([value,label])=>h('button',{class:state[key]===value?'on':'',onclick:(e)=>{if(exporting)return;state[key]=value;[...row.children].forEach(b=>b.classList.toggle('on',b===e.currentTarget));refresh();}},label)));return row;}
  const dateInput=h('input',{type:'date',class:'input',value:anchor,'aria-label':'分享日期',onchange:()=>{if(exporting)return;if(isDateKey(dateInput.value)){state.anchor=dateInput.value;refresh();}}});
  const checks=h('div',{class:'repair-share-checks'},[['items','展示事项标题（可能涉及隐私）'],['focus','专注时间'],['badges','新徽章'],['pet','宠物元素']].map(([key,label])=>h('label',null,h('input',{type:'checkbox',checked:state[key],onchange:e=>{state[key]=e.target.checked;refresh();}}),label)));
  const note=h('input',{class:'input',placeholder:'写一句感受（可选，80字内）',maxlength:80,oninput:e=>{state.note=e.target.value;sequence++;readyCanvas=null;exportButton.disabled=true;clearTimeout(timer);timer=setTimeout(refresh,120);}});
  panel.append(h('h3',null,'选择模板'),group(TEMPLATES,'template'),group([['day','日分享'],['week','周分享'],['month','月分享']],'type'),dateInput,group([['long','长图'],['4x3','4:3']],'ratio'),checks,note,status,preview,exportButton,h('p',{class:'repair-caption'},'默认不展示事项标题、手账正文、照片和账目金额；你输入的一句话会出现在图片中。'));
  async function refresh(){
    const ticket=++sequence;readyCanvas=null;exportButton.disabled=true;status.textContent='正在准备预览…';
    const snapshot={...state};
    try{
      const data=await loadPeriodStats(snapshot.type,snapshot.anchor);
      const canvas=await renderShareCanvas(data,snapshot);
      if(closed||ticket!==sequence)return;
      preview.replaceChildren(canvas);readyCanvas=canvas;readyData=data;status.textContent=`${data.range.label} · ${data.eventCount} 条生活记录`;exportButton.disabled=false;
    }catch(error){if(closed||ticket!==sequence)return;preview.replaceChildren();status.textContent=error.message;preview.append(h('button',{class:'btn btn-soft',onclick:refresh},'重试预览'));}
  }
  openModal({title:'分享生活记录',content:panel,actions:[{label:'关闭',onClick:c=>c()}],onClose:()=>{closed=true;sequence++;clearTimeout(timer);}});
  await refresh();
}
