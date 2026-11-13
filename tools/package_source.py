"""Package corresponding source, excluding build outputs and private signing material."""
from pathlib import Path
import argparse, hashlib, json, zipfile
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--apk',type=Path,default=root/'dist/OpenChinese-v0.1.6-alpha.apk');parser.add_argument('--output',type=Path,default=root/'dist');args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.apk) as apk:
    assert apk.testzip() is None
    assert apk.read('classes.dex').startswith(b'dex\n')
    for file in (root/'app/src/main/assets').rglob('*'):
        if file.is_file():assert apk.read('assets/'+file.relative_to(root/'app/src/main/assets').as_posix())==file.read_bytes()
target=args.output/'OpenChinese-v0.1.6-alpha-source.zip'
excluded={'build','dist','.git','.gradle','__pycache__','node_modules'}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for file in root.rglob('*'):
        rel=file.relative_to(root)
        if not file.is_file() or any(part in excluded for part in rel.parts) or file.name=='local.properties' or file.suffix in {'.jks','.keystore','.apk','.idsig','.args'}:continue
        z.write(file,'OpenChinese/'+rel.as_posix())
with zipfile.ZipFile(target) as z:assert z.testzip() is None
sha=hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix('.zip.sha256').write_text(sha+'  '+target.name+'\n',encoding='utf8')
print(json.dumps({'source':str(target),'bytes':target.stat().st_size,'sha256':sha,'apk_assets_match':True}))
