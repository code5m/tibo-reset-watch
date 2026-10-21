// Compile real Vue3 source and create browser fixtures; NOT a mini/native SDK build.
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(path.resolve(process.env.CLIENT_COMPILER_ROOT||".client-compiler","package.json"));
const {parse,compileScript,compileTemplate}=require("@vue/compiler-sfc");
const {build}=require("esbuild");
const root=process.cwd(),out=path.join(root,"test-output");
fs.mkdirSync(out,{recursive:true});
const sourcePath=path.join(root,"apps/client/pages/home/index.vue"),source=fs.readFileSync(sourcePath,"utf8");
const {descriptor,errors}=parse(source);
if(errors.length)throw Error(JSON.stringify(errors));
const script=compileScript(descriptor,{id:"rw-client"});
const template=compileTemplate({source:descriptor.template.content,filename:sourcePath,id:"rw-client",
 compilerOptions:{bindingMetadata:script.bindings,isCustomElement:tag=>["view","text","scroll-view"].includes(tag)}});
if(template.errors.length)throw Error(JSON.stringify(template.errors));
const bootstrap=`
import {createApp,defineComponent,h} from "vue";
const rawRequest=async o=>{
 try { const result=await window.__fixture(o.method||"GET",o.url,o.data||null);
 o.success({statusCode:result.status,data:result.data});}
 catch {o.fail({errMsg:"fixture unavailable"});}
};
const store=new Map([["resetwatch.apiOrigin","https://resetwatch.test"]]);let pushListener=null;
globalThis.uni={
 getSystemInfoSync:()=>({uniPlatform:window.__platform||"app",theme:"light"}),
 getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),
 request:o=>{let cancelled=false;rawRequest({...o,success:r=>!cancelled&&o.success(r),fail:r=>!cancelled&&o.fail(r)});return{abort(){cancelled=true}}},
 showModal:o=>o.success({confirm:window.__confirm!==false}),
 showToast:o=>{window.__toast=o.title},
 setClipboardData:o=>{window.__copied=o.data;o.success?.({})},
 stopPullDownRefresh:()=>{},
 onPushMessage:cb=>{pushListener=cb},offPushMessage:()=>{pushListener=null}
};
const app=createApp(Client);
app.component("picker",defineComponent({props:["range","rangeKey","value","mode"],emits:["change"],setup(p,{emit,slots}){return()=>h("div",{class:"fixture-picker"},[p.mode==="time"?h("input",{type:"time",value:p.value,onChange:e=>emit("change",{detail:{value:e.target.value}})}):h("select",{value:p.value,onChange:e=>emit("change",{detail:{value:e.target.value}})},(p.range||[]).map((o,i)=>h("option",{value:i},p.rangeKey?o[p.rangeKey]:o))),slots.default?.()])}}));
app.component("switch",defineComponent({props:["checked"],emits:["change"],setup(p,{emit}){return()=>h("input",{type:"checkbox",checked:p.checked,onChange:e=>emit("change",{detail:{value:e.target.checked}})})}}));
app.component("checkbox",defineComponent({props:["checked","value"],setup(p){return()=>h("input",{type:"checkbox",value:p.value,checked:p.checked})}}));
app.component("checkbox-group",defineComponent({emits:["change"],setup(p,{emit,slots}){return()=>h("div",{onChange:e=>emit("change",{detail:{value:[...e.currentTarget.querySelectorAll("input:checked")].map(x=>x.value)}})},slots.default?.())}}));
const vm=app.mount("#app");window.__vm=vm;Client.onLoad?.call(vm,{});Client.onShow?.call(vm);
window.addEventListener("pagehide",()=>Client.onUnload?.call(vm));
`;
const entry=script.content.replace("export default","const Client =")+ "\n"+
 template.code.replace("export function render","function render")+"\nClient.render=render;\n"+bootstrap;
const filename=path.join(path.dirname(sourcePath),".client-fixture-entry.mjs");
try{
 fs.writeFileSync(filename,entry);
 const result=await build({entryPoints:[filename],bundle:true,write:false,format:"iife",platform:"browser",
  nodePaths:[path.resolve(process.env.CLIENT_COMPILER_ROOT||".client-compiler","node_modules")],
  define:{"process.env.NODE_ENV":'"production"',"__VUE_OPTIONS_API__":"true","__VUE_PROD_DEVTOOLS__":"false","__VUE_PROD_HYDRATION_MISMATCH_DETAILS__":"false"},
  logLevel:"warning"});
 fs.writeFileSync(path.join(out,"client-fixture.js"),result.outputFiles[0].text);
 // The browser fixture uses CSS-pixel equivalents only. Native responsive units remain in source.
 const css=descriptor.styles.map(s=>s.content.replace(/([\d.]+)rpx/g,(_,n)=>(Number(n)/2)+"px")).join("\n");
 fs.writeFileSync(path.join(out,"client-fixture.css"),`view,scroll-view{display:block}scroll-view{overflow-x:auto;max-width:100%}text{display:block}button{font:inherit}body{margin:0}select{max-width:100%}\n`+css);
 fs.writeFileSync(path.join(out,"client-template-validation.json"),JSON.stringify({source:"apps/client/pages/home/index.vue",vueTemplate:true,vueScript:true,nativeSdkBuild:false,generatedAt:new Date().toISOString()},null,2));
 console.log("Vue3 template/script compilation PASS; native SDK build NOT asserted.");
}finally{if(fs.existsSync(filename))fs.unlinkSync(filename)}
