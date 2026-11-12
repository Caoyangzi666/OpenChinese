"""Run browser regressions against an isolated quiet temporary HTTP server."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import subprocess,os,argparse

parser=argparse.ArgumentParser();parser.add_argument('--node',default='node');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root/'app/src/main/assets')))
Thread(target=server.serve_forever,daemon=True).start()
env=os.environ.copy();env['OPENCHINESE_TEST_URL']='http://127.0.0.1:'+str(server.server_port)
try:
    for name in ['ui','native-ui','gestures','preferences']:
        subprocess.run([args.node,str(root/'tests'/(name+'.test.cjs'))],cwd=root,env=env,check=True)
finally:
    server.shutdown();server.server_close()
