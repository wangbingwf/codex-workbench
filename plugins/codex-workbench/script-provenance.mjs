import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function scriptProvenance(entries,cwd){
 const rows=entries.map(e=>{const i=e.item||{};return {completedAtMs:e.completedAtMs,startedAtMs:e.startedAtMs,item:i.type==='commandExecution'?{type:i.type,status:i.status,exitCode:i.exitCode,cwd:i.cwd,command:i.command}:i.type==='fileChange'?{type:i.type,status:i.status,changes:i.changes}:{type:'ignored'}};});
 const payload=JSON.stringify({cwd,rows});
 if(Buffer.byteLength(payload)>32*1024*1024)return {writes:[],warning:'脚本记录过大，未补全间接产物'};
 const result=spawnSync('python3',['-I','-S',fileURLToPath(new URL('./script-provenance.py',import.meta.url))],{input:payload,encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024,windowsHide:true});
 if(result.error||result.status!==0)return {writes:[],warning:'历史脚本分析不可用（需要 Python 3），部分产物可能遗漏'};
 try{const value=JSON.parse(result.stdout);return Array.isArray(value.writes)?value:{writes:[],warning:'历史脚本分析结果无效'};}catch{return {writes:[],warning:'历史脚本分析失败，部分产物可能遗漏'};}
}
