const {chromium,devices}=require("playwright");const url=require("./wrap")();
(async()=>{const b=await chromium.launch();
 for(const [name,opt] of [["desktop",{viewport:{width:1280,height:900}}],["phone",devices["iPhone 13"]]]){
  const ctx=await b.newContext(opt),p=await ctx.newPage();const errs=[];
  p.on("pageerror",e=>errs.push("pageerror: "+e.message));p.on("console",m=>{if(m.type()==="error")errs.push("console: "+m.text())});
  await p.goto(url);await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>({radar:document.querySelectorAll("#radar circle").length,fc:!!document.querySelector("#fc"),modes:document.querySelectorAll("#quizBox .mode").length,hr:document.querySelector("#hrOut").textContent.slice(0,40),keys:document.querySelectorAll(".keys").length,dash:document.querySelectorAll("#dashGrid .tile").length,tab:getComputedStyle(document.querySelector("#tabbar")).display,ow:document.documentElement.scrollWidth-innerWidth}));
  console.log(name,JSON.stringify(r));console.log(errs.join("\n")||"no errors");
  await p.screenshot({path:`/tmp/claude-0/-home-user-Abeve/b2dfed65-0128-5840-b90b-cc2e2494d5f0/scratchpad/${name}-top.png`});
  await ctx.close()}
 await b.close()})();
