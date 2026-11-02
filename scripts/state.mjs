import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {digest} from './content.mjs';
export function loadState(path){const value=JSON.parse(readFileSync(path,'utf8'));return {value,version:digest(value)};}
export function saveState(path,value,expected){
  const lock=String(path)+'.lock';let fd;
  try{fd=openSync(lock,'wx');if(loadState(path).version!==expected)throw new Error('研究紀錄已被其他操作更新，請重讀後重試');const temp=String(path)+'.tmp';writeFileSync(temp,JSON.stringify(value,null,2)+'\n');renameSync(temp,path);}
  finally{if(fd!==undefined){closeSync(fd);unlinkSync(lock);}}
}
