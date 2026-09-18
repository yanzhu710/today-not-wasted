import { db, atomically, SCHEMA_VERSION } from './db.js';
// 用户已确认“替换”后调用。先校验全量媒体，再用一个事务替换；失败不留下半份备份。
export async function restoreBackupBundle(snapshot, mediaFiles) {
  if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) throw new Error('备份结构版本不匹配，未修改当前数据');
  const stores=[...db().objectStoreNames];
  for (const name of stores.filter(n=>n!=='photos')) {
    if (!Array.isArray(snapshot[name])) throw new Error('备份缺少数据表：'+name);
  }
  const media=new Map();
  for (const file of mediaFiles) {
    const name=file.name.slice(6),thumb=name.endsWith('_t'),id=thumb?name.slice(0,-2):name;
    if (!id || !file.data?.byteLength) throw new Error('备份媒体无效');
    const row=media.get(id)||{id,blob:null,thumb:null};
    const bytes=new Uint8Array(file.data);
    const mime=bytes[0]===0x89&&bytes[1]===0x50?'image/png':bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':'application/octet-stream';
    row[thumb?'thumb':'blob']=new Blob([bytes],{type:mime});media.set(id,row);
  }
  const avatar=snapshot.kv.find(r=>r.key==='profile')?.value?.avatarId;
  const refs=[avatar,...snapshot.journal.map(r=>r.photoId)].filter(Boolean);
  for (const id of refs) if (!media.get(id)?.blob) throw new Error('备份缺少图片 '+id+'，未修改当前数据');
  const ops=[];
  for (const name of stores){
    ops.push({store:name,type:'clear'});
    const rows=name==='photos'?[...media.values()]:snapshot[name];
    for (const row of rows)ops.push({store:name,type:'put',value:row});
  }
  await atomically(stores,ops);
  window.dispatchEvent(new CustomEvent('tjmbg:media-restored'));
}
