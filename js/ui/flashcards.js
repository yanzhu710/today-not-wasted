// v2.5.0 四阶 3D 闪卡收藏。
// 运行时优先加载用户提供的 GLB；WebGL/资源失败时退回轻量 CSS 收藏卡，业务解锁逻辑不受影响。
import { h, icon, fmtCN } from '../core/util.js';
import { STAGES, stageOf } from '../core/catalog.js';
import { FLASH_CARDS } from '../core/companion.js';
import { petAssetPath } from '../core/pets.js';
import { openModal } from '../core/fx.js';
import { GlbCardViewer, GLB_CARD_PATHS } from './glb-card-viewer.js';

const STORIES={
  1:'第一次相遇的样子，会一直留在这张卡里。',
  2:'开始熟悉彼此以后，普通的日子也多了一点回应。',
  3:'真正的伙伴，不用一直说话，也知道彼此在身边。',
  4:'这不是终点，而是一段长期陪伴被认真记住的证明。',
};

export function renderFlashcards(pet,{onDispose=null}={}){
  const current=stageOf(pet.growth||0,!!pet.coronationAt).n;
  let selected=Math.max(0,current-1),quality='holo',depth=1,shine=.34,autoFloat=true,disposed=false,viewer=null;
  const root=h('section',{class:'companion-flashbook','aria-label':'伙伴闪卡收藏'});
  const head=h('div',{class:'companion-flash-head'},
    h('div',null,h('span',{class:'companion-kicker'},'HOLOGRAPHIC ARCHIVE'),h('h2',null,'四阶闪卡'),h('p',null,`已解锁 ${current}/4 张 · 真实 3D 模型`)),
    h('button',{class:'btn btn-ghost btn-sm',onclick:()=>openEffectPanel()},icon('settings'),'效果'));
  const stage=h('div',{class:'companion-flash-stage'}),meta=h('div',{class:'companion-flash-meta'}),nav=h('div',{class:'companion-flash-nav','aria-label':'选择闪卡'});
  root.append(head,stage,meta,nav);

  function destroyViewer(){viewer?.dispose?.();viewer=null;}
  function applyEffects(){viewer?.setEffects({quality,depth,shine,autoFloat});}
  function openEffectPanel(){
    const qualitySel=h('select',{class:'input'},
      h('option',{value:'soft',selected:quality==='soft'},'柔和纸感'),
      h('option',{value:'holo',selected:quality==='holo'},'虹彩闪卡'),
      h('option',{value:'deep',selected:quality==='deep'},'深邃典藏'));
    const depthInp=h('input',{class:'input range',type:'range',min:'.7',max:'1.5',step:'.05',value:String(depth)}),shineInp=h('input',{class:'input range',type:'range',min:'0',max:'1',step:'.05',value:String(shine)}),floatInp=h('input',{type:'checkbox',checked:autoFloat});
    const depthOut=h('span',{class:'num'},depth.toFixed(2)+'×'),shineOut=h('span',{class:'num'},Math.round(shine*100)+'%');
    const live=()=>{quality=qualitySel.value;depth=Number(depthInp.value);shine=Number(shineInp.value);autoFloat=!!floatInp.checked;depthOut.textContent=depth.toFixed(2)+'×';shineOut.textContent=Math.round(shine*100)+'%';applyEffects();};
    qualitySel.onchange=()=>{const preset={soft:.14,holo:.34,deep:.52}[qualitySel.value]??.34;shineInp.value=String(preset);live();};depthInp.oninput=live;shineInp.oninput=live;floatInp.onchange=live;
    openModal({title:'闪卡效果',content:h('div',{class:'form-list'},
      h('div',{class:'form-item'},h('span',{class:'form-label'},'卡面质感'),qualitySel),
      h('div',{class:'form-item'},h('span',{class:'form-label'},'透视深度 · ',depthOut),depthInp),
      h('div',{class:'form-item'},h('span',{class:'form-label'},'高光强度 · ',shineOut),shineInp),
      h('label',{class:'flash-toggle'},floatInp,h('span',null,h('b',null,'呼吸与漂浮'),h('small',null,'停止操作后保持轻微立体呼吸'))),
      h('p',{class:'form-hint'},'手指横向拖动可旋转，点击翻面；桌面端滚轮可缩放。竖向滑动仍交给页面滚动。')),
      actions:[{label:'恢复默认',onClick:()=>{quality='holo';depth=1;shine=.34;autoFloat=true;draw();}},{label:'完成',cls:'btn-primary',onClick:c=>{live();c();}}]});
  }
  function fallbackCard(cardMeta,unlocked,reason=''){
    const unlockTs=pet.stageUnlocked?.[cardMeta.stage]||(cardMeta.stage===1?pet.ownedAt:null)||(cardMeta.stage===4?pet.coronationAt:null);
    return h('button',{class:`holo-card fallback quality-${quality}${unlocked?'':' locked'}`,'aria-label':unlocked?`Lv.${cardMeta.stage} ${cardMeta.title}`:`Lv.${cardMeta.stage} 未解锁`,disabled:!unlocked},
      h('span',{class:'holo-card-inner'},
        h('span',{class:'holo-card-face holo-front'},h('span',{class:'holo-stage'},`Lv.${cardMeta.stage}`),h('span',{class:'holo-card-name'},cardMeta.title),h('img',{src:petAssetPath(pet.petId,cardMeta.stage,cardMeta.stage===4?'celebrate':'idle'),alt:'',draggable:'false'}),h('span',{class:'holo-pet-name'},pet.name||'你的伙伴'),h('small',null,unlocked?cardMeta.sub:'继续陪伴后解锁')),
        h('span',{class:'holo-card-face holo-back'},h('span',{class:'holo-back-mark'},'✦'),h('b',null,`Lv.${cardMeta.stage} · ${STAGES[cardMeta.stage-1].name}`),h('p',null,reason||STORIES[cardMeta.stage]),h('span',{class:'holo-unlock'},unlocked?(unlockTs?`解锁于 ${fmtCN(new Date(unlockTs).toISOString().slice(0,10))}`:'已解锁'):(cardMeta.stage===4?'完成加冕后解锁':'陪伴值达到阶段要求后解锁')),h('small',null,cardMeta.no))));
  }
  function draw(){
    if(disposed)return;destroyViewer();stage.replaceChildren();meta.replaceChildren();nav.replaceChildren();
    const cardMeta=FLASH_CARDS[selected],unlocked=cardMeta.stage<=current,unlockTs=pet.stageUnlocked?.[cardMeta.stage]||(cardMeta.stage===1?pet.ownedAt:null)||(cardMeta.stage===4?pet.coronationAt:null);
    if(unlocked){
      const runtime=h('div',{class:`glb-card-runtime quality-${quality}`,'aria-label':`Lv.${cardMeta.stage} ${cardMeta.title} 3D 闪卡`},h('div',{class:'glb-card-loading'},'正在准备 3D 闪卡…'));
      stage.append(runtime);viewer=new GlbCardViewer(runtime,{stage:cardMeta.stage,quality,depth,shine,autoFloat,onError:(err)=>{if(disposed||selected!==cardMeta.stage-1)return;runtime.replaceChildren(fallbackCard(cardMeta,true,'3D 模型暂时没有加载成功，已切换为轻量收藏卡。'));console.warn('flashcard fallback',err);}});viewer.load(GLB_CARD_PATHS[cardMeta.stage]);
    }else stage.append(h('div',{class:'flash-locked-wrap'},fallbackCard(cardMeta,false),h('div',{class:'flash-lock-copy'},icon('lock'),h('b',null,cardMeta.stage===4?'完成加冕后解锁':'继续陪伴后解锁'),h('span',null,cardMeta.stage===4?'最终闪卡只在纪念期开放。':`达到 Lv.${cardMeta.stage} 后自动加入收藏。`))));
    meta.append(h('div',null,h('b',null,`${cardMeta.lv||'Lv.'+cardMeta.stage} · ${cardMeta.title}`),h('span',null,cardMeta.sub)),h('div',null,h('small',null,cardMeta.no),h('span',null,unlocked?(unlockTs?`解锁于 ${fmtCN(new Date(unlockTs).toISOString().slice(0,10))}`:'已解锁'):'未解锁')));
    FLASH_CARDS.forEach((c,i)=>nav.append(h('button',{class:'companion-flash-thumb'+(i===selected?' on':'')+(c.stage>current?' locked':''),onclick:()=>{selected=i;draw();},'aria-label':`查看 Lv.${c.stage} ${c.title}`},h('span',{class:'flash-thumb-num'},`0${c.stage}`),h('div',null,h('b',null,c.title),h('small',null,`Lv.${c.stage}`)),c.stage>current?h('i',null,icon('lock')):h('i',{class:'flash-thumb-dot'},'•'))));
  }
  draw();
  const dispose=()=>{disposed=true;destroyViewer();};onDispose?.(dispose);root._dispose=dispose;return root;
}
