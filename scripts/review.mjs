import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {addDraft,decide,digest,mergeApproved,validateCatalog} from './content.mjs';
import {loadState,saveState} from './state.mjs';
import {loadCatalog} from './catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const save=(p,v)=>writeFileSync(resolve(root,p),JSON.stringify(v,null,2)+'\n');
const statePath=resolve(root,'research/state.json'),loaded=loadState(statePath),state=loaded.value,catalog=loadCatalog();
const store=()=>saveState(statePath,state,loaded.version);
const [command,id,revision]=process.argv.slice(2);
if(command==='add'){
  const input=JSON.parse(readFileSync(resolve(id),'utf8'));
  const e=addDraft(state,catalog,input.shop,input.evidence,{update:input.operation==='update'});store();console.log(`${e.shop.id} pending ${e.revision}`);
}else if(command==='list'||!command){
  console.log(JSON.stringify(state.entries.map(e=>({id:e.shop.id,name:e.shop.name,status:e.status,revision:e.revision,shop:e.shop,evidence:e.evidence})),null,2));
}else if(['approve','reject'].includes(command)){
  const entry=state.entries.find(e=>e.shop.id===id&&e.revision===revision&&e.status==='pending');if(!entry)throw new Error('找不到該待審版本');
  // Only run after the owner explicitly approves/rejects this exact revision in chat.
  decide(entry,revision,command==='approve'?'approved':'rejected');store();console.log(entry.status);
}else if(command==='prepare'){
  const entries=state.entries.filter(e=>e.status==='approved');if(!entries.length)throw new Error('沒有核准的版本');
  const next=mergeApproved(catalog,entries);
  const batch={createdAt:new Date().toISOString(),base:digest(catalog),entries:entries.map(e=>({id:e.shop.id,revision:e.revision})),catalog:next};
  mkdirSync(resolve(root,'research/snapshots'),{recursive:true});save('research/prepared.json',batch);
  console.log('已準備核准批次，尚未修改正式資料或部署。');
}else{throw new Error('用法: list | add <JSON路徑> | approve/reject <ID> <完整revision> | prepare');}
