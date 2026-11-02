import {readdirSync,mkdirSync,lstatSync,rmSync,cpSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export function syncPublic(root=fileURLToPath(new URL('../',import.meta.url))){
  const stage=resolve(root,'.runtime/github');mkdirSync(stage,{recursive:true});
  if(lstatSync(stage).isSymbolicLink())throw new Error('公開目錄不可為連結');
  for(const name of readdirSync(stage)){
    if(name==='.git')continue;
    const target=resolve(stage,name);
    if(dirname(target)!==stage)throw new Error('公開目錄路徑不符');
    if(lstatSync(target).isSymbolicLink())throw new Error('公開目錄包含連結，請先人工核對');
    rmSync(target,{recursive:true,force:true});
  }
  for(const name of ['dist','content','scripts','tests','.github'])cpSync(resolve(root,name),resolve(stage,name),{recursive:true});
  for(const name of ['README.md','package.json','.gitignore'])cpSync(resolve(root,name),resolve(stage,name));
  return stage;
}
