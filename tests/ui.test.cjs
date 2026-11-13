const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.OPENCHINESE_BROWSER_CHANNEL?{channel:process.env.OPENCHINESE_BROWSER_CHANNEL}:{})});try{
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.OPENCHINESE_TEST_URL||'http://127.0.0.1:8765')+'/web/index.html');await page.getByText('Your bookshelf',{exact:true}).waitFor({timeout:30000});
 const out=path.resolve(__dirname,'../preview');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'01-library.png'),fullPage:true});
 await page.getByText('Try the reading sample →',{exact:true}).click();await page.waitForFunction(()=>window.OpenChineseTest.getTokens().length>30);const frame=page.frameLocator('#page');
 const wordsBefore=await page.evaluate(()=>OpenChineseTest.getTokens().map(t=>t.word));assert(await frame.locator('[data-word="冬天"] ruby').first().getAttribute('data-show')==='true');
 await page.locator('#readerOptions').click();await page.locator('#levelSelect').selectOption('4');await page.locator('.sheet-close').click();
 assert.equal(await frame.locator('[data-word="冬天"] ruby').first().getAttribute('data-show'),'false');assert.equal(await frame.locator('[data-word="共同"] ruby').first().getAttribute('data-show'),'true');
 assert.deepEqual(await page.evaluate(()=>OpenChineseTest.getTokens().map(t=>t.word)),wordsBefore);
 await page.screenshot({path:path.join(out,'02-reader-hsk4.png')});
 await frame.locator('[data-word="冬天"]').first().click({delay:550});await page.locator('#cardNote').fill('Winter - from my first OpenChinese reading');await page.screenshot({path:path.join(out,'03-word-flashcard.png')});await page.locator('#saveCard').click();
 assert.equal(await page.evaluate(()=>OpenChineseTest.getState().cards.length),1);await page.reload();await page.getByText('Your bookshelf',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>OpenChineseTest.getState().cards[0].word),'冬天');
 await page.locator('[data-tab="cards"]').click();await page.screenshot({path:path.join(out,'04-flashcards.png')});await page.locator('#startReview').click();await page.locator('#reveal').click();await page.locator('#good').click();assert.equal(await page.evaluate(()=>OpenChineseTest.getState().cards[0].reviews),1);assert(await page.evaluate(()=>OpenChineseTest.getState().cards[0].due>Date.now()));
 await page.evaluate(()=>onCardsImported({format:'OpenChinese-flashcards',version:1,cards:[{word:'<img src=x onerror=alert(1)>',pinyin:'test',meaning:'<script>bad</script>'}]}));assert.equal(await page.locator('#main img').count(),0);
 // Simulate Android's file picker callback with hostile EPUB content. No EPUB scripts may execute.
 await page.evaluate(()=>{window.OpenChineseNative={readChapter:()=>''};window.nativeBookHtml='<html><body><script>parent.hacked=true</script><p onclick="parent.hacked=true">冬天与共同</p><iframe srcdoc="evil"></iframe></body></html>';});
 // safeDocument is exercised directly using actual imported-chapter sanitisation.
 const safe=await page.evaluate(()=>{const d=safeDocument(nativeBookHtml,location.href);return {scripts:d.querySelectorAll('script').length,frames:d.querySelectorAll('iframe').length,events:d.querySelectorAll('[onclick]').length};});assert.deepEqual(safe,{scripts:0,frames:0,events:0});
 assert.deepEqual(errors,[]);console.log('PASS UI: HSK instant toggle, stable boundaries, save/reload, review schedule, backup escaping, EPUB sanitisation; no page errors');
 // Rasterise the original vector logo for Android launchers and a standalone preview.
 const svg=fs.readFileSync(path.resolve(__dirname,'../branding/OpenChinese-logo.svg'),'utf8');await page.setContent(`<body style="margin:0"><img id="logo" width="512" height="512" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);await page.locator('#logo').screenshot({path:path.resolve(__dirname,'../branding/OpenChinese-logo.png')});
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
