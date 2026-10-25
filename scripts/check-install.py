"""Test local marketplace installation in a disposable Codex configuration."""
import os,json,subprocess,tempfile,shutil
from pathlib import Path
root=Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='workbench-install-') as tmp:
 base=Path(tmp);checkout=base/'repository';checkout.mkdir()
 for name in ['plugins','.agents']:shutil.copytree(root/name,checkout/name)
 (base/'codex-test-home').mkdir();env=dict(os.environ);env['CODEX_HOME']=str(base/'codex-test-home')
 def run(*args):
  r=subprocess.run(['codex',*args],cwd=checkout,env=env,text=True,capture_output=True,timeout=60)
  if r.returncode:raise RuntimeError('Command failed: '+' '.join(args)+'\n'+r.stderr[-2000:])
  return json.loads(r.stdout)
 run('plugin','marketplace','add','.', '--json')
 selector='codex-workbench@codex-workbench-community'
 def version(value):
  for filename in ['plugin.json','.codex-plugin/plugin.json']:
   p=checkout/'plugins/codex-workbench'/filename;d=json.loads(p.read_text());d['version']=value;p.write_text(json.dumps(d))
 assert run('plugin','add',selector,'--json')['version']=='0.9.0'
 version('0.9.1');assert run('plugin','add',selector,'--json')['version']=='0.9.1'
 version('0.9.0');assert run('plugin','add',selector,'--json')['version']=='0.9.0'
 run('plugin','remove',selector,'--json')
 print('PASS isolated marketplace: install -> update -> rollback -> uninstall; real config untouched')
