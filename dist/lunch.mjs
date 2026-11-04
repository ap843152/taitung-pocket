import {openingStatus,distanceKm,taiwanParts} from './core.mjs?v=a3a1a722f366';
export const MEAL_TYPES={simple:'麵、飯或便當',noodles:'麵食',rice:'飯類',bento:'便當'};
export const DEFAULT_LUNCH={mealType:'simple',excludedTypes:[],budget:100,totalMinutes:60,shortWait:true,departure:null};
const numberToken='(?:\\d+(?:\\.\\d+)?|[零〇一二兩三四五六七八九十百千]+|半)';
export {numberToken,number as parseNumber};
function number(text){
  if(text==='半')return .5;if(/^\d+(\.\d+)?$/.test(text))return Number(text);
  if(/[百千][一二兩三四五六七八九]$/.test(text))return NaN;
  const digits={零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000};
  if(!/[十百千]/.test(text))return Number([...text].map(c=>digits[c]).join(''));
  let n=0,last=0;for(const c of text){if(c in digits)last=digits[c];else{n+=(last||1)*units[c];last=0;}}return n+last;
}
export function parseLunch(text,current=DEFAULT_LUNCH){
  let input=String(text).normalize('NFKC').replaceAll('麵條','麵');
  const values={...current,excludedTypes:[...(current.excludedTypes||[])]},issues=[];let recognized=0;
  const eat=(regex,fn)=>{input=input.replace(regex,(...args)=>{recognized++;fn?.(...args);return ' ';});};
  eat(/現在出發|現在/g,()=>values.departure=null);
  if(/[百千][一二兩三四五六七八九](?:元|塊|內|小時|分鐘)/.test(input))issues.push('中文省略數字有歧義，請改寫完整數字，例如150元內。');
  const budgets=[];eat(new RegExp(`(?:每人\\s*)?預算\\s*(${numberToken})\\s*(?:元|塊)?\\s*(?:以內|以下|內)?|(?:每人\\s*)?(${numberToken})\\s*(?:元|塊)\\s*(?:以內|以下|內)?|(${numberToken})\\s*(?:以內|以下|內)`,'g'),(_,a,b,c)=>budgets.push(number(a||b||c)));
  if(/\d\s*(?:到|至|[-~～])\s*\d/.test(String(text)))issues.push('預算範圍請改成單一上限，例如100元內。');
  if(new Set(budgets).size>1)issues.push('出現多個預算，請手動選擇每人上限。');else if(budgets.length)values.budget=budgets[0];
  const durations=[];eat(new RegExp(`(${numberToken})\\s*小時(?:\\s*(${numberToken})\\s*分鐘|\\s*(半))?|(${numberToken})\\s*分鐘`,'g'),(_,h,m,half,mins)=>durations.push(h?number(h)*60+(m?number(m):half?30:0):number(mins)));
  if(new Set(durations).size>1)issues.push('出現多個時間，請手動選擇總時間。');else if(durations.length)values.totalMinutes=durations[0];
  if(/車程|候餐\s*\d|等\s*\d/.test(String(text)))issues.push('第一版只辨識從出發到吃完的總時間，請確認分鐘欄位。');
  const types=[['noodles',/麵食|麵/],['bento',/便當/],['rice',/飯類|飯/]];
  const wanted=[];
  for(const [type,re] of types){eat(new RegExp(`(?:不要|不吃|不想吃)\\s*(?:${re.source})`,'g'),()=>{if(!values.excludedTypes.includes(type))values.excludedTypes.push(type);});eat(new RegExp(re.source,'g'),()=>wanted.push(type));}
  if(new Set(wanted).size===1)values.mealType=wanted[0];else if(wanted.length>1)issues.push('有多種餐點偏好，請在條件中選擇一種或「麵、飯或便當」。');
  eat(/(?:不用等太久|不想排隊|不要排隊|不排隊|快一點|快速|少等候)/g,()=>values.shortWait=true);
  eat(/簡單吃|簡餐/g,()=>{if(!wanted.length)values.mealType='simple';});
  eat(/午餐|中餐/g);
  eat(/騎機車|機車/g);
  input=input.replace(/現在出發|出發|吃完|結束|總共|一共|每人|我想要|我想|我要|想要|想吃|吃|幫我|找|推薦|希望|可以|大概|台東|臺東|附近|就好|不用|請|的|在|用|和|跟|再|要|共|內|[\s，,。.!！?？、；;：:]/g,'');
  if(input)issues.push(`尚未辨識「${input.slice(0,40)}」，請用下方欄位確認；本次不會猜測。`);
  if(!recognized&&String(text).trim())issues.push('沒有辨識到午餐條件，請手動設定。');
  if(!Number.isFinite(values.budget)||values.budget<1||values.budget>10000)issues.push('預算須為1–10000元。');
  if(!Number.isInteger(values.totalMinutes)||values.totalMinutes<1||values.totalMinutes>600)issues.push('總時間須為1–600分鐘。');
  if(values.excludedTypes.includes(values.mealType))issues.push('想吃與排除的餐點相同，請修改條件。');
  return {values,issues:[...new Set(issues)]};
}
export function lunchCandidates(shops,conditions,position=null,now=taiwanParts()){
  const when=conditions.departure||now,diagnostics={missingMeal:0,overBudget:0,closed:0,excluded:0};
  const matches=[];
  for(const shop of shops){
    const meals=(shop.lunchOptions||[]).filter(m=>m.kind==='main'&&['noodles','rice','bento'].includes(m.type)&&Number.isFinite(m.priceTwd)&&m.priceTwd>0&&m.sourceUrl&&m.checkedAt);
    if(!meals.length){diagnostics.missingMeal++;continue;}
    const typed=meals.filter(m=>!(conditions.excludedTypes||[]).includes(m.type)&&(conditions.mealType==='simple'||m.type===conditions.mealType));
    if(!typed.length){diagnostics.excluded++;continue;}
    const affordable=typed.filter(m=>m.priceTwd<=conditions.budget).sort((a,b)=>a.priceTwd-b.priceTwd||a.name.localeCompare(b.name,'zh-Hant'));
    if(!affordable.length){diagnostics.overBudget++;continue;}
    const status=openingStatus(shop,when);if(status==='closed'){diagnostics.closed++;continue;}
    matches.push({shop,meal:affordable[0],status,distance:position?distanceKm(position,[shop.lat,shop.lng]):null});
  }
  matches.sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||(position?a.distance-b.distance:0)||a.meal.priceTwd-b.meal.priceTwd||a.shop.id.localeCompare(b.shop.id));
  return {matches:matches.slice(0,3),total:matches.length,diagnostics,when};
}
