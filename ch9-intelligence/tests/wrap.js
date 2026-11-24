// Wraps index.html the way the artifact host does (doctype, viewport, reset) so tests see what viewers see.
const fs=require("fs"),path=require("path"),os=require("os");
module.exports=function wrap(){
  const src=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  const html=`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n${src}</body></html>`;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ch9-"));const f=path.join(dir,"index.html");fs.writeFileSync(f,html);return"file://"+f};
