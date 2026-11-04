export const SITE_URL='https://taitung.adventurehotairballoon.com/';
export const INSTAGRAM_URL='https://www.instagram.com/taitung_delicious/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(label,url)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
function staticCard(shop){
 const map=shop.mapUrl||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(shop.name+' '+shop.address);
 return `<article class="card" data-id="${escape(shop.id)}"><div class="card-heading"><div><p class="card-kicker">${escape(shop.categories.join(' / '))}</p><h3 class="card-title">${escape(shop.name)}</h3></div></div><p class="description">${escape(shop.description)}</p>${shop.longIntro?`<details class="details"><summary>認識這間店</summary><p>${escape(shop.longIntro)}</p></details>`:''}<div class="tags">${shop.tags.map(tag=>`<span class="tag">${escape(tag)}</span>`).join('')}</div><p class="meta">⌖ ${escape(shop.address)}</p>${shop.price?`<p class="meta">參考消費：${escape(shop.price)}</p>`:''}<div class="card-bottom">${link('照片・導航 ↗',map)}</div><details class="details"><summary>資料與營業時間</summary>${shop.hours!==null?`<p>${escape(shop.hoursText)}</p>`:''}<p>查核日期：${escape(shop.checkedAt)}</p><ul>${shop.sources.map(s=>`<li>${link(s.label,s.url)}</li>`).join('')}</ul><p>位置核對：${escape(shop.coordinateNote)}</p>${link('查看店家官方資訊 ↗',shop.officialUrl)}</details></article>`;
}
function replaceBlock(html,name,value){
 const start=`<!-- ${name}:START -->`,end=`<!-- ${name}:END -->`;
 const a=html.indexOf(start),b=html.indexOf(end);
 if(a<0||b<a||html.indexOf(start,a+start.length)!==-1)throw Error(`缺少唯一的 ${name} 建置區塊`);
 return html.slice(0,a+start.length)+'\n'+value+'\n'+html.slice(b);
}
export function renderSeo(html,data){
 const schema={'@context':'https://schema.org','@type':'WebSite','@id':SITE_URL+'#website',url:SITE_URL,name:'台東好吃',alternateName:'台東好吃美食口袋地圖',inLanguage:'zh-Hant',description:'整理台東市區早午餐、餐廳、咖啡與甜點，提供地圖探索與個人口袋名單。',sameAs:[INSTAGRAM_URL]};
 html=replaceBlock(html,'SITE-SCHEMA','<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>');
 html=replaceBlock(html,'SHOP-CARDS',[...data.shops].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')).map(staticCard).join('\n'));
 return html.replace(/(<span id="count">)[^<]*(<\/span>)/,`$1${data.shops.length} 間店家$2`).replace(/(<small id="data-note">)[^<]*(<\/small>)/,`$1精選 ${data.shops.length} 間 · 資料查核 ${escape(data.checkedAt)} · 不定期人工整理，非即時店家資料庫。$2`);
}
export const robotsText=`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`;
export const sitemapXml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc></url></urlset>\n`;
