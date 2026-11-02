import {createHash} from 'node:crypto';
import {CATEGORIES,CENTER,distanceKm} from '../dist/core.mjs';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=message=>{throw new Error(message);};
const url=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
export function validateShop(s,{candidate=false}={}) {
  if(!s || !/^[a-z0-9-]{1,80}$/.test(s.id)||['constructor','prototype','__proto__'].includes(s.id))fail('店家 ID 無效');
  for(const k of ['name','address','description','hoursText','checkedAt','coordinateNote'])if(typeof s[k]!=='string'||!s[k].trim())fail(`缺少 ${k}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt))fail('查核日期無效');
  if(!Array.isArray(s.categories)||!s.categories.length||s.categories.some(c=>!CATEGORIES.includes(c)))fail('分類無效');
  if(!Array.isArray(s.tags)||s.tags.some(t=>typeof t!=='string'))fail('特色無效');
  if(!Number.isFinite(s.lat)||!Number.isFinite(s.lng)||distanceKm(CENTER,[s.lat,s.lng])>3.1)fail('座標不在市中心範圍');
  if(!url(s.coordinateSource)||!url(s.officialUrl)||!Array.isArray(s.sources)||!s.sources.length||s.sources.some(x=>!x.label||!url(x.url)))fail('來源不完整或非 HTTPS');
  const time=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const day=d=>d===null||Array.isArray(d)&&d.every(p=>Array.isArray(p)&&p.length===2&&p.every(time)&&p[0]!==p[1]);
  if(s.hours!==null && (!s.hours||Array.from({length:7},(_,i)=>i).some(i=>!Object.hasOwn(s.hours,i)||!day(s.hours[i]))))fail('每週時段無效');
  if(!s.exceptions||Object.entries(s.exceptions).some(([d,v])=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!day(v)))fail('例外日期無效');
  if(candidate && (typeof s.longIntro!=='string'||[...s.longIntro].length<150||[...s.longIntro].length>300))fail('介紹須為150–300字');
  if(s.price!==null && typeof s.price!=='string')fail('價格無效');
  return s;
}
export function validateCatalog(data){
  if(!data||!Array.isArray(data.shops))fail('資料集格式錯誤');
  const ids=new Set();for(const s of data.shops){validateShop(s);if(ids.has(s.id))fail('重複 ID');ids.add(s.id);}return data;
}
const normalize=s=>s.normalize('NFKC').replaceAll('臺','台').replace(/[\s\p{P}]/gu,'').toLowerCase();
export function addDraft(state,catalog,shop,evidence,{update=false}={}){
  validateShop(shop,{candidate:true});
  if(!Array.isArray(evidence)||!evidence.length||!evidence.some(e=>['official','government'].includes(e.kind)&&url(e.url)&&shop.sources.some(s=>s.url===e.url)&&e.readAt&&e.excerpt))fail('缺少已讀第一手來源證據');
  if(update&&!catalog.shops.some(s=>s.id===shop.id))fail('修正對象不存在');
  const all=[...catalog.shops.filter(s=>!update||s.id!==shop.id),...state.entries.filter(e=>e.status!=='published').map(e=>e.shop)];
  if(all.some(s=>s.id===shop.id||normalize(s.name)===normalize(shop.name)||normalize(s.address)===normalize(shop.address)))fail('已存在、已否決或待審的店家');
  if(state.entries.filter(e=>e.status==='pending').length>=3)fail('待審已滿3間');
  const payload={shop,evidence,operation:update?'update':'add'};const entry={...payload,revision:digest(payload),status:'pending',createdAt:new Date().toISOString()};state.entries.push(entry);return entry;
}
export function decide(entry,revision,decision){
  if(!['approved','rejected'].includes(decision)||entry.status!=='pending'||revision!==entry.revision||revision!==digest({shop:entry.shop,evidence:entry.evidence,operation:entry.operation}))fail('狀態或版本不符，需重新審核');
  entry.status=decision;entry.decidedAt=new Date().toISOString();entry.approvedRevision=decision==='approved'?revision:null;
}
export function verifyApproved(e){if(e.status!=='approved'||e.approvedRevision!==e.revision||e.revision!==digest({shop:e.shop,evidence:e.evidence,operation:e.operation}))fail('尚未核准此版本');validateShop(e.shop,{candidate:true});return e;}
export function mergeApproved(catalog,entries){
  const next=structuredClone(catalog);
  for(const e of entries){verifyApproved(e);const index=next.shops.findIndex(s=>s.id===e.shop.id);if(e.operation==='update'){if(index<0)fail('修正對象不存在');next.shops[index]=structuredClone(e.shop);}else{if(index>=0)fail('店家已存在');next.shops.push(structuredClone(e.shop));}}
  next.checkedAt=next.shops.map(s=>s.checkedAt).sort().at(-1);return validateCatalog(next);
}
