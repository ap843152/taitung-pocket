import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FIND,parseNeeds,findShops,validateFind} from '../dist/finder.mjs';
const now={date:'2026-11-04',time:'12:00'},hours=Object.fromEntries(Array.from({length:7},(_,i)=>[i,[['11:00','14:00']]]));
const meal=(type,price)=>({name:type+'主餐',kind:'main',type,priceTwd:price,sourceUrl:'https://example.org/menu',checkedAt:'2026-11-04'});
const shop=(id,patch={})=>({id,name:id,address:'臺東市測試路',description:'麵食與飯類',tags:[],categories:['餐廳'],hours,exceptions:{},lat:22.75215,lng:121.14805,sources:[{url:'https://example.org/menu'}],lunchOptions:[meal('noodles',80)],...patch});
test('整合語句辨識餐點、預算與營業；未提到的限制保持不限',()=>{
 const result=parseNeeds('想吃麵，100元內，現在有開');assert.deepEqual(result.issues,[]);assert.equal(result.values.query,'');assert.equal(result.values.mealType,'noodles');assert.equal(result.values.budget,100);assert.equal(result.values.timeMode,'now');
 assert.equal(parseNeeds('海風').values.budget,null);assert.equal(parseNeeds('海風').values.timeMode,'any');assert.equal(parseNeeds('一百元內').values.budget,100);
 const coffee=parseNeeds('找咖啡店');assert.equal(coffee.values.category,'咖啡店');assert.equal(coffee.values.query,'');
});
test('候餐與完成時間只提示未套用，不轉成預算或假造時間篩選',()=>{
 for(const text of ['1小時內吃完','半小時結束，不用等太久','午餐簡單吃，100元內，1小時結束，不想排隊']){
  const p=parseNeeds(text);assert.deepEqual(p.issues,[],text);assert.equal(p.values.query,'',text);assert.ok(p.notes.length);assert.equal('totalMinutes' in p.values,false);assert.equal('shortWait' in p.values,false);
 }
});
test('矛盾、歧義與未指定日期不能默默採用',()=>{
 for(const text of ['100元內，200元內','吃麵，不要麵','一百五元內','明天吃麵','100到200元','0元內'])assert.ok(parseNeeds(text).issues.length,text);
 assert.ok(validateFind({...DEFAULT_FIND,timeMode:'custom',local:null}).length);
 const p=parseNeeds('現在有開',{...DEFAULT_FIND,timeMode:'custom',local:now});assert.equal(p.values.local,null);assert.equal(p.values.timeMode,'now');
});
test('不限預算可探索未定價店；預算與餐點須符合相同有來源的主餐，不限三家',()=>{
 const many=Array.from({length:5},(_,i)=>shop('valid-'+i));
 const data=[...many,shop('missing',{lunchOptions:undefined}),shop('mixed',{lunchOptions:[meal('rice',50),meal('noodles',150)]}),shop('wrong-source',{lunchOptions:[{...meal('noodles',50),sourceUrl:'https://other.example/menu'}]}),shop('side-only',{lunchOptions:[{...meal('noodles',50),kind:'side'}]})];
 assert.equal(findShops(data,DEFAULT_FIND,{},null,now).matches.length,9);
 const r=findShops(data,{...DEFAULT_FIND,mealType:'noodles',budget:100},{},null,now);assert.equal(r.matches.length,5);assert.equal(r.diagnostics.missingPrice,3);assert.equal(r.diagnostics.overBudget,1);
});
test('營業、分類、收藏、造訪、位置與餐點預算同時交集，未知時間不算營業',()=>{
 const data=[shop('okay'),shop('unknown',{hours:null}),shop('far',{lat:23}),shop('visited'),shop('coffee',{categories:['咖啡店']})];
 const records=Object.fromEntries(data.map(s=>[s.id,{saved:true,visited:s.id==='visited',note:''}]));
 const f={...DEFAULT_FIND,category:'餐廳',mealType:'noodles',budget:100,timeMode:'now',saved:true,visited:'no',radius:'1'};
 assert.deepEqual(findShops(data,f,records,[22.75215,121.14805],now).matches.map(m=>m.shop.id),['okay']);
 assert.equal(findShops([data[1]],{...f,timeMode:'any'},records,null,now).matches.length,1);
});
test('無價格餐點篩選可依已收錄文字，不把飯店或麵包誤認成主餐',()=>{
 const data=[shop('rice',{description:'提供燉飯',lunchOptions:undefined}),shop('hotel',{description:'飯店餐廳',lunchOptions:undefined}),shop('bread',{description:'手作麵包',lunchOptions:undefined})];
 assert.deepEqual(findShops(data,{...DEFAULT_FIND,mealType:'rice'},{},null,now).matches.map(x=>x.shop.id),['rice']);
 assert.equal(findShops(data,{...DEFAULT_FIND,mealType:'noodles'},{},null,now).matches.length,0);
});
