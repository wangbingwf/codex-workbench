import assert from 'node:assert/strict';
import {contextFromTurns,validOverview} from '../plugins/codex-workbench/overview.mjs';
const t=(id,text)=>({id,startedAt:1,status:'completed',items:[{type:'userMessage',content:[{type:'text',text}]},{type:'commandExecution',command:'secret command'},{type:'agentMessage',text:'结果'}]});
const context=contextFromTurns([t('1','最初需求')],[t('3','最新更正'),t('2','中间更正'),t('1','最初需求')]);assert.equal(context.length,3);assert.equal(context[0].messages[0].text,'最初需求');assert.equal(context.at(-1).messages[0].text,'最新更正');assert.ok(!JSON.stringify(context).includes('secret command'));assert.ok(validOverview({goal:'目标',progress:'进展',next:'待确认'}));assert.ok(!validOverview({goal:'目标',progress:[],next:'无'}));console.log('PASS: 摘要上下文保留初始目标和最新调整、重复轮次去重、工具输出排除、结果格式校验');
