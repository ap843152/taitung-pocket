import {readFileSync,writeFileSync,cpSync,mkdirSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {digest,contentDigest,mergeApproved,verifyApproved} from './content.mjs';
import {loadCatalog,writeCatalog} from './catalog.mjs';
import {loadState,saveState} from './state.mjs';
import {syncPublic} from './sync-public.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const save=(p,v)=>writeFileSync(resolve(root,p),JSON.stringify(v,null,2)+'\n');
const state=read('research/state.json'),catalog=loadCatalog(),batch=read('research/prepared.json');
const entries=batch.entries.map(({id,revision})=>{const e=state.entries.find(x=>x.shop.id===id&&x.revision===revision);if(!e)throw new Error('候選版本已變更');return verifyApproved(e);});
const alreadyApplied=contentDigest(catalog)===contentDigest(batch.catalog);
if(!alreadyApplied&&digest(catalog)!==batch.base&&contentDigest(catalog)!==batch.base)throw new Error('正式資料已變更，請重新準備');
const next=alreadyApplied?catalog:mergeApproved(catalog,entries);
if(contentDigest(next)!==contentDigest(batch.catalog))throw new Error('準備資料與核准內容不符');
for(const e of entries)if(contentDigest(next.shops.find(s=>s.id===e.shop.id))!==contentDigest(e.shop))throw new Error('資料與核准店家不符');
if(process.argv.includes('--check')){console.log(`發布預檢通過：${entries.length}筆核准版本。未發布。`);process.exit(0);}
if(process.argv.includes('--reconcile')){
  const response=await fetch('https://ap843152.github.io/taitung-pocket/shops.json?verify='+Date.now(),{signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(!response.ok||contentDigest(await response.json())!==contentDigest(next))throw new Error('HTTPS正式資料不符，不標記published');
  const path=resolve(root,'research/state.json'),current=loadState(path);
  for(const item of batch.entries){const e=current.value.entries.find(x=>x.shop.id===item.id&&x.revision===item.revision&&x.status==='approved');if(!e)throw new Error('核准紀錄已變');verifyApproved(e);e.status='published';e.publishedAt=new Date().toISOString();}
  saveState(path,current.value,current.version);console.log('HTTPS資料已核對，該批次已標記published。');process.exit(0);
}
if(!process.argv.includes('--stage'))throw new Error('使用 --check / --stage / --reconcile；正式推送只在本輪內容核准後進行。');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),snapshot=resolve(root,'research/snapshots',stamp);
mkdirSync(snapshot,{recursive:true});cpSync(resolve(root,'content'),resolve(snapshot,'content'),{recursive:true});cpSync(resolve(root,'dist'),resolve(snapshot,'dist'),{recursive:true});
try{
  writeCatalog(next);
  for(const args of [['scripts/build.mjs'],['--test','tests/core.test.mjs','tests/controller.test.mjs','tests/content.test.mjs','tests/lunch.test.mjs']]){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.status!==0)throw new Error('發布前驗收未通過，未推送');}
  const stage=syncPublic(root);
  save('research/staged.json',{stamp,snapshot,stage,batch:batch.entries,catalogHash:digest(next)});
  console.log('已建立可公開的GitHub上傳目錄，尚未推送或部署。');
}catch(error){writeCatalog(catalog);cpSync(resolve(snapshot,'content'),resolve(root,'content'),{recursive:true});cpSync(resolve(snapshot,'dist'),resolve(root,'dist'),{recursive:true});throw error;}
