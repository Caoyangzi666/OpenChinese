(function(root){'use strict';
const TARGET=2800,MAX=4200;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
function elementAttributes(element){return [...element.attributes].map(a=>[a.name,a.value]);}
function createDocument(record,html){const doc=document.implementation.createHTMLDocument('');for(const [name,value] of record.htmlAttributes||[])doc.documentElement.setAttribute(name,value);doc.head.innerHTML=record.head;for(const [name,value] of record.bodyAttributes)doc.body.setAttribute(name,value);doc.body.innerHTML=html;return doc;}

// A spine item may contain a complete novel. Keep the rendered DOM bounded,
// preserving source markup and chapter identity rather than annotating it all.
async function plan(doc,engine,signal){
 check(signal);const nodes=[],ends=[],walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node,total=0,work=performance.now();
 while(node=walker.nextNode()){nodes.push({node,start:total,end:total+node.data.length});total+=node.data.length;}
 const text=nodes.map(n=>n.node.data).join('');
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i],block=n.node.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,pre,table,blockquote,div,section')||doc.body;
  if(block!==doc.body&&(!nodes[i+1]||!block.contains(nodes[i+1].node)))ends.push({offset:n.end,element:block});
 }
 const cuts=[];let start=0,endIndex=0,fallback=null;
 while(total-start>MAX){
  check(signal);while(endIndex<ends.length&&ends[endIndex].offset<=start)endIndex++;
  let cut=null;for(let i=endIndex;i<ends.length&&ends[i].offset<=start+MAX;i++){if(ends[i].offset>=start+TARGET){cut=ends[i];break;}}
  if(!cut){for(let i=endIndex;i<ends.length&&ends[i].offset<start+TARGET;i++)if(ends[i].offset>=start+TARGET/2)cut=ends[i];}
  if(!cut){const window=text.slice(start+TARGET,start+MAX),m=/[。！？!?；;，,、\n]/u.exec(window);if(m)cut={offset:start+TARGET+m.index+m[0].length};}
  if(!cut){
   // An unpunctuated, unusually long paragraph is cut only at actual word
   // boundaries. The cooperative engine keeps Back/Cancel usable meanwhile.
   if(!fallback){fallback=[];let offset=0;for(const token of await engine.segmentAsync(text,signal)){offset+=(token.word??token.text).length;fallback.push(offset);}}
   const offset=fallback.find(n=>n>=start+TARGET);if(!offset||offset>=total)break;cut={offset};
  }
  if(cut.offset<=start)break;cuts.push(cut);start=cut.offset;
  if(performance.now()-work>6){await tick();work=performance.now();}
 }
 const record={head:doc.head.innerHTML,htmlAttributes:elementAttributes(doc.documentElement),bodyAttributes:elementAttributes(doc.body),total,parts:[],prepared:new Map(),pending:new Map(),preparedCount:0,cacheHits:0,heading:doc.querySelector('h1,h2')?.textContent?.trim().slice(0,80)||''};
 let previous={node:doc.body,offset:0},previousOffset=0,nodeIndex=0;
 for(const cut of [...cuts,{offset:total,final:true}]){
  check(signal);let endpoint;
  if(cut.final)endpoint={node:doc.body,offset:doc.body.childNodes.length};
  else if(cut.element)endpoint={node:cut.element.parentNode,offset:[...cut.element.parentNode.childNodes].indexOf(cut.element)+1};
  else{while(nodeIndex<nodes.length-1&&nodes[nodeIndex].end<cut.offset)nodeIndex++;endpoint={node:nodes[nodeIndex].node,offset:cut.offset-nodes[nodeIndex].start};}
  const range=doc.createRange();range.setStart(previous.node,previous.offset);range.setEnd(endpoint.node,endpoint.offset);const body=doc.createElement('body');body.append(range.cloneContents());range.detach();
  record.parts.push({html:body.innerHTML,start:previousOffset,end:cut.offset});previous=endpoint;previousOffset=cut.offset;
  if(performance.now()-work>6){await tick();work=performance.now();}
 }
 return record;
}

function groups(doc){const result=[],walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let node,lastBlock=null,current=null,sourceOffset=0;
 while(node=walker.nextNode()){
  if(node.nodeType===Node.ELEMENT_NODE){if(['BR','HR','IMG','SVG'].includes(node.tagName)){current=null;lastBlock=null;}continue;}
  const beginning=sourceOffset;sourceOffset+=node.data.length;
  if(node.parentElement.closest('script,style,ruby,rt,rp,code,pre,textarea,.oc-token')){current=null;lastBlock=null;continue;}
  const block=node.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,div,section,article,blockquote,td,th,figcaption')||doc.body;
  if(block!==lastBlock||!current){current={text:'',nodes:[],sourceStart:beginning};result.push(current);lastBlock=block;}
  current.nodes.push({node,start:current.text.length,end:current.text.length+node.data.length});current.text+=node.data;
 }
 return result;
}
function makeToken(doc,token,content,index){
 const span=doc.createElement('span');span.className='oc-token';span.dataset.word=token.word;span.dataset.level=token.level;span.dataset.ocIndex=index;span.tabIndex=0;span.setAttribute('role','button');
 const ruby=(fragment,pinyin)=>{const element=doc.createElement('ruby');element.className='oc-ruby';const rb=doc.createElement('rb');rb.append(fragment);const rt=doc.createElement('rt');rt.textContent=pinyin;element.append(rb,rt);return element;};
 if(!token.pinyin){span.append(content);return span;}
 const characters=[...token.word],syllables=token.pinyin.split(/\s+/);
 if(characters.length>1&&characters.length===syllables.length){
  // Words can wrap between complete syllables, while the OUTER element
  // remains one word for HSK classification, dictionary lookup and cards.
  span.classList.add('oc-long');const leaves=[],walker=doc.createTreeWalker(content,NodeFilter.SHOW_TEXT);let n,offset=0;while(n=walker.nextNode()){leaves.push({node:n,start:offset,end:offset+n.data.length});offset+=n.data.length;}
  offset=0;for(let i=0;i<characters.length;i++){const end=offset+characters[i].length,first=leaves.find(n=>n.start<=offset&&n.end>offset),last=leaves.find(n=>n.start<end&&n.end>=end);const range=doc.createRange();range.setStart(first.node,offset-first.start);range.setEnd(last.node,end-last.start);let piece=range.cloneContents(),ancestor=range.commonAncestorContainer;if(ancestor.nodeType===Node.TEXT_NODE)ancestor=ancestor.parentNode;while(ancestor&&ancestor!==content){const wrapper=ancestor.cloneNode(false);wrapper.append(piece);piece=wrapper;ancestor=ancestor.parentNode;}const unit=doc.createElement('span');unit.className='oc-syllable';unit.dataset.ocOffset=String(token.sourceOffset+offset);unit.append(ruby(piece,syllables[i]));span.append(unit);range.detach();offset=end;}
 }else span.append(ruby(content,token.pinyin));
 return span;
}
async function prepare(record,index,engine,signal){
 check(signal);if(record.prepared.has(index)){record.cacheHits++;const value=record.prepared.get(index);record.prepared.delete(index);record.prepared.set(index,value);return value;}
 const pending=record.pending.get(index);if(pending&&!pending.signal?.aborted)return pending.promise;
 const job={signal};job.promise=(async()=>{
  const part=record.parts[index],doc=createDocument(record,part.html),tokens=[];let work=performance.now();
  for(const group of groups(doc)){
   check(signal);const segmented=await engine.segmentAsync(group.text,signal),words=[];let offset=0;
   for(const token of segmented){if(token.word)words.push({token:{...token,sourceOffset:part.start+group.sourceStart+offset},start:offset,end:offset+token.word.length});offset+=(token.word??token.text).length;}
   const base=tokens.length;tokens.push(...words.map(w=>w.token));
   if(group.nodes.length===1){
    // The common case: replace one paragraph text node ONCE, not once per word.
    const fragment=doc.createDocumentFragment();let offset=0,index=base;
    for(const token of segmented){const text=token.word??token.text;if(token.word){const content=doc.createDocumentFragment();content.append(doc.createTextNode(text));fragment.append(makeToken(doc,tokens[index],content,index++));}else fragment.append(doc.createTextNode(text));offset+=text.length;if(performance.now()-work>6){await tick();work=performance.now();check(signal);}}
    group.nodes[0].node.replaceWith(fragment);
   }else{
    for(let i=words.length-1;i>=0;i--){const {token,start,end}=words[i],first=group.nodes.find(n=>n.start<=start&&n.end>start),last=group.nodes.find(n=>n.start<end&&n.end>=end);const range=doc.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);const content=range.extractContents();range.insertNode(makeToken(doc,token,content,base+i));range.detach();if(performance.now()-work>6){await tick();work=performance.now();check(signal);}}
   }
   if(performance.now()-work>6){await tick();work=performance.now();}
  }
  check(signal);const value={html:doc.body.innerHTML,tokens};record.prepared.set(index,value);record.preparedCount++;while(record.prepared.size>5)record.prepared.delete(record.prepared.keys().next().value);return value;
 })().finally(()=>{if(record.pending.get(index)===job)record.pending.delete(index);});record.pending.set(index,job);return job.promise;
}
async function legacyPosition(record,position,engine,signal){
 if(Number.isFinite(position.characterOffset))return {section:Math.max(0,record.parts.findIndex(p=>p.end>position.characterOffset)),characterOffset:position.characterOffset};
 if(Number.isInteger(position.tokenIndex)&&position.tokenIndex>=0){let remaining=position.tokenIndex;
  for(let index=0;index<record.parts.length;index++){
   const part=record.parts[index],doc=createDocument(record,part.html);
   for(const group of groups(doc)){let offset=0;for(const token of await engine.segmentAsync(group.text,signal)){if(token.word){if(remaining===0)return {section:index,characterOffset:part.start+group.sourceStart+offset};remaining--;}offset+=(token.word??token.text).length;}}
  }
 }
 const characterOffset=Math.max(0,Math.min(record.total-1,Math.floor((position.scroll||0)*record.total))),section=Math.max(0,record.parts.findIndex(p=>p.end>characterOffset));return {section,characterOffset};
}
class Cache{
 constructor(){this.records=new Map();}
 get(key){const record=this.records.get(key);if(record){this.records.delete(key);this.records.set(key,record);}return record;}
 put(key,record){this.records.set(key,record);while(this.records.size>3)this.records.delete(this.records.keys().next().value);}
 forgetBook(id){for(const key of this.records.keys())if(key.startsWith(id+'\n'))this.records.delete(key);}
}
root.ChapterReader={plan,prepare,legacyPosition,createDocument,Cache,TARGET,MAX};
})(typeof window!=='undefined'?window:globalThis);
