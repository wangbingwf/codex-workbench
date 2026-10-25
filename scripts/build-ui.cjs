const fs=require('node:fs');
const root='plugins/codex-workbench/';
const icon='<img width="28" height="28" alt="" src="data:image/svg+xml;base64,'+fs.readFileSync(root+'assets/workbench.svg').toString('base64')+'">';
const css=fs.readFileSync(root+'ui/layout.css','utf8');
const js='const EN_STRINGS='+fs.readFileSync(root+'ui/en.json','utf8')+';\n'+fs.readFileSync(root+'ui/i18n.js','utf8')+'\n'+fs.readFileSync(root+'ui/app.js','utf8');
fs.writeFileSync(root+'ui/index.html',fs.readFileSync(root+'ui/shell.html','utf8').replace('<!--ICON-->',icon).replace('<!--STYLE-->','<style>'+css+'</style>').replace('<!--SCRIPT-->','<script>'+js+'</script>'));
