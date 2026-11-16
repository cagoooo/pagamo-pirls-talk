"""產生 favicon（ico／apple-touch／PWA 圖示）與 1200×630 社群預覽圖。
用法：python scripts/make_icons_og.py（需要 playwright 與 pillow；OG 圖會連 Google Fonts）"""
import base64, io, pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
svg = (ROOT / 'favicon.svg').read_text(encoding='utf-8')
svg_uri = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()
bg_png = (ROOT / '_gen' / 'quest_cover.png').read_bytes()
bg_uri = 'data:image/png;base64,' + base64.b64encode(bg_png).decode()

OG_HTML = f"""<!doctype html><meta charset=utf-8>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@500;700;900&family=Silkscreen&display=swap" rel="stylesheet">
<style>
html,body{{margin:0;width:1200px;height:630px;overflow:hidden;background:#101b33}}
.bg{{position:absolute;inset:0;background:url({bg_uri}) center 45%/cover}}
.shade{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,15,31,.92) 0%,rgba(9,15,31,.78) 52%,rgba(9,15,31,.15) 82%)}}
.box{{position:absolute;left:64px;top:62px;width:690px;font-family:'Noto Sans TC',sans-serif;color:#fdf6e3}}
.tag{{display:inline-block;font-family:'Noto Sans TC',sans-serif;font-weight:700;font-size:24px;color:#101b33;background:#ffd166;border-radius:8px;padding:4px 14px;letter-spacing:.04em}}
.tag b{{font-family:'Noto Sans TC';font-weight:900;margin-left:8px}}
h1{{margin:22px 0 0;font-size:92px;line-height:1.08;font-weight:900;text-shadow:0 6px 0 #070d1c}}
h2{{margin:18px 0 0;font-size:34px;font-weight:700;color:#ffd166}}
.chips{{display:flex;gap:10px;margin-top:28px;flex-wrap:nowrap}}
.chip{{font-size:22px;font-weight:700;border:3px solid #4cc9f0;color:#e6f7ff;background:rgba(76,201,240,.12);border-radius:10px;padding:5px 12px;white-space:nowrap}}
.chip.go{{border-color:#ffd166;color:#ffd166;background:rgba(255,209,102,.12)}}
.by{{margin-top:30px;font-size:24px;color:#b9c4dc;font-weight:500}}
.frame{{position:absolute;inset:14px;border:4px solid #ffd166;border-radius:22px;box-shadow:0 0 0 4px #101b33 inset}}
</style>
<div class=bg></div><div class=shade></div><div class=frame></div>
<div class=box>
  <span class=tag>PaGamO 神隊友社群<b>2026.12.11</b></span>
  <h1>好文章<br>一鍵變題組</h1>
  <h2>PIRLS 閱讀題組小幫手｜Chrome 擴充功能</h2>
  <div class=chips><span class=chip>📷 截圖</span><span class=chip>📖 讀全文</span><span class=chip>🎬 YouTube</span><span class="chip go">🚀 送進 PaGamO</span></div>
  <div class=by>阿凱老師・桃園市龍潭區石門國民小學</div>
</div>"""


def icon_html(size, maskable=False):
    pad = round(size * 0.1) if maskable else 0
    bg = '#101b33' if maskable else 'transparent'
    return (f"<!doctype html><style>html,body{{margin:0;width:{size}px;height:{size}px;background:{bg}}}"
            f"img{{position:absolute;left:{pad}px;top:{pad}px;width:{size - 2 * pad}px;height:{size - 2 * pad}px}}</style>"
            f"<img src='{svg_uri}'>")


with sync_playwright() as p:
    b = p.chromium.launch()

    def shot(html, w, h, omit_bg=True):
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(html)
        pg.wait_for_load_state('networkidle')
        pg.wait_for_timeout(500)
        data = pg.screenshot(omit_background=omit_bg)
        pg.close()
        return Image.open(io.BytesIO(data)).convert('RGBA')

    big = shot(icon_html(512), 512, 512)
    for name, size in [('images/app/icon-192.png', 192), ('images/app/icon-512.png', 512)]:
        big.resize((size, size), Image.LANCZOS).save(ROOT / name)
    for name, size in [('images/app/icon-192-maskable.png', 192), ('images/app/icon-512-maskable.png', 512)]:
        shot(icon_html(512, True), 512, 512, False).resize((size, size), Image.LANCZOS).save(ROOT / name)
    # apple-touch：iOS 會自己加圓角，用滿版深藍底
    shot(icon_html(512, True), 512, 512, False).resize((180, 180), Image.LANCZOS).convert('RGB').save(ROOT / 'apple-touch-icon.png')
    big.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

    og = shot(OG_HTML, 1200, 630, False).convert('RGB')
    og.save(ROOT / 'og-image.jpg', quality=88, optimize=True)
    b.close()
print('ok')
