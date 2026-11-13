"""Run browser regressions against an isolated quiet temporary HTTP server."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import subprocess,os,argparse

parser=argparse.ArgumentParser();parser.add_argument('--node',default='node');parser.add_argument('--tests',nargs='+',default=['ui','native-ui','gestures','preferences','reading','chapters']);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
class TestServer(ThreadingHTTPServer):
    # Chromium can open more connections at once than Windows' default backlog
    # of five. A refused JS request prevents app initialization altogether.
    request_queue_size=128
    daemon_threads=True
server=TestServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root/'app/src/main/assets')))
Thread(target=server.serve_forever,daemon=True).start()
env=os.environ.copy();bundled=Path(args.node).resolve().parent.parent/'node_modules'
if bundled.is_dir():env.setdefault('NODE_PATH',str(bundled))
env['OPENCHINESE_TEST_URL']='http://127.0.0.1:'+str(server.server_port)
try:
    for name in args.tests:
        subprocess.run([args.node,str(root/'tests'/(name+'.test.cjs'))],cwd=root,env=env,check=True)
finally:
    server.shutdown();server.server_close()
