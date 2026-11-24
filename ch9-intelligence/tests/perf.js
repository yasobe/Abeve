// Load cost on a simulated mid-range phone (CPU throttled 4x). Usage: node tests/perf.js [path/to/index.html]
const {chromium,devices}=require("playwright");const fs=require("fs"),path=require("path"),os=require("os");
const src=process.argv[2]||path.join(__dirname,"..","index.html");
const html=`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${fs.readFileSync(src,"utf8")}</body></html>`;
const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"perf-")),"index.html");fs.writeFileSync(f,html);
(async()=>{const b=await chromium.launch();const res=[];
 for(let run=0;run<3;run++){const ctx=await b.newContext(devices["iPhone 13"]),p=await ctx.newPage(),cdp=await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});await cdp.send("Performance.enable");
  await p.addInitScript(()=>{window.__lt=0;new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt+=Math.max(0,e.duration-50))).observe({type:"longtask",buffered:true})});
  const t0=Date.now();await p.goto("file://"+f,{waitUntil:"load"});const load=Date.now()-t0;await p.waitForTimeout(600);
  const m=Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x=>[x.name,x.value]));
  const fcp=await p.evaluate(()=>{const e=performance.getEntriesByName("first-contentful-paint")[0];return e?Math.round(e.startTime):null});
  const tbt=await p.evaluate(()=>Math.round(window.__lt));
  res.push({load,fcp,task:Math.round(m.TaskDuration*1000),script:Math.round(m.ScriptDuration*1000),tbt});await ctx.close()}
 await b.close();const med=k=>res.map(r=>r[k]).sort((a,b)=>a-b)[1];
 console.log(path.basename(path.dirname(src))+"/"+path.basename(src),JSON.stringify({load:med("load"),fcp:med("fcp"),browserWorkUntilLoad:med("task"),script:med("script"),blocking:med("tbt")}))})();
