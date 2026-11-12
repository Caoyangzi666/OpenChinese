"""Reproducible local APK build with official Android build-tools and JDK 17.
No third-party application libraries or network access are needed once tools exist.
Usage: python tools/build_apk.py --toolchain ../work/android-toolchain
"""
from pathlib import Path
import subprocess,zipfile,shutil,argparse,hashlib,json,os
from PIL import Image
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--toolchain',type=Path,default=root.parent/'work/android-toolchain');args=parser.parse_args();tools=args.toolchain.resolve()
jdk=next((tools/'jdk').glob('*/bin/java.exe')).parent;bt=next((tools/'buildtools').rglob('aapt2.exe')).parent;android=next((tools/'platform').rglob('android.jar'))
build=root/'build';build.mkdir(exist_ok=True);classes=build/'classes';classes.mkdir(exist_ok=True);generated=build/'generated';generated.mkdir(exist_ok=True);dex=build/'dex';dex.mkdir(exist_ok=True)
def run(cmd):
    r=subprocess.run([str(x) for x in cmd],cwd=root,text=True,capture_output=True)
    if r.stdout:print(r.stdout,flush=True)
    if r.returncode:print(r.stderr,flush=True);raise SystemExit(r.returncode)
    if r.stderr:print(r.stderr,flush=True)
logo=Image.open(root/'branding/OpenChinese-logo.png')
res=root/'app/src/main/res'
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=res/('mipmap-'+density);folder.mkdir(exist_ok=True);logo.resize((size,size),Image.Resampling.LANCZOS).save(folder/'ic_launcher.png')
run([bt/'aapt2.exe','compile','--dir',res,'-o',build/'resources.zip'])
manifest=build/'AndroidManifest.xml'
manifest.write_text((root/'app/src/main/AndroidManifest.xml').read_text().replace('<manifest ', '<manifest package="org.openchinese.reader" ',1),encoding='utf8')
run([bt/'aapt2.exe','link','--auto-add-overlay','-o',build/'resources.apk','-I',android,'--manifest',manifest,'--java',generated,'--min-sdk-version','26','--target-sdk-version','35','--version-code','5','--version-name','0.1.4-alpha','-R',build/'resources.zip','-A',root/'app/src/main/assets'])
sources=list((root/'app/src/main/java').rglob('*.java'))+list(generated.rglob('*.java'))
compile_api=build/'android-api35.jar'
shutil.copy2(android,compile_api)
run([jdk/'javac.exe','-encoding','UTF-8','-source','8','-target','8','-classpath',compile_api,'-d',classes,*sources])
classjar=build/'classes.jar'
with zipfile.ZipFile(classjar,'w') as z:
    for p in classes.rglob('*.class'):z.write(p,p.relative_to(classes).as_posix())
run([jdk/'java.exe','-cp',bt/'lib/d8.jar','com.android.tools.r8.D8','--lib',android,'--min-api','26','--output',dex,classjar])
unsigned=build/'unsigned.apk'
with zipfile.ZipFile(build/'resources.apk') as resources,zipfile.ZipFile(unsigned,'w') as z:
    for info in resources.infolist():z.writestr(info.filename,resources.read(info.filename),compress_type=info.compress_type)
    for f in dex.glob('*.dex'):z.write(f,f.name,compress_type=zipfile.ZIP_DEFLATED)
run([bt/'zipalign.exe','-f','4',unsigned,build/'aligned.apk'])
required=['OPENCHINESE_KEYSTORE','OPENCHINESE_KEY_ALIAS','OPENCHINESE_STORE_PASS']
missing=[name for name in required if not os.environ.get(name)]
if missing:raise SystemExit('Set signing environment variables: '+', '.join(missing))
key=Path(os.environ['OPENCHINESE_KEYSTORE']).expanduser().resolve()
if not key.is_file():raise SystemExit('Signing keystore does not exist: '+str(key))
if not os.environ.get('OPENCHINESE_KEY_PASS'):os.environ['OPENCHINESE_KEY_PASS']=os.environ['OPENCHINESE_STORE_PASS']
out=root/'dist';out.mkdir(exist_ok=True);target=out/'OpenChinese-v0.1.4-alpha.apk'
run([jdk/'java.exe','-jar',bt/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias',os.environ['OPENCHINESE_KEY_ALIAS'],'--ks-pass','env:OPENCHINESE_STORE_PASS','--key-pass','env:OPENCHINESE_KEY_PASS','--out',target,build/'aligned.apk'])
run([jdk/'java.exe','-jar',bt/'lib/apksigner.jar','verify','--verbose',target]);run([bt/'zipalign.exe','-c','4',target]);run([bt/'aapt2.exe','dump','badging',target])
target.with_suffix('.apk.sha256').write_text(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name+'\n')
print(json.dumps({'apk':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
