import http from 'node:http';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {sessionFiles,previewKind} from './files.mjs';
import {renderPreview} from './preview.mjs';
let server,starting,origin;
const pages=new Map(),locations=new Map();
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function start(){
 if(starting)return starting;
 server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.headers.host!==new URL(origin).host){res.writeHead(403).end();return}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
  let file;try{file=pages.get(new URL(req.url,origin).pathname)}catch{res.writeHead(400).end();return}
  if(!file){res.writeHead(404).end('Preview not found');return}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy','sandbox allow-scripts');
  try{const {html}=await renderPreview(file);res.end(req.method==='HEAD'?'':html.replace('</head>','<title>'+escape(path.basename(file))+'</title></head>'));}
  catch(e){res.writeHead(422).end('<!doctype html><meta charset="utf-8"><h1>预览失败</h1><p>'+escape(e.message)+'</p>');}
 });
 starting=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{origin='http://127.0.0.1:'+server.address().port;resolve();});}).catch(e=>{starting=null;throw e});
 return starting;
}
export async function preparePreviewTab(id,file){
 const records=await sessionFiles(id);
 if(!records.files.some(f=>f.path===file&&f.exists))throw Error('该文件不在此会话的可访问产出记录中');
 const kind=previewKind(file);if(!kind||kind==='native')throw Error('此格式请使用 Codex 原生文档预览');
 await start();
 let route=locations.get(file);
 if(!route){route='/'+randomBytes(24).toString('hex')+'/'+encodeURIComponent(path.basename(file));locations.set(file,route);pages.set(route,file);}
 const url=origin+route;
 return {kind,name:path.basename(file),url,openUrl:'codex://browser?url='+encodeURIComponent(url)};
}
export function stopPreviewTabs(){server?.closeAllConnections();server?.close();server=null;starting=null;pages.clear();locations.clear();}
