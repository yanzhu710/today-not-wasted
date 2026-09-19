import { stageOf } from './catalog.js';
import { badgeArt } from './art.js';
const RATIOS={long:[750,1334],'4x3':[800,600]};
const font='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const images=new Map();
function loadImage(src) {
  const url=new URL(src,document.baseURI);
  if(url.origin!==location.origin && !['data:','blob:'].includes(url.protocol)) return Promise.reject(new Error('分享图片必须来自本站'));
  if(images.has(url.href))return images.get(url.href);
  const p=new Promise((resolve,reject)=>{
    const im=new Image(); let timer;
    const clear=()=>clearTimeout(timer);
    im.onload=()=>{clear();resolve(im);};im.onerror=()=>{clear();reject(new Error('素材加载失败，请联网后重试，或取消相应展示项'));};
    timer=setTimeout(()=>{im.onload=null;im.onerror=null;reject(new Error('素材加载超时，请重试'));},12000);
    im.src=url.href;
  });
  images.set(url.href,p);p.catch(()=>images.delete(url.href));return p;
}
function round(c,x,y,w,h,r,fill) {
  c.fillStyle=fill;c.beginPath();
  c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fill();
}
function label(c,text,x,y,size=20,color='#414D42',weight=400) {c.font=`${weight} ${size}px ${font}`;c.fillStyle=color;c.fillText(String(text),x,y);}
function wrap(c,text,maxWidth) {
  const lines=[];let line='';
  for(const char of String(text)) {
    if(char==='\n'){lines.push(line);line='';continue;}
    if(line && c.measureText(line+char).width>maxWidth){lines.push(line);line=char;}else line+=char;
  }
  if(line)lines.push(line);return lines;
}
function paragraph(c,text,x,y,width,size=20,maxLines=2,color='#414D42',weight=400) {
  c.font=`${weight} ${size}px ${font}`;let lines=wrap(c,text,width);
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines.at(-1);while(last&&c.measureText(last+'…').width>width)last=last.slice(0,-1);lines[lines.length-1]=last+'…';}
  lines.forEach((s,i)=>label(c,s,x,y+i*size*1.55,size,color,weight));
  return lines.length*size*1.55;
}
function contained(c,img,x,y,w,h) {const r=Math.min(w/img.naturalWidth,h/img.naturalHeight);c.drawImage(img,x+(w-img.naturalWidth*r)/2,y+(h-img.naturalHeight*r)/2,img.naturalWidth*r,img.naturalHeight*r);}
export async function drawShareCanvas(data,opts={}) {
  const [w,h]=RATIOS[opts.ratio]||RATIOS.long,short=h<800;
  const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${data.range.start}至${data.range.end}生活分享卡`);
  const c=canvas.getContext('2d');if(!c)throw new Error('当前浏览器无法生成图片');c.scale(2,2);
  if(document.fonts?.ready)await document.fonts.ready;
  const pet=opts.pet&&data.activePet?await loadImage(`./assets/pets/${data.activePet.petId}.png`):null;
  const badges=opts.badges?await Promise.all(data.newBadges.slice(0,3).map(b=>loadImage(badgeArt(b.id)))):[];
  const journal=opts.template!=='achievement';
  c.fillStyle=journal?'#FFF9E9':'#F3F5EE';c.fillRect(0,0,w,h);
  // 确定性纸张细节，预览/导出完全同源，不重绘随机纹理。
  c.strokeStyle=journal?'#E8DEC5':'#E7EBDD';c.lineWidth=1;
  for(let y=150;y<h-55;y+=36){c.beginPath();c.moveTo(35,y);c.lineTo(w-35,y);c.stroke();}
  round(c,32,32,w-64,h-64,30,journal?'#FFFDF388':'#FFFFFFBC');
  const title={day:'今天的小小成就',week:'这一周，没白过',month:'这个月的生活足迹'}[data.range.type];
  label(c,'今天没白过 · 生活成就手账',58,76,18,'#71806A',600);
  label(c,title,58,126,34,'#394936',800);
  label(c,data.range.type==='day'?data.range.start:`${data.range.start} — ${data.range.end}`,58,161,18,'#858475');
  if(pet)contained(c,pet,w-(short?178:210),short?40:195,short?118:150,short?118:165);
  let y=short?205:225;
  const contentWidth=(!short&&pet)?w-300:w-116;
  const note=opts.note?.trim() || (data.validCount?`留下 ${data.recordDays} 个记录日，收好了 ${data.validCount} 条生活痕迹。`:'这段时间还没有记录，从一件小事开始就好。');
  paragraph(c,note,58,y,contentWidth,short?19:23,short?2:3);
  y=short?284:400;
  const metrics=[['记录日',`${data.recordDays} 天`],['完成事项',`${data.completedCount} 件`]];
  if(opts.focus)metrics.push(['有效专注',`${Math.round(data.focusMin)} 分钟`]);
  if(opts.badges)metrics.push(['新徽章',`${data.badgeCount} 枚`]);
  const gap=10,cw=(w-116-gap*(metrics.length-1))/metrics.length;
  metrics.forEach(([name,value],i)=>{
    const x=58+i*(cw+gap);round(c,x,y,cw,short?76:100,16,'#EAF0E4');
    label(c,name,x+12,y+26,short?14:16,'#74846B');
    label(c,value,x+12,y+(short?56:69),short?19:23,'#3F563D',700);
  });
  y+=short?108:150;
  if(opts.tasks&&data.completed.length) {
    label(c,'想留下的小事',58,y,short?18:23,'#5C7151',700);y+=34;
    const rows=data.completed.slice(0,short?2:4);
    for(const row of rows){y+=paragraph(c,'· '+row.title,62,y,w-132,short?17:21,short?1:2)+9;}
    if(data.completedCount>rows.length){label(c,`另有 ${data.completedCount-rows.length} 件，已计入总数`,62,y,15,'#889080');y+=30;}
  }
  if(!short && badges.length) {
    y=Math.max(y+15,825);label(c,'新收藏',58,y,23,'#5C7151',700);y+=20;
    badges.forEach((im,i)=>{contained(c,im,64+i*180,y,140,140);paragraph(c,data.newBadges[i].name,66+i*180,y+165,160,17,2);});
  }
  if(!short&&pet){label(c,`${data.activePet.name||data.petDef?.name||'伙伴'} · ${stageOf(data.activePet.growth||0,!!data.activePet.coronationAt).name}`,58,h-165,21,'#5C7151',600);}
  c.strokeStyle='#D6DCCB';c.beginPath();c.moveTo(58,h-99);c.lineTo(w-58,h-99);c.stroke();
  label(c,'把普通日子，收进值得珍藏的生活。',58,h-66,short?16:20,'#78816C');
  return canvas;
}
export function canvasBlob(canvas) {
  return new Promise((resolve,reject)=>{
    try {canvas.toBlob(blob=>blob&&blob.size?resolve(blob):reject(new Error('没有生成有效的 PNG，请重试')),'image/png');}
    catch(e){reject(new Error('图片导出失败：'+e.message));}
  });
}
