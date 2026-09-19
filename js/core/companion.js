// v2.5.0 伙伴系统：唯一默认伙伴、陪伴值、轻状态、偏好、回忆、邀请号与加冕。
// 这里不负责 UI，不制造负向惩罚，也不清空任何旧数据。
import { all, allByIndex, get, put, loadKV, patchKV } from './db.js';
import { PRIMARY_PET_ID, COMPANION_CONFIG, STAGES, stageOf } from './catalog.js';
import { todayKey, dateKey } from './util.js';
import { isValidRecord } from './record-summary.js';

export const PET_ACTIONS = ['idle','happy','touch','feed','play','encourage','sleep','celebrate'];
export const COMPANION_INVITES = Object.freeze({}); // 正式邀请码由以后版本集中配置；当前不硬编码。

export const FLASH_CARDS = [
  { stage:1, title:'初见', sub:'它轻轻敲门', no:'No. 01 / 04' },
  { stage:2, title:'星伴', sub:'星光落在肩头', no:'No. 02 / 04' },
  { stage:3, title:'月栖', sub:'同看一片月光', no:'No. 03 / 04' },
  { stage:4, title:'加冕', sub:'此刻为你加冕', no:'No. 04 / 04' },
];

const INTERACTION_STATUS = {
  touch: ['开心','被你摸摸以后，心情很好。'],
  encourage: ['安心','收到你的鼓励，也想把勇气还给你。'],
  feed: ['满足','吃饱啦，今天很满足。'],
  play: ['元气','刚刚玩得很开心，精神满满。'],
};
const INTERACTION_MEMORY = {
  touch: ['first_touch','第一次摸摸','第一次认真地摸了摸伙伴。'],
  encourage: ['first_encourage','第一次鼓励','你们第一次互相打气。'],
  feed: ['first_feed','第一次喂食','第一次一起分享了好吃的。'],
  play: ['first_play','第一次玩耍','第一次一起玩了起来。'],
};

function stageUnlocksFor(growth, crowned, ts) {
  const out = { 1: ts };
  if (growth >= STAGES[1].min) out[2] = ts;
  if (growth >= STAGES[2].min) out[3] = ts;
  if (crowned && growth >= STAGES[3].min) out[4] = ts;
  return out;
}

export async function migrateCompanionV25() {
  const [meta, pets, profile] = await Promise.all([loadKV('app_meta'), all('pets'), loadKV('profile')]);
  let primary = pets.find(p => p.petId === PRIMARY_PET_ID) || null;
  if (!primary) {
    const activeOld = pets.find(p => p.petId === meta.activePet) || pets[0] || null;
    const highest = pets.reduce((best,p)=>(Number(p.growth)||0) > (Number(best?.growth)||0) ? p : best, activeOld);
    const maxGrowth = Math.max(0, ...pets.map(p=>Number(p.growth)||0));
    const earliest = Math.min(...pets.map(p=>Number(p.ownedAt)||Date.now()), Number(meta.createdAt)||Date.now());
    // 老用户已达到旧阶段4时直接保留为纪念期，避免版本升级后“降级”。新用户仍必须使用加冕果实。
    const grandfathered = maxGrowth >= 720;
    const legacyDefaults = new Set(['团团','栗栗','米团','阿栗','伙伴']);
    const candidates = [activeOld?.name, highest?.name, profile.petName].map(v=>String(v||'').trim()).filter(Boolean);
    const inheritedName = (candidates.find(v=>!legacyDefaults.has(v)) || '').slice(0,12);
    primary = {
      petId: PRIMARY_PET_ID,
      name: inheritedName,
      growth: maxGrowth,
      equipped: {},
      ownedAt: Number.isFinite(earliest) ? earliest : Date.now(),
      coronationAt: grandfathered ? Date.now() : null,
      grandfatheredCoronation: grandfathered,
      status: null,
      preferences: { food: [], toy: [], interaction: [] },
      stageUnlocked: stageUnlocksFor(maxGrowth, grandfathered, Date.now()),
    };
    await put('pets', primary);
  } else {
    primary.preferences ||= { food: [], toy: [], interaction: [] };
    primary.stageUnlocked ||= stageUnlocksFor(primary.growth||0, !!primary.coronationAt, primary.ownedAt||Date.now());
    primary.equipped ||= {};
    await put('pets', primary);
  }
  if (meta.activePet !== PRIMARY_PET_ID || Number(meta.companionMigration||0) < 1) {
    await patchKV('app_meta', { activePet: PRIMARY_PET_ID, companionMigration: 1, schemaVersion: 2 });
  }
  if ((profile.petName || '') !== (primary.name || '')) await patchKV('profile', { petName: primary.name || '' });
  await rememberPetEvent({
    petId: PRIMARY_PET_ID, id:`mem:${PRIMARY_PET_ID}:first_meet`, kind:'first_meet',
    title:'第一次相遇', note:'从这一天开始，你们成为了彼此的伙伴。', ts:primary.ownedAt || Date.now(),
  });
  return primary;
}

export function validatePartnerInvite(code, petId) {
  const expected = COMPANION_INVITES[petId];
  return !!expected && String(code||'').trim().toUpperCase() === String(expected).trim().toUpperCase();
}

export function companionDisplayName(pet) { return (pet?.name || '').trim() || '你的伙伴'; }
export function companionStage(pet) { return stageOf(pet?.growth || 0, !!pet?.coronationAt); }
export function coronationReady(pet) { return !!pet && !pet.coronationAt && (Number(pet.growth)||0) >= COMPANION_CONFIG.coronationGrowth; }

export function companionStatus(pet, now = new Date()) {
  const stored = pet?.status;
  if (stored?.id && dateKey(new Date(Number(stored.updatedAt)||0)) === todayKey(now)) return stored;
  const hour = now.getHours();
  if (hour < 6 || hour >= 23) return { id:'困困', text:'夜深啦，陪你安静待一会儿。', updatedAt:now.getTime() };
  if (hour < 10) return { id:'元气', text:'早上好，今天也慢慢开始。', updatedAt:now.getTime() };
  if (hour < 18) return { id:'安静', text:'我就在旁边，陪你过今天。', updatedAt:now.getTime() };
  return { id:'开心', text:'今天也一起走过不少时间啦。', updatedAt:now.getTime() };
}

export async function rememberPetEvent({ petId=PRIMARY_PET_ID, id, kind, title, note='', ts=Date.now(), dateKey:dk=null, meta={} }) {
  const memoryId = id || `mem:${petId}:${kind}`;
  const existing = await get('pet_memories', memoryId).catch(()=>null);
  if (existing) return existing;
  const row = { id:memoryId, petId, kind, title, note, ts, dateKey:dk || dateKey(new Date(ts)), meta };
  await put('pet_memories', row);
  return row;
}

export async function companionMemories(petId=PRIMARY_PET_ID) {
  const rows = await allByIndex('pet_memories','petId',petId).catch(()=>[]);
  return rows.sort((a,b)=>(Number(a.ts)||0)-(Number(b.ts)||0));
}

export async function syncCompanionMemories(pet) {
  if (!pet) return [];
  const [events,badges,todayInteractions] = await Promise.all([all('events'),all('badges'),allByIndex('petlog','dateKey',todayKey())]);
  const real = events.filter(isValidRecord).sort((a,b)=>(a.ts||0)-(b.ts||0));
  const togetherDays=Math.max(1,Math.floor((Date.now()-(Number(pet.ownedAt)||Date.now()))/86400000)+1);
  for (const days of [7,30,100]) if (togetherDays>=days) await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:together_${days}`,kind:`together_${days}`,title:`一起走过 ${days} 天`,note:days===7?'一周的普通日子，已经开始有了共同的节奏。':days===30?'一个月不是很长，但已经足够留下不少只属于你们的瞬间。':'一百天的陪伴，已经是一段值得认真收藏的故事。',ts:Date.now()});
  const kinds=new Set(todayInteractions.filter(l=>Number(l.amount)>0&&l.interaction).map(l=>l.interaction));
  if(kinds.size>=3) await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:warm_day:${todayKey()}`,kind:'warm_day',title:'今天很有回应',note:'今天一起完成了好几种互动，平凡的一天也变得更有记忆点。',ts:Date.now(),dateKey:todayKey()});
  const first60 = events.filter(e=>e.kind==='focus' && Number(e.minutes||0)>=60).sort((a,b)=>(a.ts||0)-(b.ts||0))[0];
  if (first60) await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:focus60`,kind:'focus60',title:'第一次专注 1 小时',note:'一起安静地完成了一段很长的专注。',ts:first60.ts,dateKey:first60.dateKey});
  if (badges.length) {
    const b=[...badges].sort((a,b)=>(a.ts||0)-(b.ts||0))[0];
    await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:first_badge`,kind:'first_badge',title:'第一枚徽章',note:'第一枚值得收藏的生活印记。',ts:b.ts||Date.now()});
  }
  if (real.length>=100) {
    const e=real[99];
    await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:record100`,kind:'record100',title:'第 100 条生活记录',note:'一百个普通瞬间，已经变成一段很长的故事。',ts:e.ts||Date.now(),dateKey:e.dateKey});
  }
  return companionMemories(pet.petId);
}

export async function applyInteractionState(pet, kind, itemId=null) {
  if (!pet) return { discovered:null };
  const [sid, text] = INTERACTION_STATUS[kind] || ['开心','和你待在一起就很好。'];
  pet.status = { id:sid, text, updatedAt:Date.now() };
  pet.preferences ||= { food: [], toy: [], interaction: [] };
  let discovered = null;
  const cfg = COMPANION_CONFIG;
  if (kind === 'feed' && itemId === cfg.favoriteFood && !pet.preferences.food.includes(itemId)) {
    pet.preferences.food.push(itemId); discovered = { type:'food', itemId };
  }
  if (kind === 'play' && itemId === cfg.favoriteToy && !pet.preferences.toy.includes(itemId)) {
    pet.preferences.toy.push(itemId); discovered = { type:'toy', itemId };
  }
  if (kind === cfg.favoriteInteraction && !pet.preferences.interaction.includes(kind)) {
    pet.preferences.interaction.push(kind); discovered = discovered || { type:'interaction', itemId:kind };
  }
  await put('pets', pet);
  const mem = INTERACTION_MEMORY[kind];
  if (mem) await rememberPetEvent({petId:pet.petId,id:`mem:${pet.petId}:${mem[0]}`,kind:mem[0],title:mem[1],note:mem[2]});
  return { discovered, status:pet.status };
}

export async function interactionReward(kind, itemId=null, dk=todayKey()) {
  const cap = COMPANION_CONFIG.interactionDailyCaps[kind] || 0;
  const logs = await allByIndex('petlog','dateKey',dk);
  const rewarded = logs.filter(l=>l?.interaction===kind && Number(l.amount)>0).length;
  if (rewarded >= cap) return { amount:0, capped:true };
  let amount = COMPANION_CONFIG.interactionGrowth[kind] || 0;
  if ((kind==='feed' && itemId===COMPANION_CONFIG.favoriteFood) ||
      (kind==='play' && itemId===COMPANION_CONFIG.favoriteToy) ||
      (kind===COMPANION_CONFIG.favoriteInteraction)) amount += COMPANION_CONFIG.favoriteBonus;
  return { amount, capped:false };
}
