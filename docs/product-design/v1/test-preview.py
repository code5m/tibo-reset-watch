"""Browser-only UI prototype checks. No production DB, SDK or notification test."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = Path(os.environ.get('RESETWATCH_DESIGN_OUTPUT', 'design-artifacts')).resolve()
OUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
network = []
SCOPE = 'Browser prototype only; no real X data, DB, SDK, accounts or notifications'

def report():
    data = {'scope': SCOPE, 'checks': checks, 'total': len(checks),
            'passed': sum(c['pass'] for c in checks), 'errors': errors, 'externalRequests': network}
    (OUT / 'report.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    return data

def record(name, condition):
    checks.append({'name': name, 'pass': bool(condition)})
    report()
    assert condition, name

def url(query=''):
    return (ROOT / 'index.html').as_uri() + '?' + query

with sync_playwright() as pw:
    opts = {'headless': True}
    if os.environ.get('CHROMIUM_PATH'):
        opts['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = pw.chromium.launch(**opts)
    context = browser.new_context(viewport={'width': 1500, 'height': 1080}, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: network.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.goto(url('freeze=1'))
    record('seven platform/design views', page.locator('[data-platform]').count() == 7)
    record('one tweet per page', page.locator('.tweet').count() == 1)
    record('initial page 2 of 2', '2 / 2' in page.locator('#counter').inner_text())
    page.locator('[data-prev]').click()
    record('previous button bounded', page.locator('[data-prev]').is_disabled())
    before = page.locator('[data-age]').first.inner_text()
    page.locator('[data-next]').click()
    record('post age updates with page', page.locator('[data-age]').first.inner_text() != before)
    record('next button bounded', page.locator('[data-next]').is_disabled())
    page.locator('.tweet').focus()
    page.keyboard.press('ArrowLeft')
    record('keyboard page navigation', '1 / 2' in page.locator('#counter').inner_text())
    page.locator('.triscroll').focus()
    page.keyboard.press('ArrowRight')
    record('reading area does not turn pages', '1 / 2' in page.locator('#counter').inner_text())
    page.locator('[data-next]').click()
    page.screenshot(path=str(OUT / 'workbench.png'), full_page=True)
    page.locator('#theme').click()
    record('dark theme', page.locator('html').evaluate('(e)=>e.classList.contains("dark")'))
    page.screenshot(path=str(OUT / 'workbench-dark.png'), full_page=True)
    page.locator('#theme').click()
    page.select_option('#scenario', 'done')
    confirmed_value = page.locator('[data-rem]').first.inner_text()
    confirmed_label = page.locator('[data-rem-label]').first.inner_text()
    record('completed metric has confirmation label', '\u5b98\u65b9\u786e\u8ba4' in confirmed_label and '\u63d0\u524d' in confirmed_label)
    record('completed metric has exact fixture duration', confirmed_value == '3\u65f620\u52060\u79d2')
    page.locator('[data-prev]').click()
    record('completion persists on old post', page.locator('[data-rem-label]').first.inner_text() == confirmed_label and page.locator('[data-rem]').first.inner_text() == confirmed_value)
    record('completion is not relabeled as countdown on old post', '\u8fd8\u6709' not in page.locator('[data-rem]').first.inner_text())
    for scenario in ['planned','rolling','done','overdue','unknown','banked','correction','offline','empty']:
        page.select_option('#scenario', scenario)
        record('scene renders '+scenario, page.locator('#root').inner_text().strip() != '')
        if scenario in ['unknown','banked','correction']:
            record('no invented deadline '+scenario, page.locator('[data-rem]').first.inner_text() == '\u672a\u77e5')
        if scenario == 'overdue':
            record('overdue is not complete', '\u5df2\u8fc7' in page.locator('[data-rem]').first.inner_text())
        if scenario in ['offline','empty']:
            record('no fake source '+scenario, page.locator('.tweet').count() == 0)
    page.select_option('#scenario','planned')
    for section in ['overview','history','delivery','studio','settings']:
        page.locator('.rail [data-nav="'+section+'"]').click()
        record('workbench section '+section, page.locator('.main h1').count() == 1)
        if section == 'delivery':
            record('marketing opt-in off by default', page.locator('[data-toggle="marketing"]').get_attribute('aria-checked') == 'false')
            page.locator('[data-toggle="marketing"]').click()
            record('prototype preferences clickable', page.locator('[data-toggle="marketing"]').get_attribute('aria-checked') == 'true')
            page.locator('[data-test-notification]').click()
            record('notification test does not fake delivery', page.locator('#dialog').is_visible())
            page.locator('#dialog-close').click()
            page.screenshot(path=str(OUT / 'delivery.png'), full_page=True)
        if section == 'studio':
            page.locator('[data-draft="social"]').click()
            record('independent social draft', '\u4f20\u64ad\u7a3f' in page.locator('#draft-text').inner_text())
            page.screenshot(path=str(OUT / 'content-studio.png'), full_page=True)
    for platform in ['mini','ios','android','harmony']:
        page.goto(url('freeze=1&platform='+platform))
        record('mobile shell '+platform, page.locator('.device.'+platform).count() == 1)
        record('one tweet mobile '+platform, page.locator('.tweet').count() == 1)
        record('three column order '+platform, page.locator('.col-label').all_inner_texts()[:2] == ['\u901a\u4fd7\u89e3\u91ca','\u4e2d\u6587\u7ffb\u8bd1'])
        record('source scroll independent '+platform, page.locator('.triscroll').evaluate('(e)=>e.scrollWidth>e.clientWidth'))
        page.locator('.device').screenshot(path=str(OUT / (platform+'.png')))
        for section in ['history','settings']:
            page.locator('.mobile-bottom [data-nav="'+section+'"]').click()
            record('mobile navigation '+platform+'/'+section, page.locator('.mobile-bottom .active').get_attribute('data-nav') == section)
        page.locator('.mobile-content [data-nav="delivery"]').click()
        record('mobile notification settings '+platform, page.locator('[data-toggle="new"]').count() == 1)
        page.locator('.device').screenshot(path=str(OUT / (platform+'-notifications.png')))
    for view in ['future','system']:
        page.goto(url('freeze=1&platform='+view))
        record('product design view '+view, page.locator('main h1').count() == 1)
        page.screenshot(path=str(OUT / (view+'.png')), full_page=True)
    for width in [375,768,1500]:
        page.set_viewport_size({'width':width,'height':1000})
        for platform in ['web','mini','ios','android','harmony','future','system']:
            page.goto(url('freeze=1&platform='+platform))
            record('viewport no page overflow '+platform+'/'+str(width), page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.goto(url())
    old = page.locator('[data-clock]').first.inner_text()
    page.wait_for_timeout(1300)
    record('live device clock updates', page.locator('[data-clock]').first.inner_text() != old)
    record('no JavaScript errors', not errors)
    record('no external requests', not network)
    context.close()
    browser.close()

report()
print(json.dumps({'passed':sum(c['pass'] for c in checks),'total':len(checks),'screenshots':len(list(OUT.glob('*.png'))),'scope':SCOPE},ensure_ascii=False))
