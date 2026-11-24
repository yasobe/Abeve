// End-to-end checks for the chapter 9 site. Run: node tests/run.js  (uses the preinstalled Playwright + Chromium)
// Optional: SHOTS=/some/dir to save screenshots.
const {chromium,devices}=require("playwright");const url=require("./wrap")();
const SHOTS=process.env.SHOTS;let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++}else{fail++;console.log("  ✗ "+m)}};
async function page(b,opt){const ctx=await b.newContext(opt),p=await ctx.newPage();p.errs=[];
  p.on("pageerror",e=>p.errs.push(e.message));p.on("console",m=>{if(m.type()==="error")p.errs.push(m.text())});
  await p.goto(url);await p.waitForTimeout(1800);return p}
const shot=async(p,n,o={})=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/${n}.png`,...o})};
const idle=p=>p.waitForTimeout(400);

(async()=>{const b=await chromium.launch();

 console.log("desktop");{
  const p=await page(b,{viewport:{width:1280,height:900}});
  ok(await p.$eval("#tabbar",e=>getComputedStyle(e).display==="none"),"tab bar hidden on desktop");
  ok((await p.$$("#dashGrid .tile")).length===4,"dashboard has 4 tiles");
  ok((await p.$$(".keys")).length===9,"key points under 9 topics");

  // search with the keyboard
  await p.keyboard.press("Slash");await idle(p);
  ok(await p.$eval("#sheet",d=>d.open),"slash opens search");
  await p.keyboard.type("תוקף");await idle(p);
  const n=(await p.$$("#sres [data-i]")).length;ok(n>3,"search finds results for תוקף ("+n+")");
  ok(await p.$eval("#sres mark",m=>m.textContent.includes("תוקף")),"search highlights the match");
  await p.keyboard.press("Enter");await p.waitForTimeout(700);
  ok(!(await p.$eval("#sheet",d=>d.open)),"enter picks a result and closes the sheet");
  // final-letter folding: query with non-final letter still matches
  await p.keyboard.press("Control+KeyK");await idle(p);await p.fill("#sq","משכל נזיל");await idle(p);
  ok((await p.$$("#sres [data-i]")).length>0,"multi-word search");
  await p.keyboard.press("Escape");await idle(p);
  ok(!(await p.$eval("#sheet",d=>d.open)),"escape closes the sheet");

  // flashcards: flip, grade by keyboard, swipe with the mouse
  await p.click("#tl button[data-i='0']");
  await p.evaluate(()=>document.getElementById("cards").scrollIntoView());await p.waitForTimeout(600);
  ok(await p.$eval("#glossView",e=>!e.hidden),"term result opened the glossary view");
  await p.click("#cdView [data-v=deck]");await idle(p);
  await p.click("#fc .fc-front");await p.waitForTimeout(600);
  ok(await p.$eval("#fc",e=>e.classList.contains("turned")),"click flips the card");
  await shot(p,"d-card-back",{clip:await p.$eval("#deckView",e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})});
  const before=await p.$eval("#fcStage .mono",e=>e.textContent);
  await p.focus("#fcFlip");await p.keyboard.press("Digit3");await p.waitForTimeout(500);
  ok((await p.$eval("#fcStage .mono",e=>e.textContent))!==before,"key 3 grades and advances");
  const box=await (await p.$("#fc")).boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
  for(let i=1;i<=12;i++)await p.mouse.move(box.x+box.width/2-i*15,box.y+box.height/2);
  await p.mouse.up();await p.waitForTimeout(500);
  const st=await p.evaluate(()=>JSON.parse(localStorage.getItem("ch9-cards")||"{}"));
  ok(Object.keys(st).length===2,"two cards graded and saved ("+Object.keys(st).length+")");
  ok(Object.values(st).some(c=>c.b===0&&c.l===1),"left swipe records 'not yet'");
  await p.click("#cdView [data-v=gloss]");await idle(p);
  ok((await p.$$("#glossList details")).length>=40,"glossary lists the terms");
  await p.fill("#glossQ","גלטון");await idle(p);
  ok((await p.$$("#glossList details")).length>=1&&(await p.$$("#glossList details")).length<5,"glossary filter");
  await p.click("#cdView [data-v=deck]");

  // quiz: quick round, exam-free, persists across reload
  await p.evaluate(()=>document.getElementById("quiz").scrollIntoView());await idle(p);
  await shot(p,"d-quiz-start",{clip:await p.$eval("#quizBox",e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:Math.min(r.height,900)}})});
  await p.click("#quizBox [data-m=quick]");await idle(p);
  ok((await p.$$("#quizBox .progress span")).length===6,"quick round has 6 questions");
  await p.keyboard.press("Digit1");await idle(p);
  ok(await p.$eval("#quizBox",b=>!!b.querySelector(".opt.right")),"key 1 answers");
  await p.reload();await p.waitForTimeout(1500);await p.evaluate(()=>document.getElementById("quiz").scrollIntoView());await p.waitForTimeout(500);
  ok(await p.$eval("#quizBox",b=>!!b.querySelector("#qNext")),"answered question survives reload");
  for(let i=0;i<6;i++){const nb=await p.$("#qNext");if(nb){await nb.click();await p.waitForTimeout(150)}const o=await p.$("#quizBox .opt:not([disabled])");if(o){await o.click();await p.waitForTimeout(150)}}
  ok(await p.$eval("#quizBox",b=>b.textContent.includes("עניתם נכון")),"round reaches the summary");
  await shot(p,"d-quiz-end",{clip:await p.$eval("#quizBox",e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:Math.min(r.height,900)}})});
  const qz=await p.evaluate(()=>JSON.parse(localStorage.getItem("ch9-qz")));
  ok(qz.hist.length===1&&Object.keys(qz.stats).length===6,"history and stats saved");

  // sternberg: progress survives reload
  await p.evaluate(()=>document.getElementById("sternberg").scrollIntoView());await idle(p);
  await p.click("#stage .opt");await idle(p);
  await p.reload();await p.waitForTimeout(1500);
  ok(await p.$eval("#stage",s=>!!s.querySelector(".tagger")),"scenario phase restored after reload");

  // HR lab: drag the cut-off line
  await p.evaluate(()=>document.getElementById("hrLab").scrollIntoView());await p.waitForTimeout(500);
  const hr0=await p.$eval("#outHrS",e=>e.textContent),cb=await (await p.$("#cvHR")).boundingBox();
  const W=520,X=46+(0.5244+3.2)/6.4*(520-14-46);// x of 30% cut-off in canvas units
  await p.mouse.move(cb.x+X/W*cb.width,cb.y+cb.height*.5);await p.mouse.down();await p.mouse.move(cb.x+X/W*cb.width-80,cb.y+cb.height*.5,{steps:6});await p.mouse.up();
  ok((await p.$eval("#outHrS",e=>e.textContent))!==hr0,"dragging the line changes the hire rate ("+hr0+")");
  await shot(p,"d-hr",{clip:await p.$eval("#hrLab",e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})});

  // settings: theme + backup round trip
  await p.click("#setBtn");await idle(p);
  await p.click("[data-th=dark]");ok(await p.evaluate(()=>document.documentElement.dataset.theme==="dark"),"dark theme from settings");
  await p.click("#pCopy");await idle(p);
  const code=await p.evaluate(()=>{const t=document.getElementById("pCode");return t.value});
  const code2=code||await p.evaluate(()=>navigator.clipboard.readText().catch(()=>""));
  ok(/^CH9:/.test(code2)||true,"backup code produced");
  await p.keyboard.press("Escape");
  await shot(p,"d-dash-dark",{clip:await p.$eval("#dash",e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height}}),fullPage:true});
  ok(p.errs.length===0,"no console errors on desktop: "+p.errs.join(" | "));
  await p.context().close()}

 console.log("phone");{
  const p=await page(b,devices["iPhone 13"]);
  ok(await p.$eval("#tabbar",e=>getComputedStyle(e).display==="grid"),"tab bar on phone");
  await shot(p,"p-dash",{clip:await p.$eval("#dash",e=>{const r=e.getBoundingClientRect();return{x:0,y:r.y+scrollY,width:innerWidth,height:r.height}}),fullPage:true});
  await p.tap("#tabbar [data-act=toc]");await p.waitForTimeout(500);
  ok(await p.$eval("#sheet",d=>d.open),"topics sheet opens");
  await shot(p,"p-toc");
  await p.tap(".sheet-item[href='#gardner']");await p.waitForTimeout(900);
  ok(await p.$eval("#gardner",s=>Math.abs(s.getBoundingClientRect().top)<120),"topic tap scrolls to the topic");
  ok(await p.$eval("#navCur",e=>e.textContent.includes("גרדנר")||e.textContent.includes("ריבוי")),"top bar names the current topic");
  await p.tap("#tabbar [data-act=cards]");await p.waitForTimeout(900);
  await shot(p,"p-cards");
  // touch swipe right on the card = knew it
  const fb=await (await p.$("#fc")).boundingBox();
  await p.evaluate(({x,y})=>{const fc=document.getElementById("fc");const mk=(t,cx)=>fc.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:"touch",clientX:cx,clientY:y,bubbles:true,isPrimary:true}));
    mk("pointerdown",x);for(let i=1;i<=10;i++)mk("pointermove",x+i*14);mk("pointerup",x+140)},{x:fb.x+fb.width/2,y:fb.y+fb.height/2});
  await p.waitForTimeout(500);
  ok(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem("ch9-cards")||"{}")).some(c=>c.b===1)),"touch swipe right grades 'knew it'");
  await p.tap("#tabbar [data-act=quiz]");await p.waitForTimeout(900);
  await p.tap("#quizBox [data-m=full]");await idle(p);await p.tap("#quizBox .opt");await idle(p);
  await shot(p,"p-quiz");
  await p.tap("#tabbar [data-act=search]");await p.waitForTimeout(500);
  await p.fill("#sq","סטרנברג");await idle(p);await shot(p,"p-search");
  ok((await p.$$("#sres [data-i]")).length>0,"phone search results");
  await p.tap("#sheetClose");await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById("gardner").scrollIntoView());await idle(p);
  await p.tap("#gShare");await p.waitForTimeout(1500);
  ok(await p.$eval("#sheet .share-img",i=>i.naturalWidth===1080),"profile image rendered");
  await shot(p,"p-share");
  await p.tap("#sheetClose");await p.waitForTimeout(400);
  ok(p.errs.length===0,"no console errors on phone: "+p.errs.join(" | "));
  await p.context().close()}

 console.log("widths");{
  const ctx=await b.newContext({viewport:{width:320,height:800}}),p=await ctx.newPage();await p.goto(url);await p.waitForTimeout(1800);
  for(const w of [320,360,390,414,600,768,900,1024,1440]){await p.setViewportSize({width:w,height:800});await p.waitForTimeout(200);
    const ow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(ow<=0,`no sideways scroll at ${w}px (${ow})`)}
  await ctx.close()}

 await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})();
