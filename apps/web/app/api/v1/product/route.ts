import { isAdmin } from "@/lib/admin-auth";
import { credentials, ProductError, readProduct, mutateProduct } from "@/lib/product-service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cookie=(value:string,request:Request)=>`resetwatch_profile=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value?31536000:0}${new URL(request.url).protocol==="https:"?"; Secure":""}`;
function headers(request:Request) {
  const origin=request.headers.get("origin"), own=new URL(request.url).origin;
  const allowed=[own,...(process.env.PRODUCT_ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean)];
  if(origin&&!allowed.includes(origin)) throw new ProductError(403,"来源不受信任。");
  const h=new Headers({"Cache-Control":"no-store","Vary":"Origin"});
  if(origin) {h.set("Access-Control-Allow-Origin",origin);h.set("Access-Control-Allow-Credentials","true");}
  return h;
}
function error(e:unknown,h=new Headers({"Cache-Control":"no-store"})) {
  return Response.json({message:e instanceof ProductError?e.message:"服务不可用，请检查迁移与配置；未确认保存成功。"},
    {status:e instanceof ProductError?e.status:503,headers:h});
}
async function body(request:Request) {
  if(!request.headers.get("content-type")?.startsWith("application/json")) throw new ProductError(415,"仅支持 JSON。");
  const reader=request.body?.getReader();if(!reader) throw new ProductError(400,"请求体为空。");
  const chunks:Uint8Array[]=[];let size=0;
  try { for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>256*1024){await reader.cancel();throw new ProductError(413,"请求过大。");}chunks.push(value);}
  } finally {reader.releaseLock();}
  const all=new Uint8Array(size);let n=0;for(const v of chunks){all.set(v,n);n+=v.length;}
  try {const data=JSON.parse(new TextDecoder().decode(all));if(!data||typeof data!=="object"||Array.isArray(data))throw Error();return data;}
  catch {throw new ProductError(400,"JSON 对象无效。");}
}
export async function OPTIONS(request:Request) {
  try {const h=headers(request);h.set("Access-Control-Allow-Methods","GET,POST,OPTIONS");h.set("Access-Control-Allow-Headers","Content-Type,Authorization");return new Response(null,{status:204,headers:h});}
  catch(e){return error(e);}
}
export async function GET(request:Request) {
  let h;try {
    h=headers(request);const url=new URL(request.url),view=url.searchParams.get("view")||"profile";
    return Response.json(await readProduct(view,credentials(request),view==="drafts"?await isAdmin():false,url.searchParams.get("event")),{headers:h});
  } catch(e){return error(e,h);}
}
export async function POST(request:Request) {
  let h;try {
    h=headers(request);const data=await body(request);
    if(data.action==="profile.logout"){h.set("Set-Cookie",cookie("",request));return Response.json({disconnected:true},{headers:h});}
    if(data.action==="profile.connect"){
      const result=await readProduct("profile",typeof data.token==="string"?data.token:"");
      h.set("Set-Cookie",cookie(data.token,request));return Response.json(result,{headers:h});
    }
    const result=await mutateProduct(data,credentials(request),String(data.action).startsWith("draft.")?await isAdmin():false);
    if("token" in result && typeof result.token==="string") h.set("Set-Cookie",cookie(result.token,request));
    if(data.action==="profile.delete") h.set("Set-Cookie",cookie("",request));
    return Response.json(result,{headers:h});
  } catch(e){return error(e,h);}
}
