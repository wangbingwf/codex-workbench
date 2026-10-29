import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {scriptProvenance} from './script-provenance.mjs';
import {connect} from './codex-client.mjs';
const documentExt=new Set(['.md','.txt','.pdf','.docx','.xlsx','.xls','.pptx','.html','.htm','.svg','.png','.jpg','.jpeg','.webp','.drawio','.excalidraw','.tex']);
export function collectFiles(entries,cwd,scriptWrites=[]){
 const additions=new Map();for(const write of scriptWrites){if(!Number.isInteger(write.entryIndex)||write.entryIndex<0||write.entryIndex>=entries.length||entries[write.entryIndex].item?.type!=='commandExecution'||entries[write.entryIndex].item.exitCode!==0)continue;const rows=additions.get(write.entryIndex)||[];rows.push({completedAtMs:write.time,item:{type:'fileChange',status:'completed',changes:[{path:write.path,kind:{type:'script-write'}}]}});additions.set(write.entryIndex,rows);}
 const annotated=entries.flatMap((entry,index)=>[entry,...(additions.get(index)||[])]);
 const files=new Map();
 function record(raw,kind,time,base=cwd,label=''){if(!raw||/[\x00\r\n$`]/.test(raw))return;const file=path.resolve(base||cwd,raw);if(!documentExt.has(path.extname(file).toLowerCase())&&!/\.draw\.io$/i.test(file))return;const caption=label.trim().slice(0,140),stem=path.basename(file).replace(/(?:\.draw\.io|\.[^.]+)$/i,'').replace(/^\d+[_\s.-]+/,'').replace(/\s+/g,'');const meaningful=caption&&caption!==path.basename(file)&&caption.replace(/\s+/g,'')!==stem;const existing=files.get(file);if(existing){if(meaningful)existing.label=caption;if(kind!=='linked'||existing.kind==='linked'){if(existing.kind==='linked'&&kind!=='linked'){existing.kind=kind;existing.firstAt=time;}existing.lastAt=time??existing.lastAt;existing.deleted=kind==='delete';}}else if(kind!=='delete')files.set(file,{path:file,name:path.basename(file),kind,firstAt:time,lastAt:time,deleted:false,...(meaningful?{label:caption}:{})});}
 for(const entry of annotated){const i=entry.item;const time=entry.completedAtMs||entry.startedAtMs||null;
 if(i.type==='fileChange'&&i.status==='completed'){for(const c of i.changes){if(c.kind?.move_path){const old=path.resolve(cwd,c.path),to=path.resolve(cwd,c.kind.move_path);const previous=files.get(old);if(previous){files.delete(old);files.set(to,{...previous,path:to,name:path.basename(to),lastAt:time});}else record(to,'update',time);}else record(c.path,c.kind?.type||'update',time);}}
 if(i.type==='commandExecution'&&i.status==='completed'&&i.exitCode===0&&typeof i.command==='string'){
  // Only literal top-level cat heredoc writes are recognized; never execute or infer script contents.
  const command=unwrapShellCommand(i.command);if(command===null)continue;const lines=command.split('\n');for(let n=0;n<lines.length;n++){const line=lines[n];const delimiter=line.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*$/);if(!delimiter)continue;const write=line.match(/^\s*cat\s+(>>?)\s*(?:'([^']+)'|"([^"$`]+)"|([^\s'"$`;&|<>]+))\s*<<-?\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?\s*$/);if(write)record(write[2]||write[3]||write[4],'write',time,i.cwd||cwd);while(++n<lines.length&&lines[n].replace(/^\t+/,'')!==delimiter[1]){} }
 }
 }
 const deliveredPaths=new Set();for(const entry of entries){const i=entry.item;if(i.type==='agentMessage'&&i.phase!=='commentary'&&typeof i.text==='string')for(const ref of linkedLocalReferences(i.text)){const file=path.resolve(ref.path);deliveredPaths.add(file);if(files.has(file))record(file,'linked',null,cwd,ref.label);}}
 return [...files.values()].filter(f=>!f.deleted&&(f.kind!=='script-write'||!isTemporaryArtifact(f.path,cwd)||deliveredPaths.has(f.path))).sort((a,b)=>(a.firstAt??Infinity)-(b.firstAt??Infinity)||a.path.localeCompare(b.path));
}
export async function sessionFiles(id){
 if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw Error('会话 ID 无效');const c=connect();const meta=await c.call('thread/read',{threadId:id,includeTurns:false});const entries=[];let cursor;const seen=new Set();do{const r=await c.call('thread/items/list',{threadId:id,limit:100,sortDirection:'asc',cursor});entries.push(...r.data);cursor=r.nextCursor;if(cursor&&seen.has(cursor))throw Error('文件记录分页重复，请重试');seen.add(cursor);}while(cursor);
 const analysis=scriptProvenance(entries,meta.thread.cwd);const files=collectFiles(entries,meta.thread.cwd,analysis.writes);await Promise.all(files.map(async f=>{try{const stat=await fs.stat(f.path);f.exists=stat.isFile();f.previewKind=previewKind(f.path);}catch{f.exists=false;}}));return {id,files,note:(analysis.warning?analysis.warning+'。':'')+'仅展示会话中有成功文件变更或可识别的直接写入证据的文档；创建和修改均计入，单纯阅读或引用不计入。补充解析成功执行的历史 Python 脚本写入目标，不执行历史代码或读取脚本当前版本；无法解析的动态路径仍可能遗漏，不按当前文件时间猜测归属。'};
}

function linkedLocalReferences(text){const refs=[];for(const match of text.matchAll(/\[([^\]]*)\]\(([^)\n]+)\)/g)){let raw=match[2].trim();if(raw.startsWith('<')&&raw.endsWith('>'))raw=raw.slice(1,-1);raw=raw.replace(/[?#].*$/,'').replace(/:\d+(?::\d+)?$/,'');try{if(raw.startsWith('file://'))raw=fileURLToPath(raw);else raw=decodeURIComponent(raw);}catch{continue}if(path.isAbsolute(raw))refs.push({path:raw,label:match[1]});}return refs;}
export function linkedLocalFiles(text){return linkedLocalReferences(text).map(ref=>ref.path);}


export function previewKind(file){const ext=path.extname(file).toLowerCase();return /\.draw\.?io$/i.test(file)?'drawio':['.html','.htm'].includes(ext)?'html':ext==='.md'?'markdown':['.png','.jpg','.jpeg','.webp','.svg'].includes(ext)?'image':['.csv','.tsv'].includes(ext)?'table':['.pdf','.docx','.xlsx','.xls','.pptx'].includes(ext)?'native':null;}

// Decode the logged shell wrapper as data. Never evaluate or execute command text.
export function unwrapShellCommand(command){
 if(!/^\s*(?:\/[^\s]+\/)?(?:bash|zsh|sh)\s+-[a-z]*c\s+/.test(command))return command;
 const words=[];let token='',quote='',active=false;
 for(let n=0;n<command.length;n++){const c=command[n];if(quote==="'"){if(c==="'")quote='';else token+=c;continue}
 if(quote==='"'){if(c==='"'){quote='';continue}if(c==='\\'){const next=command[++n];if(next===undefined)return null;token+=(/["\\$`\n]/.test(next)?next:'\\'+next);continue}if(c==='$'||c==='`')return null;token+=c;continue}
 if(c==="'"||c==='"'){quote=c;active=true;continue}if(c==='\\'){if(++n>=command.length)return null;token+=command[n];active=true;continue}if(/\s/.test(c)){if(active){words.push(token);token='';active=false}continue}if(/[;$`|&<>]/.test(c))return null;token+=c;active=true;
 }if(quote)return null;if(active)words.push(token);return words.length===3?words[2]:null;
}

function isTemporaryArtifact(file,cwd){const inside=(base)=>file===base||file.startsWith(base+path.sep);if(inside(path.resolve(cwd)))return false;return [os.tmpdir(),'/tmp','/private/tmp'].some(base=>inside(path.resolve(base)));}
