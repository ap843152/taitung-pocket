import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadCatalog} from '../scripts/catalog.mjs';
import {addDraft,decide,digest,mergeApproved} from '../scripts/content.mjs';
test('發布前測試失敗會還原Markdown與JSON，不推送也不標published',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'.runtime');mkdirSync(base,{recursive:true});
  const dir=mkdtempSync(join(base,'failure-test-'));try{
    for(const name of ['scripts','dist','content'])cpSync(resolve(root,name),resolve(dir,name),{recursive:true});
    const catalog=loadCatalog(),state={entries:[]};
    const shop={...structuredClone(catalog.shops[0]),id:'release-test',name:'測試候選',address:'臺東市測試路1號',longIntro:'僅供測試使用。'.repeat(22)};
    const e=addDraft(state,catalog,shop,[{kind:'government',url:shop.sources[0].url,readAt:'2026-11-02',excerpt:'測試證據'}]);decide(e,e.revision,'approved');
    mkdirSync(resolve(dir,'research'));mkdirSync(resolve(dir,'tests'));
    const write=(p,data)=>writeFileSync(resolve(dir,p),JSON.stringify(data));write('research/state.json',state);write('research/prepared.json',{base:digest(catalog),entries:[{id:shop.id,revision:e.revision}],catalog:mergeApproved(catalog,[e])});
    for(const name of ['core','controller','content'])writeFileSync(resolve(dir,`tests/${name}.test.mjs`),name==='core'?"throw new Error('intentional release failure');":'');
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,['scripts/publish.mjs','--stage'],{cwd:dir,encoding:'utf8',env});
    assert.notEqual(result.status,0);assert.match(result.stderr,/發布前驗收未通過/);assert.deepEqual(loadCatalog(resolve(dir,'content')),catalog);
    assert.deepEqual(JSON.parse(readFileSync(resolve(dir,'dist/shops.json'))),catalog);assert.equal(JSON.parse(readFileSync(resolve(dir,'research/state.json'))).entries[0].status,'approved');
  }finally{rmSync(dir,{recursive:true});}
});
