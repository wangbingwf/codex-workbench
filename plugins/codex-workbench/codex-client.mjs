import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
let client;
export function connect(){
 if(client)return client;
 const proc=spawn(process.env.CODEX_CLI_PATH||'codex',['app-server','--stdio'],{stdio:['pipe','pipe','pipe']});
 let seq=0;const pending=new Map();
 const fail=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Codex 数据连接已关闭'));}pending.clear();client=null;};
 proc.on('error',fail);proc.on('exit',fail);proc.stderr.on('data',()=>{});
 createInterface({input:proc.stdout}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)});
 function request(method,params){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('读取 Codex 数据超时，请重试'))},30000);pending.set(id,{resolve,reject,timer});proc.stdin.write(JSON.stringify({id,method,params})+'\n')})}
 const ready=request('initialize',{clientInfo:{name:'codex-workbench',version:'0.9.2'},capabilities:{experimentalApi:true}});
 client={async call(method,params){await ready;return request(method,params)},close(){proc.kill();client=null}};
 process.once('exit',()=>proc.kill());
 return client;
}
export const stop=()=>client?.close();
