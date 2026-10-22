"""Render compiled real Vue source with browser uni/API fixtures, NOT native runtime."""
import json,os,copy,datetime
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get("RESETWATCH_TEST_OUTPUT",ROOT/"test-output"));OUT.mkdir(parents=True,exist_ok=True)
results=[]
def check(label,ok):
    if not ok:raise AssertionError(label)
    results.append({"name":label,"passed":True});print("PASS",label,flush=True)
def now(delta=0):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=delta)).isoformat(timespec="milliseconds")
def fixtures():
    e={"id":"fixture-one","title":"隔离测试事件 · 非真实公告","type":"global","posts":[
      {"id":"90001","url":"https://x.com/thsottiaux/status/90001","publishedAt":now(-1800),"stage":"announced","evidence":"official","original":"Fixture announcement, not news.","translation":"测试内容，不是新闻","explanation":"非真实公告。"},
      {"id":"90002","url":"https://x.com/thsottiaux/status/90002","publishedAt":now(-900),"stage":"scheduled","evidence":"official","original":"Fixture timing, not news.","translation":"时间演示，不是新闻","explanation":"测试接口提供的隔离事件，不发送通知。"}
    ],"deadline":{"at":now(3600),"kind":"upper_bound","basis":"explicit","sourcePostId":"90002","alternativeAt":None,"note":None}}
    personal={"schemaVersion":1,"preferences":{"theme":"system","enabled":False,"sources":["tibo"],"types":["global","banked"],"windows":[6,3,1],"quiet":{"enabled":False,"start":"23:00","end":"07:00"}},"tasks":[],"bookmarks":[]}
    state={"profile":None,"requests":[],"conflict":False}
    def handle(method,url,body):
        u=urlparse(url);view=parse_qs(u.query).get("view",["profile"])[0]
        def r(data,status=200):return {"data":copy.deepcopy(data),"status":status}
        if u.path=="/api/v1/reset-events":return r({"schemaVersion":1,"serverTime":now(),"events":[e],"total":1,"nextOffset":None})
        if method=="GET":
            if view=="capabilities":return r({"storage":True,"sendEnabled":False,"nativePush":False,"wechat":False,"sources":[{"id":"tibo"}]})
            if not state["profile"]:return r({"message":"请先连接档案。"},401)
            if view=="profile":return r({"profile":state["profile"]})
            if view=="deliveries":return r({"deliveries":[{"id":"22222222-2222-4222-8222-222222222222","event_id":"fixture-one","status":"accepted","accepted_at":now(),"queued_at":now()}]})
            if view=="devices":return r({"devices":[]})
            if view=="workspaces":return r({"workspaces":[]})
        state["requests"].append(body);action=(body or {}).get("action")
        if action=="profile.create":
            state["profile"]={"id":"11111111-1111-4111-8111-111111111111","display_name":"测试档案","data":copy.deepcopy(personal),"version":0}
            return r({"profile":state["profile"],"token":"rw_"+"a"*64})
        if action=="profile.save":
            if state["conflict"]:return r({"message":"版本冲突，不能覆盖。"},409)
            state["profile"]["data"]=body["data"];state["profile"]["version"]+=1
            return r({"profile":state["profile"]})
        return r({"message":"fixture action not supported"},400)
    return state,handle
def tap(page,text):page.get_by_role("button",name=text,exact=True).dispatch_event("tap")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get("CHROMIUM_PATH"),args=["--no-sandbox"])
    for platform in ["mp-weixin","ios","android","harmony"]:
        ctx=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
        page=ctx.new_page();errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
        state,handle=fixtures();page.expose_function("__fixture",handle)
        css=(OUT/"client-fixture.css").read_text();js=(OUT/"client-fixture.js").read_text().replace("</script","<\\/script")
        backend={"ios":"ios-keychain","android":"android-keystore","harmony":"harmony-asset"}.get(platform,"unsupported")
        vault_fixture="window.__vaultStore=new Map();window.__vaultCalls=[];window.__vaultFail=false;window.__vaultInvoke=(op,key,value,cb)=>{window.__vaultCalls.push(op);if(window.__vaultFail)return cb(JSON.stringify({ok:false,code:'locked'}));if(op==='write')window.__vaultStore.set(key,value);if(op==='remove')window.__vaultStore.delete(key);cb(JSON.stringify({ok:true,value:op==='read'?(window.__vaultStore.get(key)||''):''}));};"
        page.set_content('<meta charset="utf-8"><style>'+css+'</style><div id="app"></div><script>window.__platform='+json.dumps(platform)+';window.__vaultBackend='+json.dumps(backend)+';'+vault_fixture+'</script><script>'+js+'</script>')
        page.wait_for_selector(".tweet",timeout=15000);page.wait_for_timeout(200)
        check(platform+" live source card rendered","Fixture timing" in page.locator(".tweet").inner_text())
        check(platform+" navigation contract",page.locator(".bottom-tabs button").count()==(3 if platform=="mp-weixin" else 4))
        check(platform+" no automatic enrollment",not state["requests"])
        check(platform+" dual timezone","美国太平洋时间" in page.locator(".author").inner_text())
        before=page.locator(".value").nth(1).inner_text()
        tap(page,"← 上一条")
        check(platform+" page updates original and elapsed","Fixture announcement" in page.locator(".english").inner_text() and before!=page.locator(".value").nth(1).inner_text())
        page.evaluate("window.__vm.tab='mine'");page.wait_for_timeout(80)
        tap(page,"同意用途并创建档案");page.wait_for_selector(".secret")
        check(platform+" explicit enrollment only",state["profile"] is not None)
        check(platform+" no automatic credential persistence",page.evaluate("!window.__vaultCalls.includes('write')"))
        if platform=="mp-weixin":
            check(platform+" plaintext persistence control absent",page.get_by_role("button",name="同意并安全保存连接",exact=True).count()==0)
        else:
            tap(page,"同意并安全保存连接");page.wait_for_timeout(100)
            check(platform+" opt-in calls native vault boundary",page.evaluate("window.__vaultCalls.filter(x=>x==='write').length===1"))
            check(platform+" remembered state displayed","已安全保存" in page.locator(".vault-status").inner_text())
            page.screenshot(path=str(OUT/f"secure-session-{platform}.png"),full_page=True)
            tap(page,"清除本机保存的凭据");page.wait_for_timeout(100)
            check(platform+" forget clears native vault",page.evaluate("window.__vaultStore.size===0"))
            page.evaluate("window.__vaultFail=true")
            tap(page,"同意并安全保存连接");page.wait_for_timeout(100)
            check(platform+" locked store not fake success","未确认成功" in page.locator(".vault-status").inner_text())
            page.evaluate("window.__vaultFail=false")
        page.locator('input[placeholder="原本就需要完成的重要工作"]').fill("Review API tests")
        tap(page,"添加任务");page.wait_for_timeout(200)
        check(platform+" task saved to backend contract",len(state["profile"]["data"]["tasks"])==1)
        state["conflict"]=True;tap(page,"标记完成");page.wait_for_timeout(150)
        check(platform+" conflict surfaced without fake save",not state["profile"]["data"]["tasks"][0]["done"] and "不能覆盖" in page.locator(".notice").inner_text())
        state["conflict"]=False
        page.evaluate("window.__vm.tab='reminders'; window.__vm.loadDeliveries()");page.wait_for_timeout(180)
        check(platform+" provider accepted not falsely delivered","设备送达未知" in page.locator(".receipt").inner_text())
        page.evaluate("window.__vm.preferences.enabled=true")
        tap(page,"保存偏好");page.wait_for_timeout(200)
        check(platform+" preferences saved",state["profile"]["data"]["preferences"]["enabled"])
        page.evaluate("window.__vm.theme='dark';window.__vm.tab='events'");page.wait_for_timeout(80)
        check(platform+" dark theme",page.locator(".page").evaluate("(e)=>e.classList.contains('theme-dark')"))
        check(platform+" no page overflow",page.evaluate("document.documentElement.scrollWidth<=innerWidth+2"))
        page.screenshot(path=str(OUT/f"client-{platform}.png"),full_page=True)
        page.evaluate("window.__vm.startDemo();window.__vm.tab='mine'");page.wait_for_timeout(80)
        check(platform+" demo mutation disabled",page.get_by_role("button",name="添加任务",exact=True).is_disabled())
        check(platform+" no JavaScript errors",errors==[])
        page.evaluate("window.__vm.$options.onUnload.call(window.__vm)")
        ctx.close()
    browser.close()
(OUT/"client-ui-results.json").write_text(json.dumps({"passed":len(results),"assertions":results,"evidence":"Vue browser/uni API fixtures; no native SDK or device assertion"},ensure_ascii=False,indent=2))
print(f"Client browser assertions {len(results)}/{len(results)} PASS")
