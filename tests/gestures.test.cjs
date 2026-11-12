const assert=require('node:assert/strict');
const {releaseAction,HOLD_MS}=require('../app/src/main/assets/web/reader.js');
assert.equal(HOLD_MS,400);
for(const [input,expected] of [[{dx:-100,dy:5,duration:400,x:200,width:412},'next'],[{dx:100,dy:5,duration:400,x:200,width:412},'previous'],[{dx:0,dy:1,duration:100,x:390,width:412},'next'],[{dx:0,dy:1,duration:100,x:20,width:412},'previous'],[{dx:0,dy:1,duration:100,x:200,width:412},null],[{dx:5,dy:120,duration:400,x:200,width:412},null],[{dx:0,dy:0,duration:900,x:390,width:412},null]])assert.equal(releaseAction(input),expected);
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.OPENCHINESE_BROWSER_CHANNEL?{channel:process.env.OPENCHINESE_BROWSER_CHANNEL}:{})});try{
 const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.OpenChineseNative={getState:()=>localStorage.getItem('gesture-state')||'{}',saveState:s=>{localStorage.setItem('gesture-state',s);return true;},readChapter:(id,path)=>'<html><body><h1>Reading test</h1>'+('<p>冬天，北京，我们想到一个可以安静阅读的地方。每天读一点中文，慢慢学习。</p>').repeat(path==='one.xhtml'?55:2)+'</body></html>'};});
 await page.goto((process.env.OPENCHINESE_TEST_URL||'http://127.0.0.1:8765')+'/web/index.html');await page.locator('#importBook').waitFor({timeout:30000});await page.evaluate(()=>onBookImported({id:'0123456789abcdef01234567',title:'Paged reading regression',chapters:[{path:'one.xhtml',title:'One'},{path:'two.xhtml',title:'Two'}]}));await page.waitForFunction(()=>OpenChineseTest.paging()?.count>3);
 const initial=await page.evaluate(()=>OpenChineseTest.paging());assert.equal(initial.page,0);const frame=page.frameLocator('#page');const box=await page.locator('#page').boundingBox();
 await page.touchscreen.tap(box.x+box.width*.9,box.y+box.height*.5);await page.waitForFunction(()=>OpenChineseTest.paging().page===1);
 await page.mouse.click(box.x+box.width*.1,box.y+box.height*.5);await page.waitForFunction(()=>OpenChineseTest.paging().page===0);
 // Horizontal swipe turns a page; vertical movement does not.
 await page.mouse.move(box.x+300,box.y+250);await page.mouse.down();await page.mouse.move(box.x+100,box.y+253,{steps:8});await page.mouse.up();await page.waitForFunction(()=>OpenChineseTest.paging().page===1);
 await page.mouse.move(box.x+180,box.y+250);await page.mouse.down();await page.mouse.move(box.x+185,box.y+390,{steps:8});await page.mouse.up();assert.equal(await page.evaluate(()=>OpenChineseTest.paging().page),1);
 await page.mouse.click(box.x+box.width*.1,box.y+box.height*.5);await page.waitForFunction(()=>OpenChineseTest.paging().page===0);
 const word=frame.locator('[data-word="冬天"]').first();await word.click();assert(await page.locator('#sheet').isHidden());
 // A short hold is cancelled. A continuous hold opens only after 400ms.
 const w=await word.boundingBox();await page.mouse.move(w.x+w.width/2,w.y+w.height/2);await page.mouse.down();await page.waitForTimeout(250);assert(await page.locator('#sheet').isHidden());await page.mouse.up();await page.waitForTimeout(350);assert(await page.locator('#sheet').isHidden());
 const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:w.x+w.width/2,y:w.y+w.height/2}]});await page.waitForTimeout(250);assert(await page.locator('#sheet').isHidden());await page.waitForTimeout(350);assert(await page.locator('#sheet').isVisible());await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('.word-title').innerText(),'冬天');await page.locator('.sheet-close').click();
 // Moving the finger cancels a pending hold permanently.
 await page.mouse.move(w.x+w.width/2,w.y+w.height/2);await page.mouse.down();await page.mouse.move(w.x+w.width/2+22,w.y+w.height/2+18,{steps:3});await page.waitForTimeout(550);await page.mouse.up();assert(await page.locator('#sheet').isHidden());
 // Threshold change repaginates without changing token boundaries.
 const before=await page.evaluate(()=>OpenChineseTest.getTokens().map(t=>t.word));await page.locator('#readerOptions').click();await page.locator('#levelSelect').selectOption('6');await page.locator('.sheet-close').click();await page.waitForTimeout(150);
 assert.deepEqual(await page.evaluate(()=>OpenChineseTest.getTokens().map(t=>t.word)),before);const tokens=await page.evaluate(()=>OpenChineseTest.getTokens());for(const w of ['北京','想到','一个'])assert(tokens.filter(t=>t.word===w).every(t=>t.show==='false'),w);
 // Position survives relaunch in the same book, including its page anchor.
 await page.mouse.click(box.x+box.width*.9,box.y+box.height*.5);await page.waitForFunction(()=>OpenChineseTest.paging().page===1);await page.locator('#closeReader').click();await page.reload();await page.locator('#importBook').waitFor();await page.locator('[data-book="0123456789abcdef01234567"]').click();await page.waitForFunction(()=>OpenChineseTest.paging()?.page===1);assert.deepEqual(errors,[]);
 console.log('PASS paged reading: edge taps, horizontal swipe, vertical rejection, 400ms default hold, early release, movement cancellation, HSK repagination and position persistence');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
