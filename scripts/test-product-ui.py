"""Actual UI/ES modules with API fixtures; not production delivery or native certification."""
import json,os,copy
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
from workbench_harness import serve
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get("RESETWATCH_TEST_OUTPUT",ROOT/"test-output"));OUT.mkdir(parents=True,exist_ok=True)
results=[]
def check(name,value):
    if not value: raise AssertionError(name)
    results.append({"name":name,"passed":True});print("PASS",name,flush=True)
def fixture():
    import datetime
    now=datetime.datetime.now(datetime.timezone.utc)
    def iso(delta):return (now+datetime.timedelta(seconds=delta)).isoformat(timespec="milliseconds")
    event={"id":"fixture-one","title":"隔离测试事件，非新闻","type":"global","posts":[
      {"id":"90001","url":"https://x.com/thsottiaux/status/90001","publishedAt":iso(-600),"stage":"announced","evidence":"official","original":"Fixture announcement.","translation":"仅用于测试","explanation":"不是实际公告。"},
      {"id":"90002","url":"https://x.com/thsottiaux/status/90002","publishedAt":iso(-300),"stage":"scheduled","evidence":"official","original":"Fixture schedule.","translation":"仅用于测试时间","explanation":"不是实际公告。"}
    ],"deadline":{"at":iso(3600),"kind":"upper_bound","basis":"explicit","sourcePostId":"90002","alternativeAt":None,"note":None}}
    return {"schemaVersion":1,"serverTime":iso(0),"events":[event],"total":1,"nextOffset":None,"pendingReviewCount":0}
def setup(page,authenticated=False):
    state={"profile":None,"bodies":[],"conflict":False,"workspaces":[],"drafts":[],"network":False}
    personal={"schemaVersion":1,"preferences":{"theme":"system","enabled":False,"sources":["tibo"],"types":["global","banked"],"windows":[6,3,1],"quiet":{"enabled":False,"start":"23:00","end":"07:00"}},"tasks":[],"bookmarks":[]}
    def profile():return {"id":"11111111-1111-4111-8111-111111111111","display_name":"测试档案","data":copy.deepcopy(personal),"version":0}
    if authenticated:state["profile"]=profile()
    def handler(route):
        req=route.request;u=urlparse(req.url);q=parse_qs(u.query)
        if u.path=="/api/v1/reset-events":
            if state["network"]:return route.fulfill(status=503,json={"message":"fixture unavailable"})
            return route.fulfill(json=fixture())
        if u.path=="/api/v1/product":
            view=q.get("view",["profile"])[0]
            if req.method=="GET":
                if view=="capabilities":return route.fulfill(json={"storage":True,"sources":[{"id":"tibo","name":"Tibo","available":True}],"sendEnabled":False,"nativePush":False})
                if view=="widget":return route.fulfill(json={"available":False,"reason":"没有可核验事件","serverTime":fixture()["serverTime"]})
                if view=="drafts":return route.fulfill(json={"drafts":state["drafts"]})
                if not state["profile"]:return route.fulfill(status=401,json={"message":"请先连接档案。"})
                if view=="profile":return route.fulfill(json={"profile":state["profile"]})
                if view=="deliveries":return route.fulfill(json={"deliveries":[{"id":"22222222-2222-4222-8222-222222222222","event_id":"fixture-one","phase":"announced","channel":"native","status":"accepted","accepted_at":fixture()["serverTime"],"queued_at":fixture()["serverTime"],"received_at":None,"opened_at":None}]})
                if view=="devices":return route.fulfill(json={"devices":[]})
                if view=="workspaces":return route.fulfill(json={"workspaces":state["workspaces"]})
                if view=="export":return route.fulfill(json={"profile":{"data":state["profile"]["data"]}})
            body=req.post_data_json;state["bodies"].append(body);action=body.get("action")
            if action in ["profile.create","profile.connect"]:
                state["profile"]=profile();return route.fulfill(json={"profile":state["profile"],"token":"rw_"+"a"*64})
            if not state["profile"]:return route.fulfill(status=401,json={"message":"未连接。"})
            if action=="profile.save":
                if state["conflict"]:return route.fulfill(status=409,json={"message":"其他设备已更新，不能覆盖。"})
                if body["expectedVersion"]!=state["profile"]["version"]:return route.fulfill(status=409,json={"message":"版本冲突"})
                state["profile"]["data"]=body["data"];state["profile"]["version"]+=1
                return route.fulfill(json={"profile":state["profile"]})
            if action=="workspace.create":
                w={"id":"33333333-3333-4333-8333-333333333333","name":body["name"],"version":0,"role":"owner","data":copy.deepcopy(personal),"members":[]}
                state["workspaces"]=[w];return route.fulfill(json={"id":w["id"]})
            if action=="workspace.save":
                state["workspaces"][0]["data"]=body["data"];state["workspaces"][0]["version"]+=1
                return route.fulfill(json={"version":state["workspaces"][0]["version"]})
            if action=="workspace.invite":return route.fulfill(json={"invite":"rw_"+"b"*64,"expiresInHours":24,"oneTime":True})
            if action=="draft.save":
                state["drafts"].append({"id":"44444444-4444-4444-8444-444444444444","event_id":body["eventId"],"kind":body["kind"],"body":body["text"],"status":"draft","version":0})
                return route.fulfill(json={"id":state["drafts"][-1]["id"],"published":False})
            if action=="profile.logout":state["profile"]=None;return route.fulfill(json={"disconnected":True})
            return route.fulfill(json={"recorded":True})
        if u.path.startswith("/api/"):return route.fulfill(status=401,json={"message":"运营权限 required"})
        base=ROOT/"apps/web/public/workbench";f=base/u.path.removeprefix("/workbench/")
        if f.is_file() and base in f.resolve().parents:
            mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"}.get(f.suffix,"text/plain")
            return route.fulfill(content_type=mime+"; charset=utf-8",body=f.read_bytes())
        return route.abort()
    def dispatch(req):
        class Request:
            url="https://resetwatch.test"+req["url"]
            method=req["method"]
            post_data_json=req["body"]
        class Route:
            request=Request()
            def fulfill(self,**kw):return {"status":kw.get("status",200),"body":kw.get("json",{})}
            def abort(self):return {"status":503,"body":{"message":"Unexpected request"}}
        return handler(Route())
    serve(page,dispatch)
    page.wait_for_selector("#event-view:not([hidden])",timeout=8000)
    page.wait_for_timeout(200)
    return state
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get("CHROMIUM_PATH"),args=["--no-sandbox"])
    context=browser.new_context(viewport={"width":1440,"height":1050},service_workers="block")
    page=context.new_page();errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
    state=setup(page)
    check("guest creates no profile or send action automatically",state["bodies"]==[])
    check("bookmark locked until profile connected",page.locator("#bookmark").is_disabled())
    page.locator("#event-search").fill("not-matching")
    check("search has explicit no-results",page.locator("#no-match").is_visible())
    page.locator("#event-search").fill("")
    check("clearing filter restores card",page.locator("#event-view").is_visible())
    page.locator('[data-tab="platforms"]').click()
    page.locator("#profile-create").click()
    page.wait_for_timeout(100)
    check("consent required before profile enrollment",not state["bodies"])
    page.locator("#profile-consent").check()
    page.locator("#profile-create").click();page.wait_for_selector("#secret-dialog[open]")
    check("recovery secret only displayed on explicit enrollment",page.locator("#secret-value").input_value().startswith("rw_"))
    check("recovery secret not persisted to localStorage",not page.evaluate("JSON.stringify(localStorage).includes('rw_')"))
    page.locator("#close-secret").click()
    check("dialog clears sensitive value on close",page.locator("#secret-value").input_value()=="")
    page.locator("#theme-toggle").click()
    check("theme toggle implemented",page.evaluate("document.documentElement.dataset.theme")=="dark")
    page.locator('[data-tab="delivery"]').click()
    page.locator("#pref-enabled").check()
    page.locator('[data-window="6"]').uncheck()
    page.locator("#pref-save").click()
    page.wait_for_function("document.getElementById('product-status').textContent.includes('已保存')")
    check("preferences saved to real action contract",state["profile"]["data"]["preferences"]["enabled"] and state["profile"]["data"]["preferences"]["windows"]==[3,1])
    check("provider acceptance is not called device delivered","设备送达未知" in page.locator("#delivery-list").inner_text())
    state["conflict"]=True
    page.locator("#pref-enabled").uncheck();page.locator("#pref-save").click()
    page.wait_for_function("document.getElementById('product-status').textContent.includes('不能覆盖')")
    check("version conflict does not fake successful save",state["profile"]["data"]["preferences"]["enabled"])
    state["conflict"]=False
    page.locator('[data-tab="tasks"]').click()
    page.locator("#task-title").fill("<img src=x onerror=alert(1)> test")
    page.locator("#task-add").click()
    page.wait_for_function("document.querySelectorAll('[data-task-check]').length===1")
    check("tasks use profile.save and persist",len(state["profile"]["data"]["tasks"])==1)
    check("task title escaped, not interpreted as markup",page.locator("#task-list img").count()==0)
    page.locator("[data-task-check]").check();page.wait_for_timeout(150)
    check("task done is persisted",state["profile"]["data"]["tasks"][0]["done"])
    page.locator('[data-tab="teams"]').click()
    page.locator("#team-name").fill("Design review")
    page.locator("#team-create").click()
    page.wait_for_selector("#team-task-add")
    page.locator("#team-task-title").fill("Review source evidence")
    page.locator("#team-task-add").click();page.wait_for_timeout(150)
    check("team UI saves through role-protected contract",len(state["workspaces"][0]["data"]["tasks"])==1)
    state["workspaces"][0]["role"]="viewer"
    page.locator("#team-refresh").click();page.wait_for_timeout(150)
    check("viewer cannot edit team",page.locator("#team-task-add").count()==0 and page.locator("[data-team-task]").is_disabled())
    page.locator('[data-tab="studio"]').click()
    page.locator("#save-alert").click();page.wait_for_timeout(150)
    check("alert stored as draft, not sent",len(state["drafts"])==1 and state["drafts"][0]["status"]=="draft")
    page.locator('[data-tab="feed"]').click()
    page.locator("#bookmark").click();page.wait_for_timeout(150)
    check("event bookmark persists",state["profile"]["data"]["bookmarks"]==["fixture-one"])
    page.locator("#demo").click()
    check("demo writes blocked even with connected profile",page.locator("#bookmark").is_disabled())
    page.locator('[data-tab="studio"]').click()
    check("demo cannot save fake announcement as production draft",page.locator("#save-alert").is_disabled())
    page.locator('[data-tab="feed"]').click()
    page.screenshot(path=str(OUT/"product-workbench-dark.png"),full_page=True)
    page.locator("#theme-toggle").click()
    page.screenshot(path=str(OUT/"product-workbench-light.png"),full_page=True)
    for width in [375,768,1500]:
        page.set_viewport_size({"width":width,"height":1000})
        for tab in ["feed","history","delivery","studio","platforms","tasks","teams","widgets"]:
            page.locator(f'[data-tab="{tab}"]').click();page.wait_for_timeout(60)
            check(f"no page overflow {width} {tab}",page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
        page.locator('[data-tab="feed"]').click()
        page.screenshot(path=str(OUT/f"product-web-{width}.png"),full_page=True)
    check("no JS errors",not errors)
    browser.close()
(OUT/"product-ui-results.json").write_text(json.dumps({"passed":len(results),"tests":results,"scope":"Browser UI, intercepted API fixtures; not native SDK or real push."},ensure_ascii=False,indent=2))
print(len(results),"PASS")
