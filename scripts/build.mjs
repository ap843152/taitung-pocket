import {readFileSync,writeFileSync} from 'node:fs';
import {validateCatalog} from './content.mjs';
import {loadCatalog} from './catalog.mjs';
const data=loadCatalog();
writeFileSync(new URL('../content/shops.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
writeFileSync(new URL('../dist/shops.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`已由正式資料產生 ${data.shops.length} 間店家；未修改待審紀錄。`);
