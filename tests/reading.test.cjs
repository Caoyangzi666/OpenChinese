const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.OPENCHINESE_BROWSER_CHANNEL?{channel:process.env.OPENCHINESE_BROWSER_CHANNEL}:{})});try{
 const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const diagnostic=[];page.on('console',m=>{if(m.type()==='error')diagnostic.push(m.text());});page.on('requestfailed',r=>diagnostic.push(r.url()+' '+r.failure()?.errorText));
 await page.addInitScript(()=>{window.OpenChineseNative={getState:()=>localStorage.getItem('word-state')||'{}',saveState:s=>{localStorage.setItem('word-state',s);return true;},readChapter:()=>'<html><body><h1>第一章</h1><p id="sample">我哥哥杰姆喜欢看中<em>文</em>书。十三岁的我不<strong>知</strong>道。他学习学术。</p><p id="break-test">喜<br>欢</p></body></html>'};});
 await page.goto((process.env.OPENCHINESE_TEST_URL||'http://127.0.0.1:8765')+'/web/index.html');await page.locator('#importBook').waitFor().catch(async e=>{console.error('Reading startup diagnostic',diagnostic,await page.locator('body').innerText());throw e;});
 await page.evaluate(()=>onBookImported({id:'0123456789abcdef01234567',title:'Word filter regression',chapters:[{path:'one.xhtml',title:'First chapter'}]}));
 await page.waitForFunction(()=>OpenChineseTest.getTokens().some(t=>t.word==='第一'));const frame=page.frameLocator('#page');
 assert.equal(await frame.locator('[data-word="中文"]').count(),1);assert.equal(await frame.locator('[data-word="知道"]').count(),1);assert.equal(await frame.locator('#break-test [data-word="喜欢"]').count(),0);
 assert.equal(await frame.locator('[data-word="中文"] em').textContent(),'文');assert.equal(await frame.locator('[data-word="知道"] strong').textContent(),'知');
 assert.equal(await frame.locator('[data-word="姆"] rt').textContent(),'mǔ');
 const words=await page.evaluate(()=>OpenChineseTest.getTokens().map(t=>t.word));let previous=null;
 for(let level=1;level<=7;level++){
  await page.locator('#readerOptions').click();await page.locator('#levelSelect').selectOption(String(level));await page.locator('.sheet-close').click();
  const tokens=await page.evaluate(()=>OpenChineseTest.getTokens());assert.deepEqual(tokens.map(t=>t.word),words);
  if(previous)for(let i=0;i<tokens.length;i++)if(tokens[i].show==='true')assert.equal(previous[i].show,'true');previous=tokens;
  assert.equal(await frame.locator('[data-word="第一"] ruby').getAttribute('data-show'),level===1?'true':'false');
  assert.equal(await frame.locator('[data-word="学术"] ruby').getAttribute('data-show'),level<=5?'true':'false');
 }
 // A word whose pinyin is hidden remains selectable and saves a complete card.
 await frame.locator('[data-word="知道"]').click({delay:550});await page.locator('#cardNote').fill('A complete word, across EPUB formatting');await page.locator('#saveCard').click();
 let cards=await page.evaluate(()=>OpenChineseTest.getState().cards);assert.equal(cards[0].word,'知道');assert.equal(cards[0].pinyin,'zhī dào');
 await frame.locator('[data-word="姆"]').click({delay:550});assert.equal(await page.locator('#wordPinyin').textContent(),'mǔ');
 const options=await page.locator('#wordReading option').allTextContents();await page.locator('#wordReading').selectOption(String(options.indexOf('m')));assert.equal(await page.locator('#wordPinyin').textContent(),'m');assert((await page.locator('#wordMeaning').textContent()).includes('姆媽'));
 await page.locator('#saveCard').click();await page.reload();await page.locator('#importBook').waitFor().catch(async e=>{console.error('Reading startup diagnostic',diagnostic,await page.locator('body').innerText());throw e;});cards=await page.evaluate(()=>OpenChineseTest.getState().cards);
 assert.equal(cards.find(c=>c.word==='姆').pinyin,'m');assert.equal(cards.find(c=>c.word==='知道').note,'A complete word, across EPUB formatting');assert.deepEqual(errors,[]);
 console.log('PASS word reading: inline markup, screenshot readings, HSK1–7 monotonicity, advanced word vs basic characters, hidden-word flashcards, alternative reading/sense persistence.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
