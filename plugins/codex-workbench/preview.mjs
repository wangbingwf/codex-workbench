import fs from 'node:fs/promises';
import path from 'node:path';
import {marked} from './vendor/marked.mjs';
import {previewKind} from './files.mjs';
const limit=12*1024*1024;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageTypes={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};

async function readBounded(file,budget){const stat=await fs.stat(file);if(!stat.isFile())throw Error('文件无法访问');if(stat.size>budget.remaining)throw Error('预览内容超过 12 MB，请在原会话中查看');const b=await fs.readFile(file);budget.remaining-=b.length;if(budget.remaining<0)throw Error('预览内容超过 12 MB');return b;}
async function inlineAssets(html,file,budget){
 const root=await fs.realpath(path.dirname(file));
 async function asset(url){if(!url||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))return null;try{const local=await fs.realpath(path.resolve(path.dirname(file),decodeURIComponent(url.split(/[?#]/)[0])));if(!local.startsWith(root+path.sep))return null;return {local,bytes:await readBounded(local,budget)}}catch(e){if(e.message.includes('12 MB'))throw e;return null}}
 // Local dependencies are embedded so the isolated preview never needs file:// access.
 for(const m of [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)]){const a=await asset(m[2]);const mime=a&&imageTypes[path.extname(a.local).toLowerCase()];if(mime)html=html.replace(m[0],m[0].replace(m[2],'data:'+mime+';base64,'+a.bytes.toString('base64')));}
 for(const m of [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/script\s*>/gi)]){const a=await asset(m[2]);if(a&&/\.[cm]?js$/i.test(a.local))html=html.replace(m[0],'<script>'+a.bytes.toString('utf8').replace(/<\/script/gi,'<\\/script')+'</script>');}
 for(const m of [...html.matchAll(/<link\b[^>]*>/gi)]){if(!/\brel\s*=\s*(["'])stylesheet\1/i.test(m[0]))continue;const href=m[0].match(/\bhref\s*=\s*(["'])(.*?)\1/i);const a=href&&await asset(href[2]);if(a&&/\.css$/i.test(a.local))html=html.replace(m[0],'<style>'+a.bytes.toString('utf8').replace(/<\/style/gi,'<\\/style')+'</style>');}
 return html;
}
const csp="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const head='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="viewport" content="width=device-width,initial-scale=1">';
export async function renderPreview(file){
 const kind=previewKind(file);if(!kind||kind==='native')throw Error('此格式请使用 Codex 文档预览');
 const budget={remaining:limit},bytes=await readBounded(file,budget);let html,note='工作台内预览；文件在本机读取，不调用模型。';
 if(kind==='html'){const body=await inlineAssets(bytes.toString('utf8'),file,budget);html=head+'</head><body>'+body+'</body></html>';note+='本地同目录的图片、脚本和样式会内嵌；外部网络、跨目录依赖和外链跳转受限。';}
 if(kind==='markdown'){html=head+'<style>body{max-width:960px;margin:24px auto;padding:0 24px;font:16px/1.7 system-ui;color:#24312c}img{max-width:100%}pre{overflow:auto;background:#f4f6f5;padding:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style></head><body>'+await inlineAssets(marked.parse(bytes.toString('utf8')),file,budget)+'</body></html>';}
 if(kind==='table'){const rows=parseTable(bytes.toString('utf8'),path.extname(file).toLowerCase()==='.tsv'?'\t':',');html=head+'<style>body{margin:16px;font:14px/1.5 system-ui}table{border-collapse:collapse}td{border:1px solid #d7dfda;padding:8px;white-space:pre-wrap}tr:first-child{background:#edf4ef;font-weight:bold}</style></head><body><table>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+escape(c)+'</td>').join('')+'</tr>').join('')+'</table></body></html>';}
 if(kind==='image')html=head+'<style>body{margin:0;text-align:center;background:#f5f6f7}img{max-width:100%;height:auto}</style></head><body><img alt="'+escape(path.basename(file))+'" src="data:'+imageTypes[path.extname(file).toLowerCase()]+';base64,'+bytes.toString('base64')+'"></body></html>';
 if(kind==='drawio'){
  const viewer=await fs.readFile(new URL('./vendor/drawio-viewer.min.js',import.meta.url),'utf8');
  const config=escape(JSON.stringify({xml:bytes.toString('utf8'),toolbar:'pages zoom layers',nav:true,resize:false,lightbox:false,edit:null,'toolbar-nohide':1,'toolbar-position':'inline',center:true}));
  html=head+'<style>html,body{margin:0;height:100%;font-family:system-ui}.mxgraph{position:relative;height:calc(100% - 36px);width:100%;margin-top:36px;border:0}</style></head><body><div class="mxgraph" style="height:calc(100% - 36px);width:100%;margin-top:36px" data-mxgraph="'+config+'"></div><script>'+viewer.replace(/<\/script/gi,'<\\/script')+'</script><script>try{GraphViewer.processElements();if(!document.querySelector(".mxgraph svg"))throw Error("图形内容无法渲染")}catch(e){document.body.textContent="draw.io 预览失败："+e.message}</script></body></html>';
  note+='使用本地打包的 draw.io 官方查看器；支持分页与缩放，外部图片和未打包的特殊图形资源受限。';
 }
 return {kind,html,note};
}


export function parseTable(text,separator=','){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}else if(c===separator&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;if(rows.length>5000)throw Error('表格超过 5000 行，请在原会话中查看');}if(quoted)throw Error('表格引号未闭合，无法预览');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
