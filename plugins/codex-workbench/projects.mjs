import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function projectIndex(){
 try{const state=JSON.parse(fs.readFileSync(path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'.codex-global-state.json'),'utf8'));
 const all=state['local-projects']||{};const active=state['project-order'];if(!Array.isArray(active))throw Error('无法识别 Codex 项目列表');const projects=Object.fromEntries(active.filter(id=>all[id]&&!id.startsWith('g-p-')).map(id=>[id,all[id]]));const ids=new Map(Object.entries(projects));
 for(const [host,mapping] of Object.entries(state['app-server-project-id-by-legacy-project-id-by-host']||{})){if(!host.startsWith('local:'))continue;for(const [legacy,canonical] of Object.entries(mapping))if(projects[legacy])ids.set(canonical,projects[legacy]);}
 return {ids,assignments:state['thread-project-assignments']||{},projectless:new Set(state['projectless-thread-ids']||[]),hints:state['thread-workspace-root-hints']||{},projects:Object.values(projects)};
 }catch{return {ids:new Map(),assignments:{},projectless:new Set(),hints:{},projects:[]};}
}
export function resolveProject(t,index){
 if(index.projectless.has(t.id))return {project:'unassigned',projectName:'未归类',projectPath:t.cwd||''};
 const assignment=index.assignments[t.id];let p=index.ids.get(t.projectId)||index.ids.get(assignment?.projectId);
 if(p)return {project:'project:'+p.id,projectName:p.name,projectPath:p.rootPaths?.[0]||t.cwd||''};
 return {project:'unassigned',projectName:'未归类',projectPath:t.cwd||''};
}
