"""In-memory browser harness: embeds exact ES-module sources with import-map paths only rewritten."""
import base64,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def markup(demo=False):
    base=ROOT/"apps/web/public/workbench"
    names={"./reset-core.js":"resetwatch-core","./product-core.js":"resetwatch-product","./product-ui.js":"resetwatch-ui"}
    modules={}
    for file,name in [("reset-core.js","resetwatch-core"),("product-core.js","resetwatch-product"),("product-ui.js","resetwatch-ui"),("app.js","resetwatch-app")]:
        text=(base/file).read_text()
        for old,new in names.items():text=text.replace('"'+old+'"','"'+new+'"')
        modules[name]="data:text/javascript;base64,"+base64.b64encode(text.encode()).decode()
    text=(base/"index.html").read_text()
    text=re.sub(r'<link[^>]+>',"",text)
    text=text.replace("</head>","<style>"+(base/"style.css").read_text()+"\n"+(base/"product.css").read_text()+"</style></head>")
    setup="""
globalThis.RESETWATCH_DEMO_PREVIEW=__DEMO__;
const memoryStorage={};
Object.defineProperty(globalThis,"localStorage",{value:{getItem:k=>memoryStorage[k]??null,setItem:(k,v)=>memoryStorage[k]=String(v),removeItem:k=>delete memoryStorage[k],toJSON:()=>memoryStorage}});
if(!crypto.randomUUID)crypto.randomUUID=()=> "00000000-0000-4000-8000-"+String(Math.floor(Math.random()*1e12)).padStart(12,"0");
globalThis.fetch=async(input,options={})=>{
 const r=await globalThis.__request_fixture({url:String(input),method:options.method||"GET",body:options.body?JSON.parse(options.body):null});
 return new Response(JSON.stringify(r.body),{status:r.status||200,headers:{"Content-Type":"application/json"}});
};
""".replace("__DEMO__",str(demo).lower())
    text=text.replace('<script type="module" src="./app.js"></script>',
      "<script>"+setup+"</script><script type='importmap'>"+json.dumps({"imports":modules})+"</script><script type='module'>import 'resetwatch-app';</script>")
    return text
def serve(page,handler,demo=False):
    page.expose_function("__request_fixture",handler)
    page.set_content(markup(demo))
    page.bring_to_front()
