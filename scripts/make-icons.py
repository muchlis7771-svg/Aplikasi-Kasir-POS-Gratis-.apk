# Membuat ikon launcher Android (adaptif + lama) dari public/icons/icon-full.png (1024, penuh tanpa sudut)
import os
from PIL import Image, ImageDraw
src = Image.open('public/icons/icon-full.png').convert('RGBA')
res = 'android/app/src/main/res'
def mask(im, shape):
    s = im.size[0]; m = Image.new('L', (s * 4, s * 4), 0); d = ImageDraw.Draw(m)
    if shape == 'round': d.ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    else: d.rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * 0.22), fill=255)
    o = im.copy(); o.putalpha(m.resize((s, s), Image.LANCZOS)); return o
legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, s in legacy.items():
    folder = f'{res}/mipmap-{d}'
    os.makedirs(folder, exist_ok=True)
    c = int(src.size[0] * 0.1); im = src.crop((c, c, src.size[0] - c, src.size[0] - c)).resize((s, s), Image.LANCZOS)  # ikon lama: lambang diperbesar
    mask(im, 'sq').save(f'{folder}/ic_launcher.png')
    mask(im, 'round').save(f'{folder}/ic_launcher_round.png')
    # lapisan depan ikon adaptif = 108dp (2.25 x 48dp); seluruh desain penuh, launcher memotong pinggirnya
    fg = src.resize((int(s * 2.25), int(s * 2.25)), Image.LANCZOS); fg.save(f'{folder}/ic_launcher_foreground.png')
os.makedirs(f'{res}/values', exist_ok=True)
with open(f'{res}/values/ic_launcher_background.xml', 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B1330</color>\n</resources>\n')
ad = f'{res}/mipmap-anydpi-v26'; os.makedirs(ad, exist_ok=True)
for f0 in os.listdir(ad): os.remove(f'{ad}/{f0}')
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
for n in ('ic_launcher.xml', 'ic_launcher_round.xml'): open(f'{ad}/{n}', 'w').write(xml)
print('Ikon dibuat')
