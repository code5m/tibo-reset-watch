/** Run only on the trusted server/CI. Never ship this secret or run this from a client. */
const origin = process.env.PRODUCT_SITE_URL;
const secret = process.env.PRODUCT_WORKER_SECRET;
let root;
try { root = new URL(origin); } catch { throw Error('PRODUCT_SITE_URL is required'); }
if(root.protocol!=='https:' || root.username || root.password || root.search || root.hash ||
  !['','/'].includes(root.pathname) || !secret || secret.length<32) throw Error('Trusted HTTPS origin and worker secret required');
const args=process.argv.slice(2);
if(args.some(x=>!['--plan','--dispatch'].includes(x)) || !args.length) throw Error('Use --plan and optionally --dispatch');
async function request(action,cursor) {
 const url=new URL('/api/internal/product',root);
 url.searchParams.set('action',action);if(cursor)url.searchParams.set('cursor',cursor);
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Worker returned HTTP '+r.status+'; do not assume success or blindly replay sends');
 return r.json();
}
if(args.includes('--plan')) {
 let cursor=null,total=0,complete=false;const seen=new Set();
 for(let i=0;i<100;i++) {
  const r=await request('plan',cursor);total+=r.queued||0;
  if(!r.nextCursor){complete=true;break;}
  if(seen.has(r.nextCursor))throw Error('Repeated cursor');seen.add(r.nextCursor);cursor=r.nextCursor;
 }
 if(!complete)throw Error('Planning batch cap reached; resume only with an explicit operator plan');
 console.log(JSON.stringify({planned:total}));
}
if(args.includes('--dispatch')) {
 if(process.env.PRODUCT_SEND_ENABLED!=='true')throw Error('Dispatch disabled; no request made');
 const r=await request('dispatch');
 console.log(JSON.stringify({accepted:r.accepted||0,cancelled:r.cancelled||0,unknown:r.unknown||0,blocked:!!r.blocked}));
}
