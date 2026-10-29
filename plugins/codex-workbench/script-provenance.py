"""Static provenance from recorded Python source. Never imports or executes user code."""
import ast,json,posixpath,re,shlex,sys
from pathlib import PurePosixPath as P
UNKNOWN=object()
class Analyzer:
 def __init__(self,cwd):self.cwd=cwd;self.scripts={};self.writes=[];self.steps=0;self.depth=0;self.index=0
 def absolute(self,value,cwd):return posixpath.normpath(str(value) if str(value).startswith('/') else posixpath.join(cwd,str(value)))
 def write(self,target,value,append,cwd,time):
  if not isinstance(target,(P,str)):return
  file=self.absolute(target,cwd)
  if any(c in file for c in '\x00\r\n$`'):return
  if file.endswith('.py'):
   if isinstance(value,str) and len(value)<2000000:self.scripts[file]=(self.scripts.get(file,'') if append else '')+value
   else:self.scripts.pop(file,None)
  else:self.writes.append({'path':file,'time':time,'kind':'write','entryIndex':self.index,'evidence':'python-write'})
 def ev(self,n,env,cwd,time):
  self.steps+=1
  if self.steps>150000:raise ValueError('analysis budget exceeded')
  if n is None:return UNKNOWN
  if isinstance(n,ast.Constant):return n.value
  if isinstance(n,ast.Name):return env.get(n.id,UNKNOWN)
  if isinstance(n,(ast.List,ast.Tuple)) and len(n.elts)<=1000:return [self.ev(x,env,cwd,time) for x in n.elts]
  if isinstance(n,ast.Dict) and len(n.keys)<=1000:return {self.ev(k,env,cwd,time):self.ev(v,env,cwd,time) for k,v in zip(n.keys,n.values)}
  if isinstance(n,ast.Subscript):
   v=self.ev(n.value,env,cwd,time);k=self.ev(n.slice,env,cwd,time)
   try:return v[k]
   except (KeyError,TypeError,IndexError):return UNKNOWN
  if isinstance(n,ast.JoinedStr):
   parts=[self.ev(v.value if isinstance(v,ast.FormattedValue) else v,env,cwd,time) for v in n.values]
   return ''.join(map(str,parts)) if all(v is not UNKNOWN for v in parts) and sum(len(str(v)) for v in parts)<=2000000 else UNKNOWN
  if isinstance(n,ast.BinOp):
   a=self.ev(n.left,env,cwd,time);b=self.ev(n.right,env,cwd,time)
   if a is UNKNOWN or b is UNKNOWN:return UNKNOWN
   try:
    if isinstance(n.op,ast.Div) and isinstance(a,P) and isinstance(b,str):return a/b
    if isinstance(n.op,ast.Add) and isinstance(a,(str,list)) and isinstance(b,type(a)) and len(a)+len(b)<=2000000:return a+b
   except (TypeError,ValueError):pass
   return UNKNOWN
  if isinstance(n,ast.Attribute):
   a=self.ev(n.value,env,cwd,time)
   if isinstance(a,P) and n.attr in ['parent','name','stem','suffix']:return getattr(a,n.attr)
   return UNKNOWN
  if isinstance(n,ast.Call):
   args=[self.ev(a,env,cwd,time) for a in n.args]
   if isinstance(n.func,ast.Name):
    if env.get(n.func.id)=='pathlib.Path' and len(args)==1 and isinstance(args[0],(str,P)):return P(args[0])
    if n.func.id=='open' and args and isinstance(args[0],(str,P)):
     mode=args[1] if len(args)>1 else next((self.ev(k.value,env,cwd,time) for k in n.keywords if k.arg=='mode'),'r')
     return ('file',args[0],mode)
    return UNKNOWN
   if isinstance(n.func,ast.Attribute):
    name=n.func.attr;a=self.ev(n.func.value,env,cwd,time)
    if isinstance(a,P):
     if name in ['write_text','write_bytes']:
      self.write(a,args[0] if args else UNKNOWN,False,cwd,time);return UNKNOWN
     if name=='read_text':return self.scripts.get(self.absolute(a,cwd),UNKNOWN)
     if name in ['resolve','absolute']:return P(self.absolute(a,cwd))
     if name=='with_suffix' and args and isinstance(args[0],str):return a.with_suffix(args[0])
    if isinstance(a,tuple) and len(a)==3 and a[0]=='file':
     if name=='write' and isinstance(a[2],str) and any(c in a[2] for c in 'wax'):self.write(a[1],args[0] if args else UNKNOWN,'a' in a[2],cwd,time)
     if name=='read':return self.scripts.get(self.absolute(a[1],cwd),UNKNOWN)
    if isinstance(a,str) and all(x is not UNKNOWN for x in args):
     try:
      if name=='replace' and len(args) in [2,3] and all(isinstance(x,str) for x in args[:2]) and (len(args)==2 or isinstance(args[2],int)):
       count=a.count(args[0]) if len(args)==2 or args[2]<0 else min(a.count(args[0]),args[2])
       if len(a)+count*max(0,len(args[1])-len(args[0]))<=2000000:return a.replace(*args)
      if name=='join' and len(args)==1 and isinstance(args[0],list) and all(isinstance(x,str) for x in args[0]) and sum(map(len,args[0]))+len(a)*len(args[0])<=2000000:return a.join(args[0])
     except (TypeError,ValueError):pass
    if isinstance(n.func.value,ast.Name) and env.get(n.func.value.id)=='runpy' and name=='run_path' and args and isinstance(args[0],str):return self.python(self.scripts.get(self.absolute(args[0],cwd),''),cwd,time,self.absolute(args[0],cwd))
   return UNKNOWN
  return UNKNOWN
 def assign(self,node,value,env):
  if isinstance(node,ast.Name):env[node.id]=value
  elif isinstance(node,(ast.Tuple,ast.List)):
   for i,x in enumerate(node.elts):self.assign(x,value[i] if isinstance(value,list) and i<len(value) else UNKNOWN,env)
 def block(self,nodes,env,cwd,time):
  for n in nodes:
   if isinstance(n,ast.ImportFrom) and n.module=='pathlib':
    for alias in n.names:
     if alias.name=='Path':env[alias.asname or alias.name]='pathlib.Path'
   elif isinstance(n,ast.Import):
    for alias in n.names:
     if alias.name=='runpy':env[alias.asname or alias.name]='runpy'
   elif isinstance(n,(ast.Assign,ast.AnnAssign)):
    v=self.ev(n.value,env,cwd,time)
    for target in (n.targets if isinstance(n,ast.Assign) else [n.target]):self.assign(target,v,env)
   elif isinstance(n,ast.Expr):self.ev(n.value,env,cwd,time)
   elif isinstance(n,ast.With):
    for item in n.items:
     value=self.ev(item.context_expr,env,cwd,time)
     if item.optional_vars:self.assign(item.optional_vars,value,env)
    self.block(n.body,env,cwd,time)
   elif isinstance(n,ast.For):
    values=self.ev(n.iter,env,cwd,time)
    if isinstance(values,list) and len(values)<=100:
     for value in values:self.assign(n.target,value,env);self.block(n.body,env,cwd,time)
   elif isinstance(n,(ast.Raise,ast.Return)):break
   elif isinstance(n,ast.If):
    test=self.ev(n.test,env,cwd,time)
    if test is not UNKNOWN:self.block(n.body if test else n.orelse,env,cwd,time)
    else:
     for child in ast.walk(n):
      if isinstance(child,ast.Name) and isinstance(child.ctx,ast.Store):env[child.id]=UNKNOWN
 def python(self,source,cwd,time,file=None):
  if not source or len(source)>2000000 or self.depth>8:return {}
  try:tree=ast.parse(source)
  except (SyntaxError,ValueError,MemoryError):return {}
  env={'__file__':file} if file else {};self.depth+=1
  try:self.block(tree.body,env,cwd,time)
  finally:self.depth-=1
  return env
 def shell(self,command,cwd,time,source_only=False):
  try:
   outer=shlex.split(command)
   if len(outer)==3 and P(outer[0]).name in ['sh','bash','zsh'] and re.fullmatch('-[a-z]*c',outer[1]):command=outer[2]
  except ValueError:return
  lines=command.splitlines();i=0
  while i<len(lines):
   line=lines[i];match=re.search(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z_0-9]*)['\"]?\s*$",line)
   if match:
    body=[];i+=1
    while i<len(lines) and lines[i].lstrip('\t')!=match[1]:body.append(lines[i]);i+=1
    if i>=len(lines):return
    code='\n'.join(body)+'\n'
    try:words=shlex.split(line[:match.start()].strip())
    except ValueError:words=[]
    if not source_only and words and re.fullmatch(r'python(?:3(?:\.\d+)?)?',P(words[0]).name) and (words[1:] in [[],['-'],['-u','-']]):self.python(code,cwd,time)
    else:
     cat=re.fullmatch(r"\s*cat\s+(>>?)\s*('(?:[^']*)'|\"[^\"]*\"|[^\s;&|<>]+)\s*",line[:match.start()])
     if cat:
      try:
       target=shlex.split(cat[2])[0]
       if not source_only or target.endswith('.py'):self.write(target,code,cat[1]=='>>',cwd,time)
      except (ValueError,IndexError):pass
   else:
    try:words=shlex.split(line)
    except ValueError:words=[]
    if not source_only and len(words)==2 and re.fullmatch(r'python(?:3(?:\.\d+)?)?',P(words[0]).name) and words[1].endswith('.py'):
     target=self.absolute(words[1],cwd);self.python(self.scripts.get(target,''),cwd,time,target)
   i+=1
 def rows(self,rows):
  for self.index,entry in enumerate(rows):
   item=entry['item'];time=entry.get('completedAtMs') or entry.get('startedAtMs');cwd=item.get('cwd') or self.cwd
   if item['type']=='fileChange' and item.get('status')=='completed':
    for change in item.get('changes',[]):
     target=self.absolute(change['path'],self.cwd)
     if target.endswith('.py'):
      if change.get('kind',{}).get('type')=='add':self.scripts[target]=change.get('diff','')
      else:
       updated=apply_patch(self.scripts.get(target),change.get('diff',''))
       if updated is None:self.scripts.pop(target,None)
       else:self.scripts[target]=updated
   elif item['type']=='commandExecution' and item.get('status') in ['completed','failed'] and isinstance(item.get('exitCode'),int):self.shell(item.get('command',''),cwd,time,source_only=item.get('exitCode')!=0)
  return self.writes

def apply_patch(source,diff):
 if source is None:return None
 lines=source.splitlines(keepends=True);out=[];position=0;patch=diff.splitlines(keepends=True);i=0
 while i<len(patch):
  header=re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@',patch[i])
  if not header:return None
  start=max(0,int(header[1])-1)
  if start<position or start>len(lines):return None
  out.extend(lines[position:start]);position=start;i+=1
  old_count=new_count=0
  while i<len(patch) and not patch[i].startswith('@@ '):
   line=patch[i];i+=1
   if line.startswith('\\ No newline'):continue
   if not line or line[0] not in ' +-':return None
   if line[0] in ' -':
    if position>=len(lines) or lines[position].rstrip('\n')!=line[1:].rstrip('\n'):return None
    position+=1;old_count+=1
   if line[0] in ' +':out.append(line[1:]);new_count+=1
  if old_count!=int(header[2] or 1) or new_count!=int(header[4] or 1):return None
 out.extend(lines[position:]);return ''.join(out)

if __name__=='__main__':
 try:
  data=json.load(sys.stdin);result=Analyzer(data['cwd']).rows(data['rows']);print(json.dumps({'writes':result}))
 except (ValueError,TypeError,KeyError,RecursionError) as e:print(json.dumps({'writes':[],'warning':'Static script analysis unavailable'}))
