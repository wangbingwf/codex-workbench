import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readCardSummary,attachCardSummaries} from '../plugins/codex-workbench/summary-cache.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-cards-'));process.env.WORKBENCH_DATA_DIR=dir;const id='00000000-0000-0000-0000-000000000001';
try{const file=path.join(dir,id+'.json');await fs.writeFile(file,JSON.stringify({overview:{goal:'历史任务目标',progress:'关键进展',next:'待确认'},sourceUpdatedAt:100,generatedAt:200}));const current=await readCardSummary({id,updatedAt:100});assert.equal(current.goal,'历史任务目标');assert.equal(current.stale,false);const outdated=await readCardSummary({id,updatedAt:101});assert.equal(outdated.progress,'关键进展');assert.equal(outdated.stale,true);assert.equal(await readCardSummary({id:'../outside',updatedAt:100}),null);await fs.writeFile(file,'invalid');assert.equal(await readCardSummary({id,updatedAt:100}),null);const rows=await attachCardSummaries([{id,updatedAt:100}]);assert.equal(rows[0].summary,null);console.log('PASS: 列表复用磁盘摘要、旧版标记、缺失/损坏缓存回退、非法路径拒绝；不启动模型');}finally{await fs.rm(dir,{recursive:true,force:true})}
