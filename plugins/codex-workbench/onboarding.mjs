import fs from 'node:fs/promises';
import path from 'node:path';
import {summaryDirectory} from './summary-cache.mjs';
export async function onboarding(action='read',language){
 if(!['read','accept','skip','language'].includes(action))throw Error('无效引导操作');
 const file=path.join(summaryDirectory(),'onboarding.json');
 if(action==='language'&&!['auto','zh-CN','en'].includes(language))throw Error('无效语言选项');
 if(action!=='read'){const previous=await onboarding();const next={...previous,...(action==='language'?{language}:{decision:action})};await fs.mkdir(summaryDirectory(),{recursive:true});await fs.writeFile(file,JSON.stringify(next),{mode:0o600});return next;}
 try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {decision:null};throw e;}
}
