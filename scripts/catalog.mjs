import {readFileSync,writeFileSync,readdirSync,mkdirSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateCatalog} from './content.mjs';
export const contentRoot=fileURLToPath(new URL('../content/',import.meta.url));
// JSON is a YAML-compatible front matter subset; no runtime dependency needed.
export function parseMarkdown(text){
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if(!match)throw new Error('Markdown 缺少資料欄位');
  const {introType,...shop}=JSON.parse(match[1]);
  if(!['long','summary'].includes(introType))throw new Error('介紹格式無效');
  if(introType==='long')shop.longIntro=match[2].trim();
  else if(match[2].trim()!==shop.description)throw new Error('摘要與內文不符');
  return shop;
}
export function formatMarkdown(shop){const {longIntro,...meta}=shop;return '---\n'+JSON.stringify({...meta,introType:longIntro?'long':'summary'},null,2)+'\n---\n\n'+(longIntro||shop.description)+'\n';}
export function loadCatalog(root=contentRoot){
  const manifest=JSON.parse(readFileSync(resolve(root,'catalog.json'),'utf8'));
  if(!Array.isArray(manifest.ids)||new Set(manifest.ids).size!==manifest.ids.length||manifest.ids.some(id=>!/^[a-z0-9-]{1,80}$/.test(id)))throw new Error('店家索引無效');
  const {ids,...data}=manifest;data.shops=ids.map(id=>{const s=parseMarkdown(readFileSync(resolve(root,'shops',id+'.md'),'utf8'));if(s.id!==id)throw new Error('檔名與ID不符');return s;});
  const actual=readdirSync(resolve(root,'shops')).filter(n=>n.endsWith('.md')).sort();
  if(JSON.stringify(actual)!==JSON.stringify(ids.map(id=>id+'.md').sort()))throw new Error('店家索引與Markdown檔案不一致');
  return validateCatalog(data);
}
export function writeCatalog(data,root=contentRoot){
  validateCatalog(data);mkdirSync(resolve(root,'shops'),{recursive:true});
  const {shops,...meta}=data;
  const ids=new Set(shops.map(s=>s.id));for(const name of readdirSync(resolve(root,'shops')))if(/^[a-z0-9-]+\.md$/.test(name)&&!ids.has(name.slice(0,-3)))unlinkSync(resolve(root,'shops',name));
  for(const shop of shops)writeFileSync(resolve(root,'shops',shop.id+'.md'),formatMarkdown(shop));
  writeFileSync(resolve(root,'catalog.json'),JSON.stringify({...meta,ids:shops.map(s=>s.id)},null,2)+'\n');
}
