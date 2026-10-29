# Membuat ikon launcher Android dari public/icons/icon-512.png
import os, sys
from PIL import Image
src = Image.open('public/icons/icon-512.png').convert('RGB')
res = 'android/app/src/main/res'
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, s in sizes.items():
    folder = f'{res}/mipmap-{d}'
    if not os.path.isdir(folder): continue
    im = src.resize((s, s), Image.LANCZOS)
    for n in ('ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'):
        im.save(f'{folder}/{n}')
# hapus ikon adaptif bawaan (XML) agar PNG dipakai
for d in ('mipmap-anydpi-v26',):
    p = f'{res}/{d}'
    if os.path.isdir(p):
        for f in os.listdir(p): os.remove(f'{p}/{f}')
        os.rmdir(p)
print('Ikon dibuat')
