import {CATEGORIES,STORAGE_KEY,CENTER,validateBackup,mergeRecords,persist,taiwanParts,openingStatus,filterShops,distanceKm,markerLayout} from './core.mjs?v=a3a1a722f366';
import {DEFAULT_FIND,MEAL_TYPES,parseNeeds,findShops,validateFind} from './finder.mjs?v=941df920f3f4';
const $=s=>document.querySelector(s), el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let records=Object.create(null), shops=[],position=null,map=null,markers=null,userMarker=null,selected=null,timer,storageOkay=true;
const filters={...DEFAULT_FIND,excludedTypes:[]};
let queryIssues=[],needsNotes=[],recommendations=new Map(),diagnostics={};
function resultList(){const result=findShops(shops,filters,records,position);recommendations=new Map(result.matches.filter(m=>m.meal).map(m=>[m.shop.id,m]));diagnostics=result.diagnostics;return queryIssues.length||validateFind(filters).length?[]:result.matches.map(m=>m.shop);}
function syncFields(){
  $('#meal-type').value=filters.mealType;$('#budget').value=filters.budget===null?'':String(filters.budget);
  $('#time-mode').value=filters.timeMode;$('#custom-time-wrap').hidden=filters.timeMode!=='custom';
  $('#custom-time').value=filters.local?filters.local.date+'T'+filters.local.time:'';
  $('#saved').value=filters.saved?'saved':'all';$('#visited').value=filters.visited;$('#radius').value=filters.radius;
}
function changed(){queryIssues=[];render();fitMap();}
function applyNeeds(){
  const parsed=parseNeeds($('#query').value,filters);needsNotes=parsed.notes;queryIssues=parsed.issues;
  if(!queryIssues.length){Object.assign(filters,parsed.values);$('#query').value=filters.query;syncFields();}
  render();fitMap();
}
function renderChips(){
  const chips=[];
  const add=(label,clear)=>{const b=el('button','filter-chip',label+' ×');b.setAttribute('aria-label','移除條件：'+label);b.onclick=()=>{clear();syncFields();changed();};chips.push(b);};
  if(filters.category)add(filters.category,()=>filters.category='');
  if(filters.mealType!=='any')add(MEAL_TYPES[filters.mealType],()=>filters.mealType='any');
  if(filters.budget!==null)add('每人'+filters.budget+'元內',()=>filters.budget=null);
  if(filters.timeMode!=='any')add(filters.timeMode==='now'?'現在營業':filters.local?filters.local.date+' '+filters.local.time:'指定時間',()=>{filters.timeMode='any';filters.local=null;});
  if(filters.query)add('搜尋：'+filters.query,()=>{filters.query='';$('#query').value='';});
  if(filters.saved)add('已收藏',()=>filters.saved=false);
  if(filters.visited!=='all')add(filters.visited==='yes'?'已去過':'尚未標記去過',()=>filters.visited='all');
  if(position&&filters.radius)add(filters.radius+'公里內',()=>filters.radius='');
  for(const type of filters.excludedTypes)add('不吃'+MEAL_TYPES[type],()=>filters.excludedTypes=filters.excludedTypes.filter(t=>t!==type));
  $('#filter-chips').replaceChildren(...chips);
}
function toast(message,error=false){clearTimeout(timer);$('#toast').textContent=message;$('#toast').classList.toggle('error',error);$('#toast').hidden=false;timer=setTimeout(()=>$('#toast').hidden=true,6500);}
try {const raw=localStorage.getItem(STORAGE_KEY);if(raw)records=validateBackup(JSON.parse(raw));}catch{storageOkay=false;toast('無法讀取瀏覽器紀錄。原資料未覆蓋，請先檢查備份。',true);}
function write(next){try{persist(localStorage,next);records=next;storageOkay=true;return true;}catch{storageOkay=false;toast('儲存失敗，這次變更未保存。請確認瀏覽器允許儲存，或先匯出備份。',true);return false;}}
function update(id,patch){const previous=records[id]||{saved:false,visited:false,note:''};return write({...records,[id]:{...previous,...patch}});}
const link=(text,url)=>{const a=el('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
function statusView(s){const when=filters.timeMode==='custom'?filters.local:taiwanParts();const st=openingStatus(s,when),badge=el('span',`status ${st}`,{open:'依時段推算營業',closed:'依時段推算休息',unknown:''}[st]);badge.hidden=st==='unknown';return badge;}
function mapUrl(s){return s.mapUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name+' '+s.address)}`;}
function selectShop(s){selected=s.id;document.querySelectorAll('.card').forEach(c=>c.classList.toggle('selected',c.dataset.id===s.id));if(map){map.setView([s.lat,s.lng],16);const marker=markers.getLayers().find(m=>m.shopId===s.id);marker?.openPopup();}if(document.body.classList.contains('map-view')){const box=$('#map-detail');box.replaceChildren(card(s,true));box.hidden=false;}}
function card(s,compact=false){
  const r=records[s.id]||{saved:false,visited:false,note:''};
  const article=el('article',`card${selected===s.id?' selected':''}`);article.dataset.id=s.id;
  const head=el('div','card-heading'),titleWrap=el('div');titleWrap.append(el('p','card-kicker',s.categories.join(' / ')));
  const title=el('button','card-title',s.name);title.onclick=()=>selectShop(s);title.title='在地圖查看位置';titleWrap.append(title);
  const save=el('button','save',r.saved?'♥':'♡');save.setAttribute('aria-label',`${r.saved?'取消收藏':'收藏'} ${s.name}`);save.setAttribute('aria-pressed',r.saved);save.onclick=()=>{if(update(s.id,{saved:!r.saved})){render();toast(r.saved?'已取消收藏':'已放進你的口袋名單');}};head.append(titleWrap,save);article.append(head);
  article.append(el('p','description',s.description));
  if(recommendations.has(s.id)){const m=recommendations.get(s.id),box=el('div','meal-match');box.append(el('strong','',`${m.meal.name} · NT$${m.meal.priceTwd}`),link('菜單來源 ↗',m.meal.sourceUrl));article.append(box);}
  if(s.longIntro){const intro=el('details','details');intro.append(el('summary','','認識這間店'),el('p','',s.longIntro));article.append(intro);}
  const tags=el('div','tags');s.tags.forEach(t=>tags.append(el('span','tag',t)));article.append(tags);
  const status=el('div');status.append(statusView(s));if(position)status.append(el('span','distance',`${distanceKm(position,[s.lat,s.lng]).toFixed(1)} km · 直線`));article.append(status);
  article.append(el('p','meta','⌖ '+s.address));if(s.price&&!recommendations.has(s.id))article.append(el('p','meta','參考消費：'+s.price));
  const bottom=el('div','card-bottom'),visit=el('button','visit',r.visited?'✓ 已去過':'○ 標記去過');visit.setAttribute('aria-label',`${r.visited?'取消去過紀錄':'標記去過'} ${s.name}`);visit.setAttribute('aria-pressed',r.visited);visit.onclick=()=>{if(update(s.id,{visited:!r.visited})){render();toast(r.visited?'已取消去過標記':'已記下這次造訪');}};
  bottom.append(visit,link('照片・導航 ↗',mapUrl(s)));article.append(bottom);
  if(r.saved){const label=el('label','note-label','口袋備註'),note=el('textarea');note.maxLength=500;note.value=r.note;note.placeholder='例如：太太想去、下次吃甜點';note.setAttribute('aria-label',`${s.name} 的口袋備註`);note.onchange=()=>{if(update(s.id,{note:note.value}))toast('備註已保存');};label.append(note);article.append(label);}
  const detail=el('details','details');detail.append(el('summary','','資料與營業時間'));
  if(s.hours!==null)detail.append(el('p','',s.hoursText));detail.append(el('p','',`查核日期：${s.checkedAt}`));
  const sources=el('ul');s.sources.forEach(source=>{const li=el('li');li.append(link(source.label,source.url));sources.append(li);});detail.append(sources);
  detail.append(el('p','',`位置核對：${s.coordinateNote}`));
  if(s.officialUrl)detail.append(link('查看店家官方資訊 ↗',s.officialUrl));
  article.append(detail);if(compact)article.style.border='0';return article;
}
function setView(mode){document.body.classList.toggle('map-view',mode==='map');$('#view-list').setAttribute('aria-pressed',mode==='list');$('#view-map').setAttribute('aria-pressed',mode==='map');if(map)requestAnimationFrame(()=>map.invalidateSize());}
function render(){
  const list=resultList();
  $('#cards').replaceChildren(...list.map(s=>card(s)));$('#count').textContent=`${list.length} 間可探索 · ${Object.values(records).filter(r=>r.saved).length} 間已收藏`;$('#empty').hidden=list.length>0;
  const labels=[filters.category||'全部分類',filters.timeMode==='any'?'不限時間':filters.timeMode==='now'?'現在・台灣時間':filters.local?`${filters.local.date} ${filters.local.time}`:'請選擇日期時間',filters.saved?'已收藏':'',filters.visited==='no'?'尚未標記去過':filters.visited==='yes'?'已去過':'',filters.query?`搜尋「${filters.query}」`:'',position?(filters.radius?`${filters.radius} km 內`:'依直線距離排序'):'台東市中心'];$('#active-summary').textContent=labels.filter(Boolean).join(' · ');
  const issues=[...queryIssues,...validateFind(filters)];
  $('#needs-issues').hidden=!issues.length;$('#needs-issues').textContent=[...new Set(issues)].join(' ');
  $('#needs-notes').hidden=!needsNotes.length;$('#needs-notes').textContent=needsNotes.join(' ');
  $('#budget-note').hidden=filters.budget===null;
  const mealLabels=[filters.mealType!=='any'?MEAL_TYPES[filters.mealType]:'',filters.budget!==null?'每人'+filters.budget+'元內':'',...filters.excludedTypes.map(t=>'不吃'+MEAL_TYPES[t])];
  $('#active-summary').textContent=[...mealLabels,...labels].filter(Boolean).join(' · ');
  $('#empty-message').textContent=issues.length?'請修正上方提示，或直接用條件欄位設定。':`目前沒有符合全部條件的店。${filters.budget!==null?'預算只採已查核主餐價格；'+diagnostics.missingPrice+'間缺少價格、'+diagnostics.overBudget+'間超過預算。':''}可移除個別條件，或清除篩選重新找找。`;
  $('#categories').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.category===filters.category);b.setAttribute('aria-pressed',b.dataset.category===filters.category);});
  renderChips();
  const selectedShop=list.find(s=>s.id===selected);
  if(selectedShop && document.body.classList.contains('map-view')){$('#map-detail').replaceChildren(card(selectedShop,true));$('#map-detail').hidden=false;}else{$('#map-detail').hidden=true;}
  if(markers){markers.clearLayers();list.forEach((s,index)=>{const marker=L.marker([s.lat,s.lng],{icon:L.divIcon({className:`pin${records[s.id]?.saved?' saved':''}`,html:`<span>${index+1}</span>`,iconSize:[32,32],...markerLayout(list,s)})});marker.shopId=s.id;const popup=el('div');popup.append(el('strong','',s.name),el('div','',s.categories.join(' / ')),statusView(s),el('br'));const button=el('button','popup-action','查看店家資訊');button.onclick=()=>{selectShop(s);if(!document.body.classList.contains('map-view'))document.querySelector(`[data-id="${s.id}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});};popup.append(button);marker.bindPopup(popup);marker.on('click',()=>{selected=s.id;document.querySelectorAll('.card').forEach(c=>c.classList.toggle('selected',c.dataset.id===s.id));if(document.body.classList.contains('map-view')){$('#map-detail').replaceChildren(card(s,true));$('#map-detail').hidden=false;}});markers.addLayer(marker);});}
}
function reset(){Object.assign(filters,{...DEFAULT_FIND,excludedTypes:[]});queryIssues=[];needsNotes=[];$('#query').value='';syncFields();render();fitMap();}
function fitMap(){if(!map)return;const list=resultList();if(list.length)map.fitBounds(list.map(s=>[s.lat,s.lng]),{padding:[30,30],maxZoom:15});else map.setView(CENTER,14);}
function initMap(){try{if(!window.L)throw new Error('Leaflet unavailable');map=L.map('map',{scrollWheelZoom:false}).setView(CENTER,14);markers=L.layerGroup().addTo(map);let errors=0;const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);tiles.on('tileerror',()=>{errors++;if(errors>=3){$('#map-message').hidden=false;$('#map-message').textContent='底圖暫時無法載入，仍可使用店家清單或「照片・導航」連結。';}});tiles.on('tileload',()=>{if(errors===0)$('#map-message').hidden=true;});}catch{$('#map-message').hidden=false;$('#map-message').textContent='地圖無法載入。店家清單、篩選與收藏仍可使用。';}}
$('#query').addEventListener('input',e=>{if(!e.target.value){filters.query='';queryIssues=[];needsNotes=[];render();fitMap();}});
$('#query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault?.();applyNeeds();}});$('#parse-query').onclick=applyNeeds;
$('#meal-type').onchange=e=>{filters.mealType=e.target.value;changed();};
$('#budget').onchange=()=>{filters.budget=$('#budget').value.trim()===''?null:Number($('#budget').value);changed();};
$('#time-mode').onchange=e=>{filters.timeMode=e.target.value;$('#custom-time-wrap').hidden=filters.timeMode!=='custom';if(filters.timeMode==='custom'){if(!$('#custom-time').value){const now=taiwanParts();$('#custom-time').value=now.date+'T'+now.time;}const [date,time]=$('#custom-time').value.split('T');filters.local=date&&time?{date,time}:null;}else filters.local=null;changed();};
$('#custom-time').onchange=e=>{const [date,time]=e.target.value.split('T');filters.local=date&&time?{date,time}:null;changed();};
$('#saved').onchange=e=>{filters.saved=e.target.value==='saved';changed();};$('#visited').onchange=e=>{filters.visited=e.target.value;changed();};$('#radius').onchange=e=>{filters.radius=e.target.value;changed();};$('#reset').onclick=reset;$('#empty-reset').onclick=reset;$('#fit-map').onclick=fitMap;
syncFields();
$('#view-list').onclick=()=>setView('list');$('#view-map').onclick=()=>setView('map');
$('#locate').onclick=()=>{if(!navigator.geolocation){toast('這個瀏覽器不支援定位，可繼續使用市區清單。',true);return;}$('#locate').disabled=true;$('#location-message').textContent='正在取得位置…';navigator.geolocation.getCurrentPosition(p=>{position=[p.coords.latitude,p.coords.longitude];$('#locate').disabled=false;$('#radius').disabled=false;$('#location-message').textContent=`已定位，依直線距離排序（定位誤差約 ${Math.round(p.coords.accuracy)} 公尺），不代表行車距離。`;if(map){if(userMarker)map.removeLayer(userMarker);userMarker=L.circleMarker(position,{radius:7,color:'#fff',weight:3,fillColor:'#376fac',fillOpacity:1}).addTo(map).bindPopup('你的位置');}render();fitMap();},e=>{$('#locate').disabled=false;$('#location-message').textContent=e.code===1?'未授權定位，仍可瀏覽台東市中心店家。':'暫時無法取得位置，仍可瀏覽台東市中心店家。';},{timeout:12000,maximumAge:60000,enableHighAccuracy:false});};
$('#backup-open').onclick=()=>{$('#storage-status').textContent=storageOkay?'目前瀏覽器紀錄可讀取。':'目前紀錄讀寫有問題，請先保留備份。';$('#backup-dialog').showModal();};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`台東口袋名單-${taiwanParts().date}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('檔案超過 1 MB，未匯入。');const incoming=validateBackup(JSON.parse(await file.text()));const known=Object.fromEntries(Object.entries(incoming).filter(([id])=>shops.some(s=>s.id===id)));const skipped=Object.keys(incoming).length-Object.keys(known).length;if(write(mergeRecords(records,known))){render();toast(`備份已合併，保留目前同店紀錄${skipped?`；略過 ${skipped} 間未收錄店家`:''}。`);}}catch(err){toast(err instanceof SyntaxError?'不是有效 JSON，原紀錄未變更。':err.message,true);}finally{e.target.value='';}};
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;try{records=e.newValue?validateBackup(JSON.parse(e.newValue)):Object.create(null);render();}catch{toast('另一個分頁的紀錄格式異常，未載入。',true);}});
setInterval(()=>{if(shops.length && !document.activeElement?.matches('textarea,input,select'))render();},60000);
try{const response=await fetch('./shops.json?v=b82e7f3ab64d');if(!response.ok)throw new Error();const data=await response.json();shops=data.shops;$('#data-note').textContent=`精選 ${shops.length} 間 · 資料查核 ${data.checkedAt} · 不定期人工整理，非即時店家資料庫。`;const all=[['','全部探索'],...CATEGORIES.map(c=>[c,c])];all.forEach(([category,label])=>{const b=el('button','category',label);b.dataset.category=category;const count=category?shops.filter(s=>s.categories.includes(category)).length:shops.length;b.append(el('span','category-count',count));b.onclick=()=>{filters.category=category;changed();};$('#categories').append(b);});initMap();render();fitMap();}catch{$('#count').textContent='資料載入失敗';$('#cards').append(el('p','empty','無法載入店家資料。請重新整理，或確認網站是透過 HTTP 開啟。收藏資料未刪除。'));}



