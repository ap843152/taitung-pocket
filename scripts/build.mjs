import {readFileSync,writeFileSync} from 'node:fs';
import {loadCatalog} from './catalog.mjs';
import {renderSeo,robotsText,sitemapXml} from './seo.mjs';
import {createHash} from 'node:crypto';
const data=loadCatalog();
writeFileSync(new URL('../content/shops.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
writeFileSync(new URL('../dist/shops.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
const home=new URL('../dist/index.html',import.meta.url);
const asset=name=>new URL('../dist/'+name,import.meta.url);
const hash=name=>createHash('sha256').update(readFileSync(asset(name))).digest('hex').slice(0,12);
// Stamp dependencies before their parent, so browser caches cannot mix releases.
for(const [name,deps] of [['lunch.mjs',['core.mjs']],['finder.mjs',['core.mjs','lunch.mjs']],['app.mjs',['core.mjs','finder.mjs']]]){
 let source=readFileSync(asset(name),'utf8');
 for(const dep of deps){const escaped=dep.replaceAll('.','\\.');source=source.replace(new RegExp(`(['"])\\./${escaped}(?:\\?v=[a-f0-9]+)?\\1`,'g'),`'./${dep}?v=${hash(dep)}'`);}
 writeFileSync(asset(name),source);
}
const app=asset('app.mjs');
writeFileSync(app,readFileSync(app,'utf8').replace(/fetch\('\.\/shops\.json(?:\?v=[a-f0-9]+)?'\)/,`fetch('./shops.json?v=${hash('shops.json')}')`));
let html=renderSeo(readFileSync(home,'utf8'),data);
html=html.replace(/src="app\.mjs(?:\?v=[a-f0-9]+)?"/,`src="app.mjs?v=${hash('app.mjs')}"`).replace(/href="style\.css(?:\?v=[a-f0-9]+)?"/,`href="style.css?v=${hash('style.css')}"`);
writeFileSync(home,html);
writeFileSync(new URL('../dist/robots.txt',import.meta.url),robotsText);
writeFileSync(new URL('../dist/sitemap.xml',import.meta.url),sitemapXml);
console.log(`已由正式資料產生 ${data.shops.length} 間店家；未修改待審紀錄。`);
