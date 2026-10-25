import {fileURLToPath} from 'node:url';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),base=fileURLToPath(root);
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','dist'].includes(e.name))continue;const p=path.join(dir,e.name);assert.ok(!e.isSymbolicLink(),'No symlinks in release');if(e.isDirectory())walk(p);else files.push(p)}}walk(base);
const forbidden=[/\/Users\/[^/\s]+\//,/BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY/,/gh[pousr]_[A-Za-z0-9]{30,}/,/sk-proj-[A-Za-z0-9_-]{30,}/];
for(const p of files){assert.ok(!/\.(jsonl|sqlite|db|log)$/.test(p),p);if(!/\.(png|jpg|gif|webm)$/.test(p)){const content=fs.readFileSync(p,'utf8');if(!p.endsWith('check-release.mjs'))for(const re of forbidden)assert.ok(!re.test(content),'Private data pattern in '+path.relative(base,p));}}
const manifest=JSON.parse(fs.readFileSync(new URL('../plugins/codex-workbench/plugin.json',import.meta.url)));
const compatibility=JSON.parse(fs.readFileSync(new URL('../plugins/codex-workbench/.codex-plugin/plugin.json',import.meta.url)));
assert.equal(manifest.version,compatibility.version);assert.ok(fs.existsSync(new URL('../LICENSE',import.meta.url)));console.log('PASS: release inventory, manifest versions, license, private-data patterns ('+files.length+' files)');
