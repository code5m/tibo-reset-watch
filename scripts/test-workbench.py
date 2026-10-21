"""Browser-only regression tests. Requires playwright + Chromium; no external API calls."""
import json
import os
from pathlib import Path
import subprocess

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("RESETWATCH_TEST_OUTPUT", ROOT / "test-output"))
OUT.mkdir(parents=True, exist_ok=True)

def load_page(page, demo=True, data=None, status=200):
    # Pure in-memory DOM/API harness: no outbound network or localhost navigation.
    markup = (ROOT/"apps/web/public/workbench/index.html").read_text()
    css = (ROOT/"apps/web/public/workbench/style.css").read_text()
    core = (ROOT/"packages/reset-core/index.js").read_text()
    app = (ROOT/"apps/web/public/workbench/app.js").read_text().split("\n",1)[1]
    payload = data or {"message":"database unavailable"}
    setup = "globalThis.RESETWATCH_DEMO_PREVIEW="+str(demo).lower()+";"
    setup += "globalThis.fetch=async()=>new Response("+json.dumps(json.dumps(payload))+",{status:"+str(status)+",headers:{'Content-Type':'application/json'}});"
    markup = markup.replace('<link rel="stylesheet" href="./style.css">', "<style>"+css+"</style>")
    markup = markup.replace('<script type="module" src="./app.js"></script>', "<script>"+setup+"</script><script type='module'>"+core+"\n"+app+"</script>")
    page.bring_to_front()
    page.set_content(markup)
results = []
def check(name, ok):
    if not ok:
        raise AssertionError(name)
    results.append({"test":name,"result":"PASS"})
    print("PASS: " + name, flush=True)

try:
    with sync_playwright() as p:
        launch_options = {"headless": True, "args": ["--no-sandbox"]}
        if os.environ.get("CHROMIUM_PATH"):
            launch_options["executable_path"] = os.environ["CHROMIUM_PATH"]
        browser = p.chromium.launch(**launch_options)
        page = browser.new_page(viewport={"width":1440,"height":1160}, device_scale_factor=1)
        errors=[]
        page.on("pageerror", lambda error: errors.append(str(error)))
        load_page(page)
        page.wait_for_selector("#event-view:not([hidden])")
        check("demo explicitly labelled and not a real announcement","演示" in page.locator("#mode-tag").inner_text())
        check("meaningful timing post selected by default","第 2 / 2 条" == page.locator("#page-count").inner_text())
        check("next button disabled at boundary",page.locator("#next").is_disabled())
        second=page.locator("#elapsed").inner_text()
        page.locator("#previous").click()
        check("previous page updates original and counter","第 1 / 2 条" == page.locator("#page-count").inner_text() and "Sample announcement" in page.locator("#original").inner_text())
        check("post age changes with page",page.locator("#elapsed").inner_text()!=second)
        check("previous button disabled at boundary",page.locator("#previous").is_disabled())
        page.locator("#tweet").focus()
        page.keyboard.press("ArrowRight")
        check("keyboard pagination works",page.locator("#page-count").inner_text()=="第 2 / 2 条")
        page.locator(".column-scroll").focus()
        page.keyboard.press("ArrowLeft")
        check("content scrolling does not trigger pagination",page.locator("#page-count").inner_text()=="第 2 / 2 条")
        before=page.locator("#clock").inner_text()
        page.wait_for_function("(previous)=>document.getElementById('clock').textContent!==previous", arg=before, timeout=7000)
        check("foreground clock updates automatically",page.locator("#clock").inner_text()!=before)
        check("no fabricated live source link in demo",page.locator("#source").is_hidden())
        page.locator("#event-title").click()
        page.screenshot(path=str(OUT/"workbench-desktop.png"),full_page=True)
        page.locator('[data-tab="studio"]').click()
        check("independent unpublished alert and promotion drafts",
              page.locator("#alert-draft").input_value()!=page.locator("#social-draft").input_value()
              and "未发布" in page.locator("#social-draft").input_value())
        page.locator('[data-tab="history"]').click()
        check("history comparison includes personal receipt unknown","未知" in page.locator("#history").inner_text())
        page.locator('[data-tab="platforms"]').click()
        check("platform readiness never implies signed native apps","未生成 APK" in page.locator("#tab-platforms").inner_text())
        page.locator('[data-tab="feed"]').click()
        mobile=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
        load_page(mobile)
        mobile.wait_for_selector("#event-view:not([hidden])")
        check("mobile viewport has no page-wide overflow",
              mobile.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        check("mobile three columns scroll inside card",
              mobile.locator(".column-scroll").evaluate("(e)=>e.scrollWidth>e.clientWidth"))
        mobile.locator("#previous").click()
        check("mobile pagination buttons work",mobile.locator("#page-count").inner_text()=="第 1 / 2 条")
        mobile.screenshot(path=str(OUT/"workbench-mobile.png"),full_page=True)
        failed=browser.new_page()
        load_page(failed,demo=False,status=503)
        failed.wait_for_selector("#message.error")
        check("API outage is not called no reset or silently replaced with demo",
              "这不代表没有新 Reset" in failed.locator("#message").inner_text() and "真实数据" in failed.locator("#mode-tag").inner_text())
        data=json.loads(subprocess.check_output(["node","--input-type=module","-e",
            "import{demoCatalog}from './packages/reset-core/index.js';console.log(JSON.stringify(demoCatalog()))"],cwd=ROOT))
        e=data["events"][0]
        e.pop("demo")
        e["id"]="test-fixture";e["title"]="TEST FIXTURE, NOT NEWS"
        for i,post in enumerate(e["posts"]):
            post["id"]=str(100+i);post["url"]="https://x.com/thsottiaux/status/"+post["id"];post["evidence"]="official"
        e["deadline"]["sourcePostId"]="101"
        e["posts"][1]["original"]='<img src=x onerror="window.XSS=true">'
        data.update({"serverTime":e["posts"][1]["publishedAt"],"total":1,"nextOffset":None,"pendingReviewCount":2})
        # serverTime should be actual current, not original-post time.
        import datetime
        data["serverTime"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
        live=browser.new_page()
        load_page(live,demo=False,data=data)
        live.wait_for_selector("#event-view:not([hidden])")
        check("untrusted source text remains text, not executable HTML",
              live.locator("#original img").count()==0 and live.evaluate("window.XSS") is None)
        live.locator("#previous").click()
        live.locator("#refresh").click()
        live.wait_for_timeout(250)
        check("refresh preserves the page currently being read",live.locator("#page-count").inner_text()=="第 1 / 2 条")
        check("no uncaught browser exceptions",not errors)
        browser.close()
finally:
    pass

(OUT/"browser-results.json").write_text(json.dumps({"passed":len(results),"tests":results},ensure_ascii=False,indent=2),encoding="utf8")
print(f"{len(results)} browser checks PASS; artifacts: {OUT}")
