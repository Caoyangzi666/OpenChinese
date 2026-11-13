(function(root){'use strict';
function han(c){const n=c.codePointAt(0);return n>=0x3400&&n<=0x9fff||n>=0xf900&&n<=0xfaff||n>=0x20000&&n<=0x323af;}
class ChineseEngine{
 constructor(dictionary,levels,supplement={},frequencies={}){this.dictionary=dictionary;this.levels=levels;this.supplement=supplement;this.frequencies=frequencies;this.logTotal=Math.log(60101967);this.words=new Set([...Object.keys(dictionary),...Object.keys(levels),...Object.keys(supplement)]);this.max=1;for(const w of this.words)if([...w].every(han))this.max=Math.max(this.max,[...w].length);this.cache=new Map();this.classifications=new Map();}
 entry(word){const raw=this.dictionary[word];if(!raw)return null;return {pinyin:raw[0],meaning:raw[1],simplified:raw[2]||word,traditional:raw[3]||word,readings:(raw[4]||[[raw[0],raw[1]]]).map(r=>({pinyin:r[0],meaning:r[1]}))};}
 direct(word,entry){let result=0,source='non_hsk';for(const w of [word,entry?.simplified,entry?.traditional]){const l=this.levels[w];if(l&&(!result||l<result)){result=l;source='syllabus';}}if(!result)for(const w of [word,entry?.simplified,entry?.traditional]){const l=this.supplement[w]?.level;if(l&&(!result||l<result)){result=l;source='supplement';}}return {level:result,source};}
 classify(word,entry){if(this.classifications.has(word))return this.classifications.get(word);entry=entry||this.entry(word);let result=this.direct(word,entry);if(!result.level){
   // Only explicit productive grammatical patterns are inferred. Arbitrary
   // dictionary compounds are NOT assigned the maximum level of their characters.
   const forms=['起来','下来','出来','进去','回来','下去','上来','过去','过来','着','了','过','到','完','好','见','出','进','回','开','上','下'];
   for(const written of new Set([word,entry?.simplified,entry?.traditional].filter(Boolean))){
    for(const suffix of forms){if(!written.endsWith(suffix)||written.length<=suffix.length)continue;const stem=written.slice(0,-suffix.length);const a=this.direct(stem,this.entry(stem)),b=this.direct(suffix,this.entry(suffix));if(a.level&&b.level){result={level:Math.max(a.level,b.level),source:'derived',parts:[{word:stem,level:a.level},{word:suffix,level:b.level}]};break;}}
    if(!result.level){for(const prefix of ['不','很','更','最']){if(!written.startsWith(prefix)||written.length<=prefix.length)continue;const stem=written.slice(prefix.length),a=this.direct(prefix,this.entry(prefix)),b=this.direct(stem,this.entry(stem));if(a.level&&b.level){result={level:Math.max(a.level,b.level),source:'derived',parts:[{word:prefix,level:a.level},{word:stem,level:b.level}]};break;}}}
    if(!result.level){const m=written.match(/^(想)(要)$|^(每)([天年月周次])$|^([一二三四五六七八九十百千万两几每])([个本杯块张条只位])(.+)$/u);if(m){const parts=m.slice(1).filter(Boolean).map(part=>({word:part,level:this.direct(part,this.entry(part)).level}));if(parts.every(p=>p.level))result={level:Math.max(...parts.map(p=>p.level)),source:'derived',parts};}}
    if(!result.level){const m=written.match(/^([一二三四五六七八九十百千万两几每])([个次天年月本杯块张条只位])$/u);if(m){const a=this.direct(m[1],this.entry(m[1])),b=this.direct(m[2],this.entry(m[2]));if(a.level&&b.level)result={level:Math.max(a.level,b.level),source:'derived',parts:[{word:m[1],level:a.level},{word:m[2],level:b.level}]};}}
    if(!result.level&&/^(?:第)?[零〇一二三四五六七八九十百千万亿两]+$/u.test(written)){const parts=[...written].map(part=>({word:part,level:this.direct(part,this.entry(part)).level}));if(parts.every(p=>p.level))result={level:Math.max(...parts.map(p=>p.level)),source:'derived',parts};}
    // Explicit transparent verb-object phrases, not arbitrary character compounds.
    const verbObjects={'吃饭':['吃','饭'],'吃飯':['吃','飯'],'看书':['看','书'],'看書':['看','書'],'喝水':['喝','水']};
    if(!result.level&&verbObjects[written]){const parts=verbObjects[written].map(part=>({word:part,level:this.direct(part,this.entry(part)).level}));if(parts.every(p=>p.level))result={level:Math.max(...parts.map(p=>p.level)),source:'derived',parts};}
    if(result.level)break;
   }
 }this.classifications.set(word,result);return result;}
 level(word,entry){return this.classify(word,entry).level;}
 // Word probabilities are fixed data. The selected HSK level is deliberately
 // absent here: it can ONLY affect show(), never segmentation or pronunciation.
 *buildRun(run){if(this.cache.has(run))return this.cache.get(run);const chars=[...run],size=chars.length,out=[],route=Array(size+1),boundaries=new Set();
  // Reading construction: verb + language + reading material. Prevent a
  // lexical match such as 看中 from swallowing the beginning of 中文书.
  const reading=/看(中文|英文|汉语|漢語|英语|英語|法语|法語|日语|日語)(书|書|报纸|報紙|小说|小說|课文|課文)/gu;let match;while((match=reading.exec(run))){const begin=[...run.slice(0,match.index)].length;boundaries.add(begin+1);boundaries.add(begin+1+[...match[1]].length);}
  route[size]={score:0,end:size};
  for(let i=size-1;i>=0;i--){let best=null;for(let n=1;n<=Math.min(this.max,size-i);n++){const word=chars.slice(i,i+n).join('');if(n>1&&!this.words.has(word))continue;if([...boundaries].some(b=>i<b&&i+n>b))continue;const frequency=this.frequencies[word]||1;const score=Math.log(frequency)-this.logTotal+route[i+n].score;if(!best||score>best.score||(score===best.score&&i+n>best.end))best={score,end:i+n};}route[i]=best;if(i%128===0)yield;}
  // An isolated syllabus word is a dictionary lookup, not an ambiguous sentence.
  if(this.levels[run]||this.supplement[run])route[0]={score:0,end:size};
  for(let i=0;i<size;){const end=route[i].end,word=chars.slice(i,end).join(''),entry=this.entry(word);let pinyin=entry?.pinyin||'';
   if(!pinyin&&this.levels[word]&&end-i>1){const parts=[...word].map(c=>this.entry(c)?.pinyin);if(parts.every(Boolean))pinyin=parts.join(' ');}
   const classification=this.classify(word,entry);out.push({word,pinyin,meaning:entry?.meaning||'',readings:entry?.readings||[],simplified:entry?.simplified||word,traditional:entry?.traditional||word,level:classification.level,classification});i=end;if(out.length%128===0)yield;}
  if(this.cache.size>1500)this.cache.clear();if(run.length<=5000)this.cache.set(run,out);return out;}


 segmentRun(run){const work=this.buildRun(run);let step;do{step=work.next();}while(!step.done);return step.value;}
 async segmentRunAsync(run,signal){const work=this.buildRun(run);let step,start=performance.now();do{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');step=work.next();if(!step.done&&performance.now()-start>=6){await new Promise(resolve=>setTimeout(resolve,0));start=performance.now();}}while(!step.done);return step.value;}
 async segmentAsync(text,signal){const chunks=[];let run='',isHan=null,start=performance.now();const flush=async()=>{if(!run)return;if(isHan)chunks.push(...await this.segmentRunAsync(run,signal));else chunks.push({text:run});run='';if(performance.now()-start>=6){await new Promise(resolve=>setTimeout(resolve,0));start=performance.now();}if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};for(const c of text){const h=han(c);if(isHan!==null&&h!==isHan)await flush();run+=c;isHan=h;}await flush();return chunks;}

 segment(text){const chunks=[];let run='',isHan=null;function flush(engine){if(!run)return;if(isHan)chunks.push(...engine.segmentRun(run));else chunks.push({text:run});run='';}for(const c of text){const h=han(c);if(isHan!==null&&h!==isHan)flush(this);run+=c;isHan=h;}flush(this);return chunks;}
 show(token,selected,enabled=true){return enabled&&!!token.pinyin&&(!token.level||token.level>=selected);}
}
root.ChineseEngine=ChineseEngine;if(typeof module!=='undefined')module.exports={ChineseEngine,han};
})(typeof window!=='undefined'?window:globalThis);
