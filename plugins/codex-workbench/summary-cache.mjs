import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export const summaryDirectory=()=>process.env.WORKBENCH_DATA_DIR||path.join(os.homedir(),'.codex','workbench-data');
export async function readCardSummary(thread){if(!/^[0-9a-f-]{36}$/i.test(thread.id))return null;try{const r=JSON.parse(await fs.readFile(path.join(summaryDirectory(),thread.id+'.json'),'utf8'));if(!r.overview||!['goal','progress'].every(k=>typeof r.overview[k]==='string'&&r.overview[k].length>0&&r.overview[k].length<=1400))return null;return {goal:r.overview.goal,progress:r.overview.progress,generatedAt:r.generatedAt,sourceUpdatedAt:r.sourceUpdatedAt,stale:r.sourceUpdatedAt!==thread.updatedAt};}catch{return null}}
export async function attachCardSummaries(threads){let next=0;await Promise.all(Array.from({length:8},async()=>{while(next<threads.length){const t=threads[next++];t.summary=await readCardSummary(t)}}));return threads;}
