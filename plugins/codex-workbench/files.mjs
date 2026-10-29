import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {connect} from './codex-client.mjs';
const documentExt=new Set(['.md','.txt','.pdf','.docx','.xlsx','.xls','.pptx','.html','.htm','.svg','.png','.jpg','.jpeg','.webp','.drawio','.excalidraw','.tex']);
export function collectFiles(entries,cwd){
 const files=new Map();
 function record(raw,kind,time,base=cwd,label=''){if(!raw||/[\x00\r\n$`]/.test(raw))return;const file=path.resolve(base||cwd,raw);if(!documentExt.has(path.extname(file).toLowerCase())&&!/\.draw\.io$/i.test(file))return;const caption=label.trim().slice(0,140),stem=path.basename(file).replace(/(?:\.draw\.io|\.[^.]+)$/i,'').replace(/^\d+[_\s.-]+/,'').replace(/\s+/g,'');const meaningful=caption&&caption!==path.basename(file)&&caption.replace(/\s+/g,'')!==stem;const existing=files.get(file);if(existing){if(meaningful)existing.label=caption;if(kind!=='linked'||existing.kind==='linked'){if(existing.kind==='linked'&&kind!=='linked'){existing.kind=kind;existing.firstAt=time;}existing.lastAt=time??existing.lastAt;existing.deleted=kind==='delete';}}else if(kind!=='delete')files.set(file,{path:file,name:path.basename(file),kind,firstAt:time,lastAt:time,deleted:false,...(meaningful?{label:caption}:{})});}
 for(const entry of entries){const i=entry.item;const time=entry.completedAtMs||entry.startedAtMs||null;
 if(i.type==='fileChange'&&i.status==='completed'){for(const c of i.changes){if(c.kind?.move_path){const old=path.resolve(cwd,c.path),to=path.resolve(cwd,c.kind.move_path);const previous=files.get(old);if(previous){files.delete(old);files.set(to,{...previous,path:to,name:path.basename(to),lastAt:time});}else record(to,'update',time);}else record(c.path,c.kind?.type||'update',time);}}
 if(i.type==='agentMessage'&&i.phase!=='commentary'&&typeof i.text==='string'){for(const ref of linkedLocalReferences(i.text))record(ref.path,'linked',time,cwd,ref.label);}
 if(i.type==='commandExecution'&&i.status==='completed'&&i.exitCode===0&&typeof i.command==='string'){
  // Only literal top-level cat heredoc writes are recognized; never execute or infer script contents.
  const lines=i.command.split('\n');for(let n=0;n<lines.length;n++){const line=lines[n];const delimiter=line.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*$/);if(!delimiter)continue;const write=line.match(/^\s*cat\s+(>>?)\s*(?:'([^']+)'|"([^"$`]+)"|([^\s'"$`;&|<>]+))\s*<<-?\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?\s*$/);if(write)record(write[2]||write[3]||write[4],'write',time,i.cwd||cwd);while(++n<lines.length&&lines[n].replace(/^\t+/,'')!==delimiter[1]){} }
 }
 }
 return [...files.values()].map(f=>({...f,role:f.kind==='linked'&&(/(?:^|[\\/])skills[\\/]/i.test(f.path)||/^(?:SKILL|AGENTS|CLAUDE)\.md$/i.test(f.name))?'reference':'output'})).sort((a,b)=>(a.firstAt??Infinity)-(b.firstAt??Infinity)||a.path.localeCompare(b.path));
}
export async function sessionFiles(id){
 if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw Error('会话 ID 无效');const c=connect();const meta=await c.call('thread/read',{threadId:id,includeTurns:false});const entries=[];let cursor;const seen=new Set();do{const r=await c.call('thread/items/list',{threadId:id,limit:100,sortDirection:'asc',cursor});entries.push(...r.data);cursor=r.nextCursor;if(cursor&&seen.has(cursor))throw Error('文件记录分页重复，请重试');seen.add(cursor);}while(cursor);
 const files=collectFiles(entries,meta.thread.cwd);await Promise.all(files.map(async f=>{try{const stat=await fs.stat(f.path);f.exists=stat.isFile();f.previewKind=previewKind(f.path);}catch{f.exists=false;}}));return {id,files,note:'按记录中的首次写入排序；综合成功写入记录和助手提供的本地文件链接；“会话链接”不等于文件由该会话创建，时间代表记录出现时间。未提供链接的脚本产物仍可能遗漏；文件缺失无法区分移动或删除。'};
}

function linkedLocalReferences(text){const refs=[];for(const match of text.matchAll(/\[([^\]]*)\]\(([^)\n]+)\)/g)){let raw=match[2].trim();if(raw.startsWith('<')&&raw.endsWith('>'))raw=raw.slice(1,-1);raw=raw.replace(/[?#].*$/,'').replace(/:\d+(?::\d+)?$/,'');try{if(raw.startsWith('file://'))raw=fileURLToPath(raw);else raw=decodeURIComponent(raw);}catch{continue}if(path.isAbsolute(raw))refs.push({path:raw,label:match[1]});}return refs;}
export function linkedLocalFiles(text){return linkedLocalReferences(text).map(ref=>ref.path);}


export function previewKind(file){const ext=path.extname(file).toLowerCase();return /\.draw\.?io$/i.test(file)?'drawio':['.html','.htm'].includes(ext)?'html':ext==='.md'?'markdown':['.png','.jpg','.jpeg','.webp','.svg'].includes(ext)?'image':['.csv','.tsv'].includes(ext)?'table':['.pdf','.docx','.xlsx','.xls','.pptx'].includes(ext)?'native':null;}
