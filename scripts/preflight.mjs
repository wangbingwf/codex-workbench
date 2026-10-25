import {spawnSync} from 'node:child_process';
const checks=[];
checks.push({name:'Node.js',ok:Number(process.versions.node.split('.')[0])>=20,detail:process.version});
const executable=process.env.CODEX_CLI_PATH||'codex';
const cli=spawnSync(executable,['--version'],{encoding:'utf8',timeout:10000});
checks.push({name:'Codex CLI',ok:cli.status===0,detail:cli.error?.code||cli.stdout?.trim()||'Unable to run Codex CLI'});
checks.push({name:'Supported platform',ok:process.platform==='darwin',detail:process.platform==='darwin'?'macOS: tested platform':'Not yet validated; experimental only'});
console.log(JSON.stringify({ready:checks.every(c=>c.ok),checks,note:'Checks dependencies only. Codex desktop login, sidebar entry and model access require host acceptance.'},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;
