"""用封面底圖合成 1200×630 的社群預覽圖。用法：python scripts/make_og.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

bg = Image.open('_gen/bg_cover.png').convert('RGB')
w, h = bg.size
th = round(w * 630 / 1200)
bg = bg.crop((0, (h - th) // 2, w, (h - th) // 2 + th)).resize((1200, 630), Image.LANCZOS)
panel = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
d = ImageDraw.Draw(panel)
d.rounded_rectangle((150, 150, 1050, 480), radius=36, fill=(255, 252, 246, 225))
img = Image.alpha_composite(bg.convert('RGBA'), panel)
d = ImageDraw.Draw(img)
bold = 'C:/Windows/Fonts/msjhbd.ttc'
reg = 'C:/Windows/Fonts/msjh.ttc'
def center(text, y, font, fill):
    tw = d.textlength(text, font=font)
    d.text(((1200 - tw) / 2, y), text, font=font, fill=fill)
center('PaGamO 神隊友社群｜2026.12.11', 182, ImageFont.truetype(bold, 28), (232, 100, 58))
center('好文章一鍵變題組', 230, ImageFont.truetype(bold, 84), (31, 35, 40))
center('用 AI 小幫手把閱讀素養題送進 PaGamO', 340, ImageFont.truetype(bold, 36), (11, 127, 179))
center('阿凱老師・桃園市龍潭區石門國民小學', 408, ImageFont.truetype(reg, 28), (91, 100, 112))
img.convert('RGB').save('og-image.jpg', quality=88, optimize=True)
print('ok')
