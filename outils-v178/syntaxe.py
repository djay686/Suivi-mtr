import re,sys,subprocess,os
f=sys.argv[1]; out=sys.argv[2]
t=open(f,encoding='utf-8').read()
bad=0
for i,m in enumerate(re.finditer(r'<script(?:\s[^>]*)?>(.*?)</script>',t,re.S)):
    body=m.group(1)
    if not body.strip(): continue
    line=t.count('\n',0,m.start(1))+1
    p=os.path.join(out,f"b{i:02d}.js"); open(p,'w',encoding='utf-8').write(body)
    r=subprocess.run(["node","--check",p],capture_output=True,text=True)
    print(f"bloc {i:02d} ligne {line:>6} {len(body):>8} car : "+("OK" if r.returncode==0 else "ERREUR "+r.stderr.splitlines()[0:4].__str__()))
    bad+= r.returncode!=0
sys.exit(1 if bad else 0)
