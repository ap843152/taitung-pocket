import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCatalog} from '../scripts/catalog.mjs';
import {renderSeo,SITE_URL,INSTAGRAM_URL,robotsText,sitemapXml} from '../scripts/seo.mjs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),catalog=loadCatalog();
test('無需執行JavaScript就能讀取全部正式店家與來源，重建不重複內容',()=>{
 const built=renderSeo(html,catalog);
 assert.equal(built,renderSeo(built,catalog));
 const body=built.split('<!-- SHOP-CARDS:START -->')[1].split('<!-- SHOP-CARDS:END -->')[0];
 assert.equal((body.match(/<article /g)||[]).length,catalog.shops.length);
 for(const s of catalog.shops){assert.ok(body.includes(`data-id="${s.id}"`));assert.ok(body.includes(s.sources[0].url.replaceAll('&','&amp;')));}
 assert.equal((built.match(/<h1>/g)||[]).length,1);
});
test('品牌與canonical一致，網站地圖不洩漏研究及私人紀錄',()=>{
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema.name,'台東好吃');assert.equal(schema.url,SITE_URL);assert.deepEqual(schema.sameAs,[INSTAGRAM_URL]);
 assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}">`));
 assert.match(html,/<title>台東好吃/);assert.ok(html.includes(`href="${INSTAGRAM_URL}"`));
 assert.doesNotMatch(html,/<meta[^>]+(?:name="robots"[^>]+content="noindex|content="noindex[^>]+name="robots")/);
 const locations=[...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.deepEqual(locations,[SITE_URL]);
 assert.ok(robotsText.includes(`Sitemap: ${SITE_URL}sitemap.xml`));assert.doesNotMatch(robotsText,/Disallow: \/\s/);
});
test('店家文字與連結正確跳脫，不因預先產生HTML而執行內容中的標籤',()=>{
 const shop={...catalog.shops[0],name:'測試<script>alert(1)</script>',description:'<img src=x onerror=alert(1)>',sources:[{label:'" onclick="alert(1)',url:'https://example.com/?a=1&b=2'}]};
 const built=renderSeo(html,{...catalog,shops:[shop]});
 const cards=built.split('<!-- SHOP-CARDS:START -->')[1].split('<!-- SHOP-CARDS:END -->')[0];
 assert.doesNotMatch(cards,/<script|<img/);assert.ok(cards.includes('&lt;script&gt;'));assert.ok(cards.includes('https://example.com/?a=1&amp;b=2'));
 assert.equal((cards.match(/<article /g)||[]).length,1);
});
