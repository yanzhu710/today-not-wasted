// Local-only reward artwork pipeline.
// 1) decode locally, 2) smart border-connected background removal,
// 3) feather the subject edge, 4) draw a hand-made white sticker outline.
// No upload, API, model download, or database schema change is required.
import { put } from './db.js';
import { uid } from './util.js';

function decodeFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file); const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=e=>{URL.revokeObjectURL(url);reject(e);}; img.src=url;
  });
}
function blobOf(canvas,type='image/png',quality=.94){ return new Promise(resolve=>canvas.toBlob(resolve,type,quality)); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function colorDist3(r,g,b,c){ const dr=r-c[0],dg=g-c[1],db=b-c[2]; return Math.sqrt(dr*dr*.82+dg*dg+db*db*.68); }
function pixelDist(data,i,j){ const dr=data[i]-data[j],dg=data[i+1]-data[j+1],db=data[i+2]-data[j+2]; return Math.sqrt(dr*dr+dg*dg+db*db); }
function roundedRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function drawFitted(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height);const dw=img.width*scale,dh=img.height*scale;const dx=x+(w-dw)/2,dy=y+(h-dh)/2;ctx.drawImage(img,dx,dy,dw,dh);return {x:dx,y:dy,w:dw,h:dh};}
function hasUsefulAlpha(img){
  const c=document.createElement('canvas'); c.width=48;c.height=48;const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,48,48);x.drawImage(img,0,0,48,48);const d=x.getImageData(0,0,48,48).data;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]<245)transparent++;return transparent>(d.length/4)*.025;
}

function borderSamples(data,w,h){
  const out=[]; const step=Math.max(1,Math.round(Math.min(w,h)/180)); const band=Math.max(2,Math.round(Math.min(w,h)*.018));
  const add=(x,y)=>{const i=(y*w+x)*4;if(data[i+3]>24)out.push([data[i],data[i+1],data[i+2]]);};
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){if(x<band||x>=w-band||y<band||y>=h-band)add(x,y);}
  return out;
}
function kMeans(samples,k=4){
  if(!samples.length)return [[255,255,255]];
  const centers=[];for(let i=0;i<k;i++)centers.push([...samples[Math.floor(i*(samples.length-1)/Math.max(1,k-1))]]);
  for(let iter=0;iter<7;iter++){
    const sums=Array.from({length:k},()=>[0,0,0,0]);
    for(const s of samples){let bi=0,bd=Infinity;for(let j=0;j<centers.length;j++){const d=colorDist3(s[0],s[1],s[2],centers[j]);if(d<bd){bd=d;bi=j;}}const v=sums[bi];v[0]+=s[0];v[1]+=s[1];v[2]+=s[2];v[3]++;}
    for(let j=0;j<k;j++){const v=sums[j];if(v[3])centers[j]=[v[0]/v[3],v[1]/v[3],v[2]/v[3]];}
  }
  return centers;
}
function nearestBgDistance(data,i,centers){let d=Infinity;for(const c of centers)d=Math.min(d,colorDist3(data[i],data[i+1],data[i+2],c));return d;}
function smartCutout(img){
  const longest=Math.max(img.width,img.height);const scale=Math.min(1,920/Math.max(1,longest));const w=Math.max(2,Math.round(img.width*scale)),h=Math.max(2,Math.round(img.height*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
  const im=ctx.getImageData(0,0,w,h),d=im.data;const samples=borderSamples(d,w,h);const centers=kMeans(samples,Math.min(5,Math.max(2,Math.round(samples.length/700))));
  const borderD=samples.map(s=>{let z=Infinity;for(const cc of centers)z=Math.min(z,colorDist3(s[0],s[1],s[2],cc));return z;}).sort((a,b)=>a-b);
  const p85=borderD[Math.floor(borderD.length*.85)]||24;const seedT=clamp(p85+18,34,72),spreadT=clamp(seedT+16,48,92);
  const bg=new Uint8Array(w*h),queue=new Int32Array(w*h);let qh=0,qt=0;
  const trySeed=(x,y)=>{const p=y*w+x;if(bg[p])return;const i=p*4;if(d[i+3]<20||nearestBgDistance(d,i,centers)<=seedT){bg[p]=1;queue[qt++]=p;}};
  for(let x=0;x<w;x++){trySeed(x,0);trySeed(x,h-1);}for(let y=1;y<h-1;y++){trySeed(0,y);trySeed(w-1,y);}
  const dirs=[-1,1,-w,w];
  while(qh<qt){const p=queue[qh++],px=p%w,py=(p/w)|0,pi=p*4;for(const off of dirs){const n=p+off;if(n<0||n>=w*h||bg[n])continue;const nx=n%w,ny=(n/w)|0;if(Math.abs(nx-px)+Math.abs(ny-py)!==1)continue;const ni=n*4;if(d[ni+3]<18){bg[n]=1;queue[qt++]=n;continue;}const dist=nearestBgDistance(d,ni,centers);const local=pixelDist(d,pi,ni);if(dist<=seedT||(dist<=spreadT&&local<58)){bg[n]=1;queue[qt++]=n;}}
  }
  let removed=0;for(const v of bg)removed+=v?1:0;const fraction=removed/(w*h);
  // Be conservative: a wrong cutout is worse than keeping some background. Busy or low-background
  // photos fall back to a poster, and the detected background is pulled 4px away from the subject.
  if(fraction<.10||fraction>.88)return {canvas:c,mode:'poster',confidence:fraction};
  const safe=bg.slice();
  const radius=Math.max(2,Math.round(Math.min(w,h)*.006));
  for(let y=radius;y<h-radius;y++)for(let x=radius;x<w-radius;x++){
    const p=y*w+x;if(!bg[p])continue;let nearSubject=false;
    for(let yy=-radius;yy<=radius&&!nearSubject;yy++)for(let xx=-radius;xx<=radius;xx++){if(!bg[(y+yy)*w+x+xx]){nearSubject=true;break;}}
    if(nearSubject)safe[p]=0;
  }
  const edge=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x;if(safe[p])continue;if(safe[p-1]||safe[p+1]||safe[p-w]||safe[p+w])edge[p]=1;}
  for(let p=0;p<w*h;p++){const a=p*4;if(safe[p])d[a+3]=0;else if(edge[p])d[a+3]=225;else d[a+3]=255;}
  ctx.clearRect(0,0,w,h);ctx.putImageData(im,0,0);
  // very small blur only on alpha edge: draw the cutout through a filtered staging canvas.
  const f=document.createElement('canvas');f.width=w;f.height=h;const fx=f.getContext('2d');fx.filter='blur(.55px)';fx.drawImage(c,0,0);fx.filter='none';
  return {canvas:f,mode:'cutout',confidence:fraction};
}
function composeSticker(source,mode){
  const size=720,pad=76;const base=document.createElement('canvas');base.width=size;base.height=size;const b=base.getContext('2d');b.imageSmoothingEnabled=true;b.imageSmoothingQuality='high';
  if(mode==='cutout'||mode==='alpha') drawFitted(b,source,pad,pad,size-pad*2,size-pad*2);
  else {const x=pad,y=pad,w=size-pad*2,h=size-pad*2;b.save();roundedRect(b,x,y,w,h,58);b.clip();drawFitted(b,source,x,y,w,h);b.restore();}
  const out=document.createElement('canvas');out.width=size;out.height=size;const o=out.getContext('2d');
  // irregular white outline: multiple slightly different radii make it feel hand-cut instead of vector-perfect.
  for(let deg=0;deg<360;deg+=10){const a=deg*Math.PI/180;const r=18+Math.sin(deg*.41)*2.1+((deg/10)%3-1)*.8;o.globalAlpha=.98;o.drawImage(base,Math.cos(a)*r,Math.sin(a)*r);}
  o.globalCompositeOperation='source-in';o.globalAlpha=1;o.fillStyle='#fffdf8';o.fillRect(0,0,size,size);o.globalCompositeOperation='source-over';
  // warm pencil-like outer echo.
  o.globalAlpha=.25;o.strokeStyle='#8f8068';o.lineWidth=2;o.setLineDash([8,10]);roundedRect(o,pad-28,pad-28,size-2*(pad-28),size-2*(pad-28),74);o.stroke();o.setLineDash([]);o.globalAlpha=1;
  o.drawImage(base,0,0);
  o.strokeStyle='rgba(255,253,248,.98)';o.lineWidth=6;o.lineCap='round';
  const marks=[[91,136,-1],[622,161,1],[111,581,1],[610,558,-1]];for(const [x,y,s] of marks){o.beginPath();o.moveTo(x-14,y);o.lineTo(x+14,y+s*3);o.moveTo(x+2,y-15);o.lineTo(x-2,y+15);o.stroke();}
  return out;
}
export async function saveRewardSticker(file,{mode:preferred='auto'}={}){
  if(!file||!file.type?.startsWith('image/'))throw new Error('请选择图片文件');
  if(file.size>18*1024*1024)throw new Error('图片太大，请选择 18MB 以内的图片');
  const img=await decodeFile(file);let source=img,mode='alpha',confidence=1;
  if(preferred==='poster'){mode='poster';confidence=1;}
  else if(!hasUsefulAlpha(img)){const result=smartCutout(img);source=result.canvas;mode=result.mode;confidence=result.confidence;}
  const out=composeSticker(source,mode);const blob=await blobOf(out,'image/png');if(!blob)throw new Error('图片处理失败');
  const thumbCanvas=document.createElement('canvas');thumbCanvas.width=360;thumbCanvas.height=360;const t=thumbCanvas.getContext('2d');t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(out,0,0,360,360);const thumb=await blobOf(thumbCanvas,'image/png');
  const id=uid('rwimg');await put('photos',{id,blob,thumb:thumb||blob,kind:'reward-sticker',cutoutMode:mode,cutoutConfidence:confidence,createdAt:Date.now()});return id;
}
