// v2.5.0 · lightweight GLB viewer dedicated to the four companion cards.
// No network dependency: supports the glTF subset used by the bundled Blender exports
// (embedded BIN/PNG, POSITION/NORMAL/TEXCOORD_0, indexed TRIANGLES, PBR base/emissive colors).

const CTOR = { 5120:Int8Array, 5121:Uint8Array, 5122:Int16Array, 5123:Uint16Array, 5125:Uint32Array, 5126:Float32Array };
const SIZE = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT2:4, MAT3:9, MAT4:16 };

function quatRotate(v, q=[0,0,0,1]) {
  const [x,y,z]=v,[qx,qy,qz,qw]=q;
  const tx=2*(qy*z-qz*y), ty=2*(qz*x-qx*z), tz=2*(qx*y-qy*x);
  return [x+qw*tx+(qy*tz-qz*ty), y+qw*ty+(qz*tx-qx*tz), z+qw*tz+(qx*ty-qy*tx)];
}
function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mat4Mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o;}
function mat4Translate(x,y,z){const m=mat4Identity();m[12]=x;m[13]=y;m[14]=z;return m;}
function mat4RotateX(a){const c=Math.cos(a),s=Math.sin(a),m=mat4Identity();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function mat4RotateY(a){const c=Math.cos(a),s=Math.sin(a),m=mat4Identity();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function mat4Perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf;return m;}

function parseGlb(buffer){
  const dv=new DataView(buffer);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('不是有效的 GLB 文件');
  if(dv.getUint32(4,true)!==2)throw new Error('只支持 glTF 2.0');
  let off=12,json=null,bin=null;
  while(off+8<=buffer.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;const data=buffer.slice(off,off+len);off+=len;if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(data).replace(/\0+$/,''));else if(type===0x004E4942)bin=data;}
  if(!json||!bin)throw new Error('GLB 缺少 JSON 或 BIN 数据');return {json,bin};
}
function accessorData(json,bin,index){
  const a=json.accessors[index],view=json.bufferViews[a.bufferView],Ctor=CTOR[a.componentType],n=SIZE[a.type];
  if(!a||!view||!Ctor||!n)throw new Error('GLB 包含暂不支持的 accessor');
  const elemBytes=Ctor.BYTES_PER_ELEMENT*n,stride=view.byteStride||elemBytes,base=(view.byteOffset||0)+(a.byteOffset||0);
  if(stride===elemBytes)return new Ctor(bin,base,a.count*n);
  const out=new Ctor(a.count*n);for(let i=0;i<a.count;i++){const row=new Ctor(bin,base+i*stride,n);out.set(row,i*n);}return out;
}
async function decodeEmbeddedImage(json,bin,index=0){
  const image=json.images?.[index];if(!image) return null;
  if(image.uri){const res=await fetch(image.uri);if(!res.ok)throw new Error('卡面贴图加载失败');return decodeBlob(await res.blob());}
  const v=json.bufferViews[image.bufferView],blob=new Blob([bin.slice(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)],{type:image.mimeType||'image/png'});return decodeBlob(blob);
}
async function decodeBlob(blob){
  if('createImageBitmap' in window){try{return await createImageBitmap(blob);}catch{}}
  return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('卡面贴图解码失败'));};img.src=url;});
}
function compile(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw new Error('3D 着色器编译失败：'+msg);}return sh;}
function program(gl,vs,fs){const p=gl.createProgram(),v=compile(gl,gl.VERTEX_SHADER,vs),f=compile(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.bindAttribLocation(p,0,'aPosition');gl.bindAttribLocation(p,1,'aNormal');gl.bindAttribLocation(p,2,'aUV');gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const msg=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('3D 程序链接失败：'+msg);}return p;}

const VS=`
attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;
uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;
void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uMVP*vec4(aPosition,1.0);}`;
const FS=`
precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;
uniform vec4 uBase;uniform vec3 uEmissive;uniform float uRough;uniform float uShine;uniform bool uUseTex;uniform bool uUseEmissiveTex;uniform sampler2D uTex;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec4 tex=uUseTex?texture2D(uTex,vUV):vec4(1.0);vec4 base=uBase*tex;if(base.a<0.02)discard;vec3 L=normalize(vec3(-0.35,0.55,0.78));vec3 V=normalize(vec3(0.0,0.0,5.2)-vWorld);vec3 H=normalize(L+V);float diff=max(dot(n,L),0.0);float p=mix(70.0,10.0,clamp(uRough,0.0,1.0));float spec=pow(max(dot(n,H),0.0),p)*uShine;vec3 emit=uEmissive*(uUseEmissiveTex?tex.rgb:vec3(1.0));vec3 col=base.rgb*(0.54+0.62*diff)+vec3(spec)+emit*0.58;col=col/(col+vec3(0.35));col=pow(col,vec3(0.92));gl_FragColor=vec4(col,base.a);}`;

export const GLB_CARD_PATHS={1:'./assets/cards/runtime/stage1.glb',2:'./assets/cards/runtime/stage2.glb',3:'./assets/cards/runtime/stage3.glb',4:'./assets/cards/runtime/stage4.glb'};

export class GlbCardViewer{
  constructor(host,{stage=1,depth=1,shine=.58,quality='holo',autoFloat=true,onError=null}={}){
    this.host=host;this.stage=stage;this.depth=depth;this.shine=shine;this.quality=quality;this.autoFloat=autoFloat;this.onError=onError;this.rx=-.02;this.ry=0;this.flip=0;this.zoom=1;this.targetFlip=0;this.drag=false;this.moved=false;this.disposed=false;this.visible=true;this.frame=0;this.resources=[];this.primitives=[];
    this.canvas=document.createElement('canvas');this.canvas.className='glb-card-canvas';this.canvas.setAttribute('aria-label',`Lv.${stage} 3D 闪卡`);this.canvas.tabIndex=0;
    this.glow=document.createElement('span');this.glow.className='glb-card-holo';this.host.replaceChildren(this.canvas,this.glow);
    this._bind();this._resizeObserver=new ResizeObserver(()=>this.resize());this._resizeObserver.observe(this.host);
    if('IntersectionObserver'in window){this._io=new IntersectionObserver(e=>{this.visible=!!e[0]?.isIntersecting;if(this.visible)this.request();},{rootMargin:'100px'});this._io.observe(this.host);}
  }
  async load(path=GLB_CARD_PATHS[this.stage]){
    try{
      const res=await fetch(path);if(!res.ok)throw new Error(`3D 闪卡加载失败（${res.status}）`);const {json,bin}=parseGlb(await res.arrayBuffer());
      const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false});if(!gl)throw new Error('当前浏览器不支持 WebGL');this.gl=gl;
      this.program=program(gl,VS,FS);this.resources.push(this.program);
      const image=await decodeEmbeddedImage(json,bin,0);if(image){this.texture=gl.createTexture();this.resources.push(this.texture);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);image.close?.();}
      const node=json.nodes?.[json.scenes?.[json.scene||0]?.nodes?.[0]??0]||json.nodes?.[0]||{},q=node.rotation||[0,0,0,1],mesh=json.meshes?.[node.mesh??0];if(!mesh)throw new Error('GLB 没有可显示的网格');
      let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];const prepared=[];
      for(const prim of mesh.primitives){const pos=accessorData(json,bin,prim.attributes.POSITION),nor=accessorData(json,bin,prim.attributes.NORMAL),uv=prim.attributes.TEXCOORD_0!=null?accessorData(json,bin,prim.attributes.TEXCOORD_0):null,idx=accessorData(json,bin,prim.indices);const p2=new Float32Array(pos.length),n2=new Float32Array(nor.length);
        for(let i=0;i<pos.length;i+=3){const p=quatRotate([pos[i],pos[i+1],pos[i+2]],q),n=quatRotate([nor[i],nor[i+1],nor[i+2]],q);p2.set(p,i);n2.set(n,i);for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
        prepared.push({p:p2,n:n2,uv,idx,material:json.materials?.[prim.material??0]||{}});
      }
      const center=min.map((v,i)=>(v+max[i])/2),height=Math.max(.001,max[1]-min[1]),scale=3.1/height;
      for(const data of prepared){for(let i=0;i<data.p.length;i+=3){data.p[i]=(data.p[i]-center[0])*scale;data.p[i+1]=(data.p[i+1]-center[1])*scale;data.p[i+2]=(data.p[i+2]-center[2])*scale;}this.primitives.push(this._upload(data));}
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this._loc={mvp:gl.getUniformLocation(this.program,'uMVP'),model:gl.getUniformLocation(this.program,'uModel'),base:gl.getUniformLocation(this.program,'uBase'),em:gl.getUniformLocation(this.program,'uEmissive'),rough:gl.getUniformLocation(this.program,'uRough'),shine:gl.getUniformLocation(this.program,'uShine'),useTex:gl.getUniformLocation(this.program,'uUseTex'),useEm:gl.getUniformLocation(this.program,'uUseEmissiveTex'),tex:gl.getUniformLocation(this.program,'uTex')};
      this.resize();this.loaded=true;this.host.classList.add('is-3d-ready');this.request();return true;
    }catch(err){console.error(err);this.host.classList.add('is-3d-error');this.onError?.(err);return false;}
  }
  _upload(data){const gl=this.gl,make=(target,array)=>{const b=gl.createBuffer();this.resources.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);return b;};const mat=data.material||{},pbr=mat.pbrMetallicRoughness||{};return {pos:make(gl.ARRAY_BUFFER,data.p),nor:make(gl.ARRAY_BUFFER,data.n),uv:data.uv?make(gl.ARRAY_BUFFER,data.uv):null,idx:make(gl.ELEMENT_ARRAY_BUFFER,data.idx),count:data.idx.length,indexType:data.idx instanceof Uint32Array?gl.UNSIGNED_INT:data.idx instanceof Uint8Array?gl.UNSIGNED_BYTE:gl.UNSIGNED_SHORT,base:pbr.baseColorFactor||[1,1,1,1],rough:pbr.roughnessFactor??.55,em:mat.emissiveFactor||[0,0,0],useTex:pbr.baseColorTexture!=null,useEm:mat.emissiveTexture!=null};}
  _bind(){let sx=0,sy=0,startRx=0,startRy=0,pointer=null;const c=this.canvas;
    c.addEventListener('pointerdown',e=>{this.drag=true;this.moved=false;pointer=e.pointerId;sx=e.clientX;sy=e.clientY;startRx=this.rx;startRy=this.ry;c.setPointerCapture?.(pointer);});
    c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),px=Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width))),py=Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)));this.glow.style.setProperty('--mx',`${px*100}%`);this.glow.style.setProperty('--my',`${py*100}%`);if(!this.drag)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.hypot(dx,dy)>7)this.moved=true;this.ry=startRy+dx*.010*this.depth;this.rx=Math.max(-.55,Math.min(.55,startRx+dy*.007*this.depth));this.request();});
    const up=e=>{if(!this.drag)return;this.drag=false;if(!this.moved)this.targetFlip+=(Math.PI);try{c.releasePointerCapture?.(pointer);}catch{}this.request();};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',()=>{this.drag=false;});
    c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.82,Math.min(1.22,this.zoom+(e.deltaY<0?.045:-.045)));this.request();},{passive:false});
    c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.targetFlip+=Math.PI;this.request();}else if(e.key==='ArrowLeft'){this.ry-=.12;this.request();}else if(e.key==='ArrowRight'){this.ry+=.12;this.request();}});
  }
  setEffects({depth=this.depth,shine=this.shine,quality=this.quality,autoFloat=this.autoFloat}={}){this.depth=Number(depth);this.shine=Number(shine);this.quality=quality;this.autoFloat=!!autoFloat;this.glow.className=`glb-card-holo quality-${quality}`;this.request();}
  resize(){const gl=this.gl;if(!gl)return;const r=this.host.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.canvas.style.width=r.width+'px';this.canvas.style.height=r.height+'px';gl.viewport(0,0,w,h);}this.request();}
  request(){if(this.disposed||!this.loaded||this.frame)return;this.frame=requestAnimationFrame(t=>{this.frame=0;this.render(t);});}
  render(t=0){if(this.disposed||!this.loaded||!this.visible)return;const gl=this.gl;const diff=this.targetFlip-this.flip;if(Math.abs(diff)>.002)this.flip+=diff*.12;else this.flip=this.targetFlip;const float=this.autoFloat&&!this.drag?Math.sin(t*.00075)*.035:0;const aspect=this.canvas.width/this.canvas.height;const fov=(this.quality==='deep'?32:this.quality==='soft'?39:35)/Math.max(.86,Math.min(1.15,this.depth));const proj=mat4Perspective(fov*Math.PI/180,aspect,.1,50);const view=mat4Translate(0,0,-5.45/this.zoom);let model=mat4Mul(mat4RotateY(this.ry+this.flip+float),mat4RotateX(this.rx+Math.sin(t*.0005)*.012));model=mat4Mul(mat4Translate(0,Math.sin(t*.001)*.025,0),model);const mv=mat4Mul(view,model),mvp=mat4Mul(proj,mv);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this._loc.mvp,false,mvp);gl.uniformMatrix4fv(this._loc.model,false,model);gl.activeTexture(gl.TEXTURE0);if(this.texture)gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this._loc.tex,0);
    const shineScale=this.quality==='soft'?.45:this.quality==='deep'?1.35:1;
    for(const p of this.primitives){gl.bindBuffer(gl.ARRAY_BUFFER,p.pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,p.nor);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);if(p.uv){gl.bindBuffer(gl.ARRAY_BUFFER,p.uv);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(2);gl.vertexAttrib2f(2,0,0);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,p.idx);gl.uniform4fv(this._loc.base,p.base);gl.uniform3fv(this._loc.em,p.em);gl.uniform1f(this._loc.rough,p.rough);gl.uniform1f(this._loc.shine,this.shine*shineScale);gl.uniform1i(this._loc.useTex,p.useTex&&!!this.texture);gl.uniform1i(this._loc.useEm,p.useEm&&!!this.texture);gl.drawElements(gl.TRIANGLES,p.count,p.indexType,0);}
    if(Math.abs(this.targetFlip-this.flip)>.002||this.autoFloat)this.request();
  }
  dispose(){if(this.disposed)return;this.disposed=true;if(this.frame)cancelAnimationFrame(this.frame);this._resizeObserver?.disconnect();this._io?.disconnect();const gl=this.gl;if(gl){for(const r of this.resources){if(r===this.program)gl.deleteProgram(r);else if(r===this.texture)gl.deleteTexture(r);else gl.deleteBuffer(r);}}this.host.replaceChildren();}
}
