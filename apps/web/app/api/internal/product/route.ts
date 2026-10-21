import crypto from "node:crypto";
import { planProduct, dispatchProduct, ProductError } from "@/lib/product-service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const expected=process.env.PRODUCT_WORKER_SECRET||"", supplied=request.headers.get("authorization")||"";
  const a=Buffer.from(supplied),b=Buffer.from("Bearer "+expected);
  if(expected.length<32||a.length!==b.length||!crypto.timingSafeEqual(a,b))
    return Response.json({message:"Unauthorized"},{status:401});
  try {
    const u=new URL(request.url),action=u.searchParams.get("action")||"plan";
    const result=action==="plan"?await planProduct(u.searchParams.get("cursor")):
      action==="dispatch"?await dispatchProduct():null;
    if(!result) return Response.json({message:"Unknown operation"},{status:400});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    return Response.json({message:e instanceof ProductError?e.message:"Worker failed; result not confirmed"},
      {status:e instanceof ProductError?e.status:503});
  }
}
