#!/bin/sh
# Rakit worker.js satu file: server + fitur + frontend + CSS Tailwind + ikon + QR lib + APK
set -e
cd "$(dirname "$0")"
npx tailwindcss -c tw.config.js -i build/in.css -o build/app.css --minify >/dev/null 2>&1
npx esbuild node_modules/qrcode-generator/qrcode.js --minify --log-level=error > build/qr.min.js
python3 - <<'PY'
import json,hashlib,base64
css=open('build/app.css').read()
ver=hashlib.sha1(css.encode()).hexdigest()[:8]
icons=open('build/icons.txt').read().replace('export const ','const ')
apk=base64.b64encode(open('../apk/JCOFFE-POS.apk','rb').read()).decode()
qr=open('build/qr.min.js').read()
out=(open('src/server.js').read()+'\n'+open('src/features.js').read()+'\n'+open('src/frontend.js').read()+'\n'+icons+
     '\nconst APP_CSS = '+json.dumps(css)+';\nconst QR_JS = '+json.dumps(qr)+';\nconst APK_B64 = '+json.dumps(apk)+';\n')
out=out.replace('// ================================================================ FRONTEND','const CSS_VER = '+json.dumps(ver)+';\n// ================================================================ FRONTEND',1)
open('worker.js','w').write(out)
print('worker.js', len(out), 'bytes,', out.count('\n'), 'lines')
PY
node --check worker.js
