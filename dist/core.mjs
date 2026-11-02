export const CATEGORIES = ['早午餐','餐廳','咖啡店','甜品店'];
export const STORAGE_KEY = 'taitung-pocket:v1';
export const CENTER = [22.75215,121.14805];
export function markerLayout(shops,shop) {
  const peers=shops.filter(s=>s.lat===shop.lat && s.lng===shop.lng);
  const offset=(peers.findIndex(s=>s.id===shop.id)-(peers.length-1)/2)*38;
  return {iconAnchor:[16-offset,32],popupAnchor:[offset,-28]};
}
const validRecord = r => r && typeof r === 'object' && !Array.isArray(r) && typeof r.saved === 'boolean' && typeof r.visited === 'boolean' && typeof r.note === 'string' && r.note.length <= 500;
export function validateBackup(input) {
  if (!input || input.version !== 1 || !input.records || typeof input.records !== 'object' || Array.isArray(input.records)) throw new Error('備份格式不符，請選擇本網站匯出的 JSON。');
  const result = Object.create(null);
  for (const [id,r] of Object.entries(input.records)) {
    if (!/^[a-z0-9-]{1,80}$/.test(id) || !validRecord(r)) throw new Error('備份包含不合法的店家紀錄，未匯入任何資料。');
    result[id] = {saved:r.saved,visited:r.visited,note:r.note};
  }
  return result;
}
export function mergeRecords(current,incoming) { return {...incoming,...current}; }
export function persist(storage, records) { storage.setItem(STORAGE_KEY,JSON.stringify({version:1,records})); }
export function taiwanParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
const minutes = s => Number(s.split(':')[0])*60+Number(s.split(':')[1]);
function intervalsFor(shop,date,day) { return Object.hasOwn(shop.exceptions || {},date) ? shop.exceptions[date] : shop.hours?.[day] ?? null; }
export function openingStatus(shop, local) {
  if (!local || !/^\d{4}-\d{2}-\d{2}$/.test(local.date) || !/^\d{2}:\d{2}$/.test(local.time)) return 'unknown';
  const d = new Date(`${local.date}T12:00:00+08:00`), day=d.getUTCDay(), t=minutes(local.time);
  const today=intervalsFor(shop,local.date,day);
  d.setUTCDate(d.getUTCDate()-1);
  const prevDate = taiwanParts(d).date, yesterday=intervalsFor(shop,prevDate,(day+6)%7);
  if (today?.some(([a,b]) => minutes(b)>minutes(a) ? t>=minutes(a)&&t<minutes(b) : minutes(b)<minutes(a)&&t>=minutes(a))) return 'open';
  if (yesterday?.some(([a,b]) => minutes(b)<minutes(a) && t<minutes(b))) return 'open';
  // Unknown previous hours may contain an unrecorded overnight interval.
  return today === null || (yesterday === null && t<360) ? 'unknown' : 'closed';
}
export function distanceKm(a,b) {
  const rad=x=>x*Math.PI/180, dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function filterShops(shops,filters,records={},position=null,now=taiwanParts()) {
  const query=(filters.query||'').trim().toLocaleLowerCase().replaceAll('臺','台');
  const local=filters.timeMode==='custom' ? filters.local : now;
  return shops.filter(s=>{
    const r=records[s.id]||{};
    if(filters.category && !s.categories.includes(filters.category))return false;
    if(query && ![s.name,s.address,...s.tags,s.description].join(' ').toLocaleLowerCase().replaceAll('臺','台').includes(query))return false;
    if(filters.saved && !r.saved)return false;
    if(filters.visited==='yes'&&!r.visited || filters.visited==='no'&&r.visited)return false;
    if(filters.timeMode!=='any' && openingStatus(s,local)!=='open')return false;
    if(position && filters.radius && distanceKm(position,[s.lat,s.lng])>Number(filters.radius))return false;
    return true;
  }).sort((a,b)=>position ? distanceKm(position,[a.lat,a.lng])-distanceKm(position,[b.lat,b.lng]) : a.name.localeCompare(b.name,'zh-Hant'));
}
