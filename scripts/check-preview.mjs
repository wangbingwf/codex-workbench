import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderPreview,parseTable} from '../plugins/codex-workbench/preview.mjs';
import {previewKind} from '../plugins/codex-workbench/files.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-preview-'));
try{
 assert.equal(previewKind('a.draw.io'),'drawio');assert.equal(previewKind('A.HTML'),'html');assert.equal(previewKind('a.csv'),'table');assert.equal(previewKind('a.tex'),null);
 assert.deepEqual(parseTable('a,b\r\n"line\nnext","a""b"\r\n'),[['a','b'],['line\nnext','a"b']]);assert.throws(()=>parseTable('"unfinished'),/未闭合/);
 await fs.mkdir(root+'/inside');await fs.writeFile(root+'/private.js','SECRET_OUTSIDE_FILE');await fs.symlink(root+'/private.js',root+'/inside/link.js');await fs.writeFile(root+'/inside/app.js','document.body.dataset.loaded="yes";');await fs.writeFile(root+'/inside/report.html','<h1>报告</h1><script src="app.js"></script><script src="link.js"></script><script src="../private.js"></script>');
 const html=await renderPreview(root+'/inside/report.html');assert.match(html.html,/document.body.dataset.loaded/);assert.ok(!html.html.includes('SECRET_OUTSIDE_FILE'));assert.match(html.html,/connect-src 'none'/);assert.match(html.html,/form-action 'none'/);
 await fs.writeFile(root+'/note.md','# 文档标题\n\n**正文**');assert.match((await renderPreview(root+'/note.md')).html,/<h1>文档标题<\/h1>/);
 await fs.writeFile(root+'/table.csv','标题,内容\n一,<script>');assert.match((await renderPreview(root+'/table.csv')).html,/&lt;script&gt;/);
 await fs.writeFile(root+'/large.html',Buffer.alloc(12*1024*1024+1));await assert.rejects(()=>renderPreview(root+'/large.html'),/12 MB/);
 console.log('PASS: preview classification, Markdown/table rendering, escaped cells, local dependencies, symlink/traversal asset boundary and size limit');
}finally{await fs.rm(root,{recursive:true,force:true})}
