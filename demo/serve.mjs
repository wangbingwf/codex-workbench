import http from 'node:http';
import fs from 'node:fs';
const version=JSON.parse(fs.readFileSync(new URL('../plugins/codex-workbench/plugin.json',import.meta.url))).version;
const id='11111111-1111-4111-8111-111111111111',updatedAt=1792886400;
const threads=[{id,title:'网站首页改版',preview:'优化首页的信息层级与移动端布局。',project:'project:demo',projectName:'示例网站',updatedAt},{id:'22222222-2222-4222-8222-222222222222',title:'整理产品说明文档',preview:'整理功能说明与验收步骤。',project:'project:demo',projectName:'示例网站',updatedAt:updatedAt-3600}];
const goal={goal:'让首次访问者快速理解产品并完成关键操作。',progress:'已完成首页布局与移动端样式，等待可用性检查。',next:'检查窄窗口布局和键盘操作。'};
const project={goal:'改善示例网站的使用体验。',workstreams:[{title:'首页与文档',progress:'布局与说明文档已整理。',sources:[id]}],deliverables:[{text:'首页原型与产品说明',sources:[id]}],next:[{text:'完成验收',sources:[id]}]};
const host='<!doctype html><meta charset="utf-8"><title>Synthetic Workbench Demo</title><style>body{margin:0;font:13px system-ui}header{padding:10px;background:#fff4cf}iframe{border:0;width:100%;height:calc(100dvh - 40px);display:block}</style><header>合成演示 / Synthetic demo · 不读取真实数据、不调用 AI · All summaries are fixtures</header><iframe id="app" sandbox="allow-scripts"></iframe><script>const frame=document.getElementById("app");fetch("/ui").then(r=>r.text()).then(t=>frame.srcdoc=t);addEventListener("message",async e=>{if(e.source!==frame.contentWindow||!e.data.id)return;try{const r=await fetch("/rpc",{method:"POST",body:JSON.stringify(e.data)}).then(r=>r.json());frame.contentWindow.postMessage({jsonrpc:"2.0",id:e.data.id,result:r},"*")}catch{frame.contentWindow.postMessage({jsonrpc:"2.0",id:e.data.id,error:{message:"Demo request failed"}},"*")}})</script>';
let decision=null,language='auto';
function response(m){if(m.method==='ui/initialize')return {hostContext:{locale:'zh-CN'},hostCapabilities:{}};
 if(m.method==='ui/open-link')return {isError:true};
 const name=m.params?.name,a=m.params?.arguments||{};let data;
 if(name==='get_workbench_status')data={serviceVersion:version,versionsMatch:a.uiVersion===version};
 else if(name==='refresh_workbench'||name==='open_workbench')data={threads,projects:[{id:'project:demo',name:'示例网站'}],syncedAt:updatedAt*1000,scope:'Synthetic demo data only'};
 else if(name==='workbench_onboarding'){if(a.action==='language')language=a.language;else if(a.action&&a.action!=='read')decision=a.action;data={decision,language};}
 else if(name==='get_task_overview')data={state:'ready',id:a.id,overview:goal,stale:false,generatedAt:updatedAt*1000,sourceUpdatedAt:updatedAt,note:'Synthetic fixture; not model output'};
 else if(name==='get_project_overview')data={state:'ready',overview:project,sources:[{id,title:'网站首页改版'}],coveredCount:2,totalCount:2,generatedAt:updatedAt*1000};
 else if(name==='get_session_files')data={files:[]};
 else if(name==='get_session_progress')data={text:'示例：首页布局已完成，下一步检查交互。',source:'Synthetic fixture',summaryAt:updatedAt};
 else return {isError:true,content:[{type:'text',text:'Demo only: no real files or chat navigation'}]};
 return {structuredContent:data};}
const server=http.createServer(async(req,res)=>{if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403);res.end();return}res.setHeader('Cache-Control','no-store');if(req.url==='/ui'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(new URL('../plugins/codex-workbench/ui/index.html',import.meta.url)));return}
 if(req.url==='/rpc'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>65536){res.writeHead(413);res.end();return}}try{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response(JSON.parse(body))))}catch{res.writeHead(400);res.end('{}')}return}
 if(req.url!=='/'){res.writeHead(404);res.end();return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(host);});
server.listen(0,'127.0.0.1',()=>console.log('Synthetic demo: http://127.0.0.1:'+server.address().port));
