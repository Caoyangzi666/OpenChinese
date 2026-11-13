const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../app/src/main/assets'),load=name=>JSON.parse(fs.readFileSync(path.join(base,'data',name+'.json')));
const {ChineseEngine}=require(path.join(base,'web/engine.js'));
(async()=>{const engine=new ChineseEngine(load('dictionary'),load('hsk'),load('hsk-supplement'),load('word-frequencies'));
 const samples=['第一章。我哥哥杰姆快满十三岁的时候。','看中文书，我不知道。','银行，音樂，学术，學習。','年龄、沾边儿，世界你好！',('今天读一点中文，然后保存新的词语。').repeat(400),'我'.repeat(1800)];
 for(const sample of samples)assert.deepEqual(await engine.segmentAsync(sample),engine.segment(sample));
 const controller=new AbortController();let beats=0;const interval=setInterval(()=>beats++,1);setTimeout(()=>controller.abort(),10);await assert.rejects(engine.segmentAsync('我'.repeat(15000),controller.signal),{name:'AbortError'});clearInterval(interval);assert(beats>0);
 console.log('PASS cooperative engine: synchronous/asynchronous token identity, large text, Traditional aliases, UI yielding and cancellation.');
})().catch(error=>{console.error(error);process.exit(1);});
