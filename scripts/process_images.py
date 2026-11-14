"""底圖轉 JPG；圖標總表（2 列 × 4 欄）裁成 8 個圖標，依亮度去背。用法：python scripts/process_images.py"""
from pathlib import Path
from PIL import Image

G, OUT = Path('_gen'), Path('images')
for n in ['bg_cover', 'bg_solution', 'bg_closing']:
    im = Image.open(G / f'{n}.png').convert('RGB')
    im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS).save(OUT / f'{n}.jpg', quality=84, optimize=True)

names = ['keyboard', 'pyramid', 'upload', 'rocket', 'magnifier', 'bulb', 'puzzle', 'scale']
sheet = Image.open(G / 'icon_sheet.png').convert('RGBA')
W, H = sheet.size
cw, ch = W / 4, H / 2
for i, name in enumerate(names):
    r, c = divmod(i, 4)
    cell = sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
    px = cell.load()
    for y in range(cell.height):
        for x in range(cell.width):
            R, Gc, B, _ = px[x, y]
            lum = max(R, Gc, B)
            a = 0 if lum < 45 else 255 if lum > 80 else round((lum - 45) / 35 * 255)
            px[x, y] = (R, Gc, B, a)
    box = cell.getbbox()
    icon = cell.crop(box)
    side = max(icon.size) + 16
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2))
    sq.resize((256, 256), Image.LANCZOS).save(OUT / f'icon_{name}.png')
print('ok')
