import {filterShops,taiwanParts} from './core.mjs?v=a3a1a722f366';
import {numberToken,parseNumber} from './lunch.mjs?v=b2bcc51cabbd';
export const MEAL_TYPES={any:'不限餐點',simple:'麵、飯或便當',noodles:'麵食',rice:'飯類',bento:'便當'};
export const DEFAULT_FIND={query:'',category:'',mealType:'any',budget:null,excludedTypes:[],timeMode:'any',local:null,saved:false,visited:'all',radius:''};
const normalize=s=>String(s).normalize('NFKC').replaceAll('臺','台').toLocaleLowerCase();
export function validateFind(f){
 const issues=[];
 if(f.budget!==null&&(!Number.isFinite(f.budget)||f.budget<1||f.budget>10000))issues.push('每人預算請填1–10000元，或留空表示不限。');
 if(f.timeMode==='custom'&&(!f.local?.date||!f.local?.time||!Number.isFinite(Date.parse(f.local.date+'T'+f.local.time+':00+08:00'))))issues.push('請選擇有效的日期與時間。');
 if((f.excludedTypes||[]).includes(f.mealType))issues.push('想吃與排除的餐點相同，請修改條件。');
 return issues;
}
export function parseNeeds(text,current=DEFAULT_FIND){
 let input=normalize(text),recognized=0;
 const values={...current,excludedTypes:[...(current.excludedTypes||[])]},issues=[],notes=[];
 const eat=(re,fn)=>{input=input.replace(re,(...a)=>{recognized++;fn?.(...a);return ' ';});};
 if(/[百千][一二兩三四五六七八九](?:元|塊|內)/.test(input))issues.push('中文省略數字有歧義，請寫完整數字，例如150元內。');
 if(/\d\s*(?:到|至|[-~～])\s*\d/.test(input))issues.push('預算請使用單一上限，例如100元內。');
 eat(/不限預算|預算不限|不設預算/g,()=>values.budget=null);
 const budgets=[];
 eat(new RegExp(`(?:每人\\s*)?預算\\s*(${numberToken})\\s*(?:元|塊)?\\s*(?:以內|以下|內)?|(?:每人\\s*)?(${numberToken})\\s*(?:元|塊)\\s*(?:以內|以下|內)?|(${numberToken})\\s*(?:以內|以下|內)`,'g'),(_,a,b,c)=>budgets.push(parseNumber(a||b||c)));
 if(new Set(budgets).size>1)issues.push('出現多個預算，請選擇一個每人上限。');else if(budgets.length)values.budget=budgets[0];
 eat(/不限時間|不限營業時間/g,()=>{values.timeMode='any';values.local=null;});
 eat(/現在(?:有開|營業|有營業|出發)?|營業中/g,()=>{values.timeMode='now';values.local=null;});
 eat(new RegExp(`(?:(${numberToken})\\s*小時(?:\\s*(${numberToken})\\s*分鐘|半)?|(${numberToken})\\s*分鐘)(?:以內|內)?`,'g'),()=>notes.push('目前不以交通、候餐或用餐時間篩選。'));
 eat(/不用等太久|不想排隊|不要排隊|不排隊|少等候|快一點|快速/g,()=>notes.push('目前沒有即時候餐資料，未套用排隊時間條件。'));
 if(/明天|後天|今天中午|今晚|\d{1,2}[點:：]\d{0,2}/.test(input))issues.push('指定時間請用下方「營業時間」欄位設定。');
 const categories=[];
 for(const [category,re] of [['早午餐',/早午餐/g],['咖啡店',/咖啡店|咖啡廳|咖啡/g],['甜品店',/甜品店|甜點店|甜點|甜品/g],['餐廳',/餐廳/g]])eat(re,()=>categories.push(category));
 if(new Set(categories).size>1)issues.push('出現多個分類，請在分類按鈕選擇一種。');else if(categories.length)values.category=categories[0];
 eat(/午餐|中餐|晚餐/g,()=>{if(!categories.length)values.category='餐廳';});
 eat(/簡單吃|簡餐/g,()=>{values.mealType='simple';});
 const wanted=[];
 for(const [type,word] of [['noodles','麵食|麵(?!包)|米苔目'],['rice','飯類|飯(?!店)'],['bento','便當']]){
  eat(new RegExp(`(?:不要|不吃|不想吃)\\s*(?:${word})`,'g'),()=>{if(!values.excludedTypes.includes(type))values.excludedTypes.push(type);});
  eat(new RegExp(word,'g'),()=>wanted.push(type));
 }
 if(new Set(wanted).size>1)issues.push('出現多種餐點偏好，請在「想吃什麼」選擇一種或「麵、飯或便當」。');else if(wanted.length)values.mealType=wanted[0];
 input=input.replace(/(?:吃完|結束|總共|一共|每人|我想要|我想|我要|想要|想吃|幫我|推薦|希望|大概|就好|請|共|找|吃)|[\s，,。.!！?？、；;：:]/g,'').trim();
 // The remainder is an ordinary keyword, never a guessed preference or restaurant fact.
 values.query=input;
 issues.push(...validateFind(values));
 return {values,issues:[...new Set(issues)],notes:[...new Set(notes)],recognized};
}
const typeWords={noodles:/麵(?!包)|米苔目/,rice:/飯(?!店)|米糕/,bento:/便當/};
function verifiedMeals(shop){return (shop.lunchOptions||[]).filter(m=>m.kind==='main'&&['noodles','rice','bento'].includes(m.type)&&Number.isFinite(m.priceTwd)&&m.priceTwd>0&&m.checkedAt&&shop.sources.some(s=>s.url===m.sourceUrl));}
function hasType(shop,type,meals){return meals.some(m=>m.type===type)||typeWords[type].test([shop.description,...shop.tags].join(' '));}
export function findShops(shops,conditions,records={},position=null,now=taiwanParts()){
 const base=filterShops(shops,{...conditions,query:''},records,position,now),matches=[];
 const diagnostics={missingPrice:0,overBudget:0,mealMismatch:0};
 const query=normalize(conditions.query||'').trim();
 for(const shop of base){
  const all=verifiedMeals(shop);
  if(query&&!normalize([shop.name,shop.address,shop.description,...shop.tags,...all.map(m=>m.name)].join(' ')).includes(query))continue;
  const excluded=conditions.excludedTypes||[];
  // When prices are available, type and budget must match the SAME main dish.
  const typed=all.filter(m=>!excluded.includes(m.type)&&(conditions.mealType==='any'||conditions.mealType==='simple'||m.type===conditions.mealType));
  if(conditions.budget!==null){
   if(!all.length){diagnostics.missingPrice++;continue;}
   if(!typed.length){diagnostics.mealMismatch++;continue;}
   const affordable=typed.filter(m=>m.priceTwd<=conditions.budget).sort((a,b)=>a.priceTwd-b.priceTwd);
   if(!affordable.length){diagnostics.overBudget++;continue;}
   matches.push({shop,meal:affordable[0]});continue;
  }
  const possible=['noodles','rice','bento'].filter(type=>hasType(shop,type,all)&&!excluded.includes(type));
  if((conditions.mealType==='simple'||excluded.length)&&!possible.length||!['any','simple'].includes(conditions.mealType)&&!possible.includes(conditions.mealType)){diagnostics.mealMismatch++;continue;}
  matches.push({shop,meal:null});
 }
 return {matches,diagnostics};
}
