(function(root){'use strict';
const HOLD_MS=400,MOVE_LIMIT=12,HOLD_OPTIONS=Object.freeze([300,400,500,700,1000]);
function normalizeHold(ms){return HOLD_OPTIONS.includes(ms)?ms:HOLD_MS;}
function releaseAction({dx,dy,duration,x,width}){if(duration<=1500&&Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.4)return dx<0?'next':'previous';if(duration<=500&&Math.hypot(dx,dy)<=MOVE_LIMIT){if(x<width*.24)return 'previous';if(x>width*.76)return 'next';}return null;}
class ReaderGestures{
 constructor(doc,{onTurn,onWord,holdMs=HOLD_MS}){this.doc=doc;this.win=doc.defaultView;this.onTurn=onTurn;this.onWord=onWord;this.active=null;this.listeners=[];this.setHoldDuration(holdMs);
  const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));};
  // A touch released after the sheet opens can synthesize a click on its backdrop.
  // Keep that release from dismissing the dictionary, even across the iframe edge.
  const parent=doc.defaultView.frameElement?.ownerDocument;
  const release=e=>{if(this.releaseGuard){this.releaseGuard={released:true,until:Date.now()+500};e.preventDefault();}};
  const guardClick=e=>{if(this.releaseGuard&&Date.now()<this.releaseGuard.until){e.preventDefault();e.stopImmediatePropagation();this.releaseGuard=null;}};
  listen(doc,'pointerup',release,{capture:true,passive:false});listen(doc,'click',guardClick,true);
  if(parent){listen(parent,'pointerup',release,{capture:true,passive:false});listen(parent,'click',guardClick,true);listen(parent,'pointerdown',()=>{if(this.releaseGuard?.released)this.releaseGuard=null;},true);}
  listen(doc,'pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;if(this.active){this.cancel();return;}const target=e.target.closest?.('.oc-token');this.start({id:e.pointerId,x:e.clientX,y:e.clientY,target,time:Date.now()});try{e.target.setPointerCapture(e.pointerId);}catch{}e.preventDefault();},{passive:false});
  listen(doc,'pointermove',e=>{const a=this.active;if(!a||a.id!==e.pointerId)return;a.dx=e.clientX-a.x;a.dy=e.clientY-a.y;if(Math.hypot(a.dx,a.dy)>MOVE_LIMIT)this.stopHold();},{passive:true});
  listen(doc,'pointerup',e=>{const a=this.active;if(!a||a.id!==e.pointerId)return;const action=releaseAction({dx:e.clientX-a.x,dy:e.clientY-a.y,duration:Date.now()-a.time,x:a.x,width:this.win.innerWidth});this.cancel();if(action)this.onTurn(action==='next'?1:-1);e.preventDefault();},{passive:false});
  for(const name of ['pointercancel','lostpointercapture','contextmenu','dragstart','selectstart'])listen(doc,name,e=>{if(['contextmenu','dragstart','selectstart'].includes(name))e.preventDefault();if(name==='pointercancel'||name==='lostpointercapture')this.cancel();},{passive:false});
  listen(doc,'click',e=>{e.preventDefault();e.stopPropagation();},true);
  listen(doc,'keydown',e=>{if(!['Enter',' '].includes(e.key)||e.repeat)return;const target=e.target.closest?.('.oc-token');if(!target)return;e.preventDefault();this.cancel();this.start({id:'keyboard',x:0,y:0,target,time:Date.now()});});
  listen(doc,'keyup',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();this.cancel();}});
  listen(this.win,'blur',()=>this.cancel());listen(doc,'visibilitychange',()=>{if(doc.hidden)this.cancel();});
 }
 setHoldDuration(ms){this.cancel();this.holdMs=normalizeHold(ms);this.doc.documentElement.style.setProperty('--oc-hold-ms',this.holdMs+'ms');}
 start(a){this.releaseGuard=null;this.active=a;a.dx=0;a.dy=0;if(a.target){a.target.classList.add('oc-holding');this.timer=setTimeout(()=>{if(this.active!==a)return;const word=a.target;if(a.id!=='keyboard')this.releaseGuard={released:false,until:Infinity};this.cancel();this.onWord(word);},this.holdMs);}}
 stopHold(){clearTimeout(this.timer);this.timer=null;this.active?.target?.classList.remove('oc-holding');}
 cancel(){this.stopHold();this.active=null;}
 destroy(){this.cancel();this.listeners.forEach(fn=>fn());this.listeners=[];}
}
class ReaderPager{
 constructor(doc,frame,tokens,{onChange,onBoundary}){this.doc=doc;this.win=doc.defaultView;this.frame=frame;this.tokens=tokens;this.page=0;this.count=1;this.onChange=onChange;this.onBoundary=onBoundary;this.pending=null;
  this.scroll=()=>{this.page=Math.max(0,Math.min(this.count-1,Math.round(this.win.scrollX/this.width())));this.onChange(this.location());};this.win.addEventListener('scroll',this.scroll,{passive:true});
 }
 width(){return Math.max(1,this.frame.clientWidth);}
 location(){const w=this.width();let tokenIndex=null;for(let i=0;i<this.tokens.length;i++){const r=this.tokens[i].node.getBoundingClientRect();if(r.right>1&&r.left<w-1&&r.bottom>0&&r.top<this.frame.clientHeight){tokenIndex=i;break;}}return {page:this.page,pageCount:this.count,tokenIndex,scroll:this.count>1?this.page/(this.count-1):0};}
 refresh(location={}){this.count=Math.max(1,Math.ceil(this.doc.documentElement.scrollWidth/this.width()-.015));let page=this.page;
  if(Number.isInteger(location.tokenIndex)&&this.tokens[location.tokenIndex]){const r=this.tokens[location.tokenIndex].node.getBoundingClientRect();page=Math.floor((r.left+this.win.scrollX+1)/this.width());}
  else if(location.end)page=this.count-1;
  else if(Number.isFinite(location.scroll))page=Math.round(location.scroll*(this.count-1));
  else if(Number.isInteger(location.page))page=location.page;
  this.page=Math.max(0,Math.min(this.count-1,page));this.win.scrollTo(this.page*this.width(),0);this.onChange(this.location());
 }
 reflow(location=this.location()){this.win.cancelAnimationFrame(this.pending);this.pending=this.win.requestAnimationFrame(()=>this.refresh(location));}
 turn(delta){const target=this.page+delta;if(target<0||target>=this.count){this.onBoundary(delta);return;}this.page=target;this.win.scrollTo(target*this.width(),0);this.onChange(this.location());}
 destroy(){this.win.cancelAnimationFrame(this.pending);this.win.removeEventListener('scroll',this.scroll);}
}
ReaderGestures.HOLD_OPTIONS=HOLD_OPTIONS;ReaderGestures.DEFAULT_HOLD_MS=HOLD_MS;ReaderGestures.normalizeHold=normalizeHold;
root.ReaderGestures=ReaderGestures;root.ReaderPager=ReaderPager;if(typeof module!=='undefined')module.exports={releaseAction,HOLD_MS,HOLD_OPTIONS,normalizeHold,MOVE_LIMIT};
})(typeof window!=='undefined'?window:globalThis);
