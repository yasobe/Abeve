// Accessibility audit with axe-core in four combinations (desktop/phone × light/dark), plus the open sheet.
// Run: AXE=/path/to/axe.min.js node tests/a11y.js   (npm install axe-core to get the file)
const {chromium,devices}=require("playwright");const fs=require("fs");const url=require("./wrap")();
const AXE=fs.readFileSync(process.env.AXE||require.resolve("axe-core/axe.min.js"),"utf8");
(async()=>{const b=await chromium.launch();let total=0;
 for(const [dev,opt] of [["desktop",{viewport:{width:1280,height:900}}],["phone",devices["iPhone 13"]]])for(const scheme of ["light","dark"]){
  const ctx=await b.newContext({...opt,colorScheme:scheme}),p=await ctx.newPage();await p.goto(url);await p.waitForTimeout(2200);
  // render every section once (content-visibility skips offscreen layout)
  await p.evaluate(async()=>{for(const s of document.querySelectorAll(".lab")){s.scrollIntoView();await new Promise(r=>setTimeout(r,60))}window.scrollTo(0,0)});
  await p.addScriptTag({content:AXE});
  const run=async label=>{const r=await p.evaluate(()=>axe.run(document,{resultTypes:["violations"]}));
    r.violations.forEach(v=>console.log(`  [${label}] ${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes.slice(0,3).map(n=>n.target.join(" ")).join(" | ")}`));total+=r.violations.length;return r.violations.length};
  const n1=await run(`${dev}/${scheme}`);
  await p.evaluate(()=>document.getElementById("searchBtn").click()||document.querySelector("#tabbar [data-act=search]").click());await p.waitForTimeout(500);
  await p.fill("#sq","תוקף");await p.waitForTimeout(300);
  const n2=await run(`${dev}/${scheme}/search`);
  console.log(`${dev}/${scheme}: ${n1} page, ${n2} sheet`);await ctx.close()}
 await b.close();console.log(total?`${total} violations`:"0 violations");process.exit(total?1:0)})();
