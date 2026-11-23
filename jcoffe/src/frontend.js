// ================================================================ FRONTEND
// Catatan: kode client ditulis tanpa template literal agar aman di dalam String.raw.

function page(title, bodyHtml, script = '', opts = {}) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<title>${title} · JCOFFE POS</title>
${opts.head || ''}
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1c0f0a">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/icon-192.png">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">
<link rel="stylesheet" href="/app.css?v=${CSS_VER}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}
input,select,textarea{font-size:16px!important}
.pb-safe{padding-bottom:calc(env(safe-area-inset-bottom) + 8px)}
.coffee-bg{background:radial-gradient(circle at 30% 10%,#7a4a2a 0,#2a160d 45%,#120a06 100%)}
@keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(220,38,38,.7)}100%{box-shadow:0 0 0 22px rgba(220,38,38,0)}}
.ring-pulse{animation:pulseRing 1s infinite}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
.shake{animation:shake .4s infinite;display:inline-block}
#print-area{display:none}
@media print{body>*{display:none!important}#print-area{display:block!important}@page{margin:0}}
</style></head>
<body class="bg-stone-100 text-slate-800 min-h-screen">${bodyHtml}
<div id="print-area"></div>
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}</script>
${script ? '<script>' + COMMON_JS + (opts.print ? PRINT_JS : '') + script + '</script>' : ''}
</body></html>`;
}

const COMMON_JS = String.raw`
var IS_APK=(function(){var ua=/; wv\)/.test(navigator.userAgent);try{var m=location.search.match(/source=apk(?:&v=(\d+))?/);if(m){sessionStorage.setItem('apk','1');sessionStorage.setItem('apkv',m[1]||'1')}return ua||sessionStorage.getItem('apk')==='1'}catch(e){return ua}})();
var APK_V=(function(){try{return +(sessionStorage.getItem('apkv')||0)}catch(e){return 0}})();
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rp(n){return 'Rp '+Math.round(Number(n)||0).toLocaleString('id-ID')}
function fnum(n){return (Math.round((Number(n)||0)*100)/100).toLocaleString('id-ID')}
function dayStr(off){return new Date(Date.now()+8*3600000+(off||0)*86400000).toISOString().slice(0,10)}
function fmtDT(iso){if(!iso)return '-';return new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,16).replace('T',' ')}
function fmtD(iso){if(!iso)return '-';return new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,10)}
function ago(iso){var s=Math.max(0,(Date.now()-Date.parse(iso))/1000);if(s<60)return 'baru saja';if(s<3600)return Math.floor(s/60)+' mnt lalu';if(s<86400)return Math.floor(s/3600)+' jam lalu';return fmtDT(iso)}
async function api(path,method,body){
  var opt={method:method||'GET',credentials:'same-origin',headers:{}};
  if(body!==undefined){opt.headers['content-type']='application/json';opt.body=JSON.stringify(body)}
  var r=await fetch(path,opt);var d={};try{d=await r.json()}catch(e){}
  if(r.status===401){location.href='/';throw new Error(d.error||'Sesi habis')}
  if(r.status===402){location.reload();throw new Error(d.error||'Akses dihentikan')}
  if(!r.ok)throw new Error(d.error||('Error '+r.status));
  return d}
function toast(msg,isErr){var t=document.createElement('div');t.className='fixed left-1/2 -translate-x-1/2 bottom-28 z-[100] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold max-w-[90vw] text-center '+(isErr?'bg-red-600 text-white':'bg-slate-900 text-white');t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},3500)}
function openModal(title,bodyHtml,wide){closeModal();var w=document.createElement('div');w.id='modal';w.className='fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center';
  w.innerHTML='<div class="bg-white w-full '+(wide?'sm:max-w-2xl':'sm:max-w-lg')+' rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 pb-8"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-extrabold">'+esc(title)+'</h3><button data-close class="w-9 h-9 rounded-full bg-slate-100 text-xl leading-none">&times;</button></div><div id="mb">'+bodyHtml+'</div></div>';
  w.addEventListener('click',function(e){if(e.target===w||(e.target.hasAttribute&&e.target.hasAttribute('data-close')))closeModal()});
  document.body.appendChild(w);return w.querySelector('#mb')}
function closeModal(){var m=document.getElementById('modal');if(m)m.remove()}
async function guard(btn,fn){if(btn){if(btn.disabled)return;btn.disabled=true;btn.classList.add('opacity-60')}
  try{return await fn()}catch(e){toast(e.message,true)}finally{if(btn){btn.disabled=false;btn.classList.remove('opacity-60')}}}
function field(label,name,val,type,extra){return '<label class="block mb-3"><span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">'+esc(label)+'</span><input name="'+name+'" type="'+(type||'text')+'" value="'+esc(val==null?'':val)+'" '+(extra||'')+' class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"></label>'}
function selectField(label,name,opts,val){return '<label class="block mb-3"><span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">'+esc(label)+'</span><select name="'+name+'" class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white">'+opts.map(function(o){return '<option value="'+esc(o[0])+'" '+(String(o[0])===String(val)?'selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>'}
function formData(root){var o={};$$('input,select,textarea',root).forEach(function(el){if(!el.name)return;o[el.name]=el.type==='checkbox'?el.checked:el.value});return o}
var B='px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition ';
var BP=B+'bg-slate-900 text-white',BT=B+'bg-amber-700 text-white',BG=B+'bg-slate-100 text-slate-700',BR=B+'bg-red-50 text-red-600';
function loadScript(src,globalName){return new Promise(function(res,rej){if(window[globalName])return res();var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('Gagal memuat '+src))};document.head.appendChild(s)})}
function copyText(t,msg){function ok(){toast(msg||'Disalin')}function fb(){var a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(e){prompt('Salin manual:',t)}a.remove()}
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(ok,fb);else fb()}
function openExternal(url){if(IS_APK){location.href=url+(url.indexOf('?')>=0?'&':'?')+'ext=1'}else{window.open(url,'_blank')}}
function waOpen(url){if(IS_APK)location.href=url;else window.open(url,'_blank')}
function pwModal(force){var b=openModal(force?'Ganti password default':'Ganti password',(force?'<p class="text-sm bg-amber-50 text-amber-800 rounded-xl p-3 mb-3">Kamu masih memakai password sementara. Ganti sekarang demi keamanan.</p>':'')+field('Password lama','old_password','','password')+field('Password baru','new_password','','password')+field('Ulangi password baru','new_password2','','password')+'<button id="pwSave" class="'+BP+' w-full">Simpan</button>');
  $('#pwSave').onclick=function(){guard(this,async function(){var f=formData(b);if(f.new_password!==f.new_password2)throw new Error('Ulangi password tidak sama');await api('/api/password','POST',f);closeModal();toast('Password berhasil diganti')})}}
async function logout(){try{await api('/api/logout','POST',{})}catch(e){}location.href='/'}
var deferredInstall=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e});
function installApp(){if(deferredInstall){deferredInstall.prompt();deferredInstall=null}else{location.href='/promo'}}
function qrSvg(text,cell){if(!window.qrcode)return '';var q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag(cell||4,8)}
`;

// ---------------------------------------------------------------- modul cetak (struk, order dapur, ringkasan)
const PRINT_JS = String.raw`
var PRN=(function(){var d={mode:IS_APK?'rawbt':'browser',paper:58,copies:1,auto:false,kitchen:false,set:false};try{var s=JSON.parse(localStorage.getItem('jc_prn')||'{}');for(var k in s)d[k]=s[k]}catch(e){}return d})();
function prnSave(){try{localStorage.setItem('jc_prn',JSON.stringify(PRN))}catch(e){}}
var BLE_DEV=null;
function COLS(){return PRN.paper==80?48:32}
function ascii(s){return String(s==null?'':s).normalize('NFKD').replace(/[−–—]/g,'-').replace(/[^\x20-\x7E\n]/g,'')}
function padLR(l,r,w){w=w||COLS();l=ascii(l);r=ascii(r);var sp=w-l.length-r.length;return sp>=1?l+new Array(sp+1).join(' ')+r:l.slice(0,Math.max(0,w-r.length-1))+' '+r}
function center(s,w){w=w||COLS();s=ascii(s).slice(0,w);return new Array(Math.max(0,Math.floor((w-s.length)/2))+1).join(' ')+s}
function wrapT(s,w){w=w||COLS();var o=[],c='';ascii(s).split(' ').forEach(function(wd){if((c+' '+wd).trim().length>w){if(c)o.push(c);c=wd}else c=(c+' '+wd).trim()});if(c)o.push(c);return o}
function rpp(n){return Math.round(Number(n)||0).toLocaleString('id-ID')}
function HR(){return {t:new Array(COLS()+1).join('-')}}
function storeInfo(){return (window.S&&S.me&&S.me.store)||{}}
function receiptLines(t){
  var s=storeInfo(),L=[];
  L.push({t:s.name||'JCOFFE',c:1,b:1,big:1});
  if(s.address)wrapT(s.address).forEach(function(x){L.push({t:x,c:1})});
  if(s.phone&&s.phone!=='-')L.push({t:'Telp '+s.phone,c:1});
  L.push(HR(),{t:padLR(t.code||'',fmtDT(t.created_at))},{t:padLR('Kasir: '+(t.cashier||'-'),t.pay_method||'')});
  if(t.table_name)L.push({t:'Meja: '+t.table_name+(t.customer?' - '+t.customer:'')});
  L.push(HR());
  (t.items||[]).forEach(function(i){wrapT(i.name).forEach(function(x){L.push({t:x})});L.push({t:padLR('  '+i.qty+' x '+rpp(i.price),rpp(i.subtotal||i.price*i.qty))})});
  L.push(HR(),{t:padLR('Subtotal',rpp(t.subtotal))});
  if(t.discount)L.push({t:padLR('Diskon','-'+rpp(t.discount))});
  L.push({t:padLR('TOTAL',rpp(t.total)),b:1,big:PRN.paper==80?1:0});
  L.push({t:padLR('Bayar ('+(t.pay_method||'Tunai')+')',rpp(t.paid))});
  if(t.change_amt)L.push({t:padLR('Kembali',rpp(t.change_amt))});
  if(t.note)wrapT('Catatan: '+t.note).forEach(function(x){L.push({t:x})});
  L.push(HR());wrapT(s.receipt_note||'Terima kasih, datang lagi ya!').forEach(function(x){L.push({t:x,c:1})});
  L.push({t:'JCOFFE POS',c:1});
  return L}
function kitchenLines(o){
  var L=[{t:'ORDER DAPUR / BAR',c:1,b:1,big:1},{t:(o.table_name||'Kasir')+(o.customer?' - '+o.customer:''),c:1,b:1,big:1},{t:fmtDT(o.created_at||new Date().toISOString()),c:1},HR()];
  (o.items||[]).forEach(function(i){L.push({t:i.qty+'x  '+ascii(i.name),b:1,big:1})});
  if(o.note){L.push(HR());wrapT('Catatan: '+o.note).forEach(function(x){L.push({t:x,b:1})})}
  L.push(HR(),{t:'#'+(o.id||'')+' '+(o.code||''),c:1});return L}
function summaryLines(d){
  var s=d.summary,L=[{t:storeInfo().name||'JCOFFE',c:1,b:1,big:1},{t:'RINGKASAN PENJUALAN',c:1,b:1},{t:d.from+' s/d '+d.to,c:1},HR(),
    {t:padLR('Transaksi',String(s.n))},{t:padLR('Omzet',rpp(s.omzet)),b:1},{t:padLR('Diskon',rpp(s.disc))},{t:padLR('HPP',rpp(s.hpp))},{t:padLR('Laba kotor',rpp(s.omzet-s.hpp)),b:1},HR(),{t:'Metode bayar',b:1}];
  d.methods.forEach(function(m){L.push({t:padLR(m.m+' ('+m.n+')',rpp(m.omzet))})});
  L.push(HR(),{t:'Kasir',b:1});d.cashiers.forEach(function(c){L.push({t:padLR(c.c+' ('+c.n+')',rpp(c.omzet))})});
  L.push(HR(),{t:'Menu terlaris',b:1});d.top.slice(0,15).forEach(function(m){L.push({t:padLR(m.name,m.qty+'x')})});
  L.push(HR(),{t:'Dicetak '+fmtDT(new Date().toISOString()),c:1});return L}
function testLines(){return receiptLines({code:'TES-PRINT',created_at:new Date().toISOString(),cashier:'Kasir',pay_method:'Tunai',items:[{name:'Kopi Susu Gula Aren',qty:2,price:15000,subtotal:30000},{name:'Pisang Goreng',qty:1,price:10000,subtotal:10000}],subtotal:40000,discount:0,total:40000,paid:50000,change_amt:10000})}
function escpos(lines){var b=[0x1b,0x40,0x1b,0x74,0x00];lines.forEach(function(l){b.push(0x1b,0x61,l.c?1:0,0x1b,0x45,l.b?1:0,0x1d,0x21,l.big?0x11:0x00);var t=l.c&&!l.big?ascii(l.t).trim():ascii(l.t);for(var i=0;i<t.length;i++)b.push(t.charCodeAt(i)&0xff);b.push(0x0a)});b.push(0x1b,0x61,0,0x1d,0x21,0,0x1b,0x64,4,0x1d,0x56,0x42,0x00);return new Uint8Array(b)}
function u8b64(u){var s='';for(var i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}
function copiesOf(u){if(PRN.copies<=1)return u;var o=new Uint8Array(u.length*PRN.copies);for(var i=0;i<PRN.copies;i++)o.set(u,i*u.length);return o}
function linesText(L){return L.map(function(l){return l.c?center(l.t):ascii(l.t)}).join('\n')}
function linesHtml(L,paper){var w=paper==80?'72mm':'48mm';return '<div style="width:'+w+';margin:0 auto;font-family:monospace;font-size:'+(paper==80?'12px':'11px')+';line-height:1.35;color:#000;padding:4mm 0">'+L.map(function(l){return '<div style="white-space:pre;text-align:'+(l.c?'center':'left')+';font-weight:'+(l.b?'700':'400')+';font-size:'+(l.big?'1.35em':'1em')+'">'+esc(l.c?ascii(l.t).trim():ascii(l.t))+'</div>'}).join('')+'</div>'}
function browserPrint(L,paper){var a=$('#print-area');a.innerHTML='<style>@page{size:'+(paper==80?'80mm':'58mm')+' auto;margin:0}</style>'+linesHtml(L,paper);setTimeout(function(){window.print()},60)}
function a4Html(t){var s=storeInfo();return '<style>@page{size:A4;margin:14mm}</style><div style="font-family:Arial,sans-serif;color:#111;font-size:13px"><div style="display:flex;justify-content:space-between;border-bottom:3px solid #3b2316;padding-bottom:10px;margin-bottom:14px"><div><div style="font-size:22px;font-weight:800">'+esc(s.name||'')+'</div><div>'+esc(s.address||'')+'</div><div>'+esc(s.phone&&s.phone!=='-'?'Telp '+s.phone:'')+'</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:800">NOTA</div><div>'+esc(t.code)+'</div><div>'+fmtDT(t.created_at)+'</div><div>Kasir: '+esc(t.cashier||'-')+'</div></div></div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f3ece6"><th style="text-align:left;padding:6px">Item</th><th style="padding:6px">Qty</th><th style="text-align:right;padding:6px">Harga</th><th style="text-align:right;padding:6px">Subtotal</th></tr></thead><tbody>'+(t.items||[]).map(function(i){return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">'+esc(i.name)+'</td><td style="text-align:center">'+i.qty+'</td><td style="text-align:right">'+rp(i.price)+'</td><td style="text-align:right;padding:6px">'+rp(i.subtotal||i.price*i.qty)+'</td></tr>'}).join('')+'</tbody></table><div style="margin-left:auto;width:260px;margin-top:12px"><div style="display:flex;justify-content:space-between"><span>Subtotal</span><b>'+rp(t.subtotal)+'</b></div>'+(t.discount?'<div style="display:flex;justify-content:space-between"><span>Diskon</span><b>-'+rp(t.discount)+'</b></div>':'')+'<div style="display:flex;justify-content:space-between;font-size:17px;border-top:2px solid #111;margin-top:6px;padding-top:6px"><span>TOTAL</span><b>'+rp(t.total)+'</b></div><div style="display:flex;justify-content:space-between"><span>Bayar ('+esc(t.pay_method)+')</span><b>'+rp(t.paid)+'</b></div>'+(t.change_amt?'<div style="display:flex;justify-content:space-between"><span>Kembali</span><b>'+rp(t.change_amt)+'</b></div>':'')+'</div><p style="margin-top:30px;text-align:center;color:#555">'+esc(s.receipt_note||'Terima kasih')+'</p></div>'}
async function bleConnect(){
  if(!navigator.bluetooth)throw new Error('Bluetooth langsung hanya bisa di Google Chrome (bukan di dalam APK). Di APK pakai mode RawBT.');
  var dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:['000018f0-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2','49535343-fe7d-4ae5-8fa9-9fafd205e455','0000ff00-0000-1000-8000-00805f9b34fb','0000ffe0-0000-1000-8000-00805f9b34fb']});
  var srv=await dev.gatt.connect();var svcs=await srv.getPrimaryServices();var ch=null;
  for(var i=0;i<svcs.length&&!ch;i++){var cs=await svcs[i].getCharacteristics();for(var j=0;j<cs.length;j++){if(cs[j].properties.write||cs[j].properties.writeWithoutResponse){ch=cs[j];break}}}
  if(!ch)throw new Error('Printer tidak punya jalur tulis BLE. Pakai mode RawBT.');
  BLE_DEV={name:dev.name||'Printer BLE',ch:ch};PRN.bleName=BLE_DEV.name;prnSave();return BLE_DEV}
async function bleWrite(u8){if(!BLE_DEV)await bleConnect();for(var i=0;i<u8.length;i+=180){var part=u8.slice(i,i+180);if(BLE_DEV.ch.properties.writeWithoutResponse)await BLE_DEV.ch.writeValueWithoutResponse(part);else await BLE_DEV.ch.writeValue(part);await new Promise(function(r){setTimeout(r,25)})}}
function rawbtSend(u8){var url='rawbt:base64,'+u8b64(u8);if(IS_APK){location.href=url}else{var a=document.createElement('a');a.href=url;document.body.appendChild(a);a.click();a.remove()}}
async function printLines(L,how,opt){
  how=how||PRN.mode;opt=opt||{};
  try{
    if(how==='text'){var txt=linesText(L);if(navigator.share&&!IS_APK){try{await navigator.share({text:txt});return}catch(e){}}waOpen('https://wa.me/?text='+encodeURIComponent(txt));return}
    if(how==='browser'||how==='a4'){
      if(IS_APK){if(opt.trxId){var d=await api('/api/receipt-link/'+opt.trxId);openExternal(d.url+'?print='+(how==='a4'?'a4':PRN.paper));return}throw new Error('Di aplikasi Android, cetak ini lewat printer Bluetooth (mode RawBT). Atur di Lainnya → Printer.')}
      if(how==='a4'&&opt.trx){var a=$('#print-area');a.innerHTML=a4Html(opt.trx);setTimeout(function(){window.print()},60);return}
      browserPrint(L,PRN.paper);return}
    var data=copiesOf(escpos(L));
    if(how==='ble'){toast('Mencetak…');await bleWrite(data);toast('Tercetak ✓');return}
    rawbtSend(data)
  }catch(e){toast(e.message||'Gagal mencetak',true)}}
function printTrx(t,how){if(PRN.auto===undefined)PRN.auto=false;return printLines(receiptLines(t),how,{trxId:t.id,trx:t})}
function printKitchen(o,how){return printLines(kitchenLines(o),how)}
var PRN_MODES=[['rawbt','🧾','Thermal Bluetooth (RawBT)','Semua printer Bluetooth/USB · paling stabil di HP'],['ble','📡','Thermal BLE langsung','Hanya di Google Chrome, tanpa aplikasi tambahan'],['browser','🖨️','Printer PC / thermal USB','Dialog cetak browser (58/80 mm)'],['a4','📄','Nota A4','Printer tinta / laser'],['text','💬','Kirim teks / WhatsApp','Tanpa printer']];
function printMenu(t,isKitchen){
  var b=openModal('🖨️ Cetak '+(isKitchen?'order dapur':'struk'),'<div class="grid grid-cols-1 gap-2 mb-3">'+PRN_MODES.filter(function(m){return !(isKitchen&&m[0]==='a4')}).map(function(m){return '<button data-h="'+m[0]+'" class="text-left rounded-2xl border-2 p-3 flex items-center gap-3 '+(PRN.mode===m[0]?'border-amber-600 bg-amber-50':'border-slate-200')+'"><span class="text-2xl">'+m[1]+'</span><span><b class="block">'+m[2]+'</b><small class="text-slate-500">'+m[3]+'</small></span></button>'}).join('')+'</div><label class="flex items-center gap-2 text-sm font-semibold mb-3"><input type="checkbox" id="pdef" class="w-5 h-5" checked> Jadikan printer utama (langsung cetak berikutnya)</label><button id="pset" class="'+BG+' w-full">⚙️ Pengaturan printer & tes</button>');
  $$('[data-h]',b).forEach(function(x){x.onclick=function(){var h=x.dataset.h;if($('#pdef',b).checked&&h!=='text'){PRN.mode=h;PRN.set=true;prnSave()}closeModal();if(isKitchen)printKitchen(t,h);else printTrx(t,h)}});
  $('#pset',b).onclick=function(){closeModal();if(window.go)go('printer')}}
function quickPrint(t,isKitchen){if(!PRN.set)return printMenu(t,isKitchen);if(isKitchen)printKitchen(t);else printTrx(t)}
`;

// ---------------------------------------------------------------- login & daftar
const AUTH_BG = `<div class="fixed inset-0 -z-10 coffee-bg"><div class="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl"></div><div class="absolute bottom-0 right-0 w-96 h-96 bg-orange-700/30 rounded-full blur-3xl"></div></div>`;
const LOGO = `<div class="mx-auto w-28 h-28 mb-4 drop-shadow-xl"><img src="/logo.png" class="w-full h-full" alt="JCOFFE"></div>`;

const LOGIN_HTML = page('Login', `${AUTH_BG}
<div class="min-h-screen flex items-center justify-center p-5">
 <form id="f" class="w-full max-w-sm bg-white/95 backdrop-blur rounded-[2rem] shadow-2xl px-7 py-8 border-t-4 border-amber-600">
  ${LOGO}
  <h1 class="text-3xl font-extrabold text-center text-slate-900 tracking-tight">Portal Login</h1>
  <p class="text-center text-xs font-bold tracking-[0.25em] text-amber-800 mt-1 mb-6">JCOFFE · POS SYSTEM</p>
  <div id="err" class="hidden mb-4 bg-red-50 border border-red-200 text-red-600 font-bold text-center rounded-2xl py-3 px-3"></div>
  <label class="block text-xs font-bold tracking-widest text-slate-500 mb-1">USERNAME / ID</label>
  <input name="username" autocomplete="username" autocapitalize="none" required class="w-full border border-slate-200 rounded-2xl px-4 py-3.5 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500">
  <label class="block text-xs font-bold tracking-widest text-slate-500 mb-1">PASSWORD</label>
  <div class="relative mb-6"><input id="pw" name="password" type="password" autocomplete="current-password" required class="w-full border border-slate-200 rounded-2xl px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500">
   <button type="button" id="eye" class="absolute right-3 top-1/2 -translate-y-1/2 text-xl opacity-60">👁️</button></div>
  <button id="btn" class="w-full bg-slate-900 text-white rounded-2xl py-4 font-extrabold tracking-widest">MASUK SISTEM</button>
  <div class="flex items-center gap-3 my-4 text-xs font-bold text-slate-400"><div class="flex-1 h-px bg-slate-200"></div>ATAU<div class="flex-1 h-px bg-slate-200"></div></div>
  <button type="button" id="demo" class="w-full bg-amber-400 text-slate-900 rounded-2xl py-3.5 font-extrabold tracking-wider">🎮 COBA TOKO DEMO</button>
  <p class="text-center text-xs text-slate-400 mt-1.5">Langsung masuk dengan data contoh, tanpa daftar</p>
  <p class="text-center text-sm text-slate-500 mt-5 font-semibold">Baru di JCOFFE? <a href="/daftar" class="text-amber-700 font-extrabold tracking-wider">DAFTAR</a></p>
  <p class="text-center text-xs text-slate-400 mt-1">Gratis trial 14 hari · <a id="dl" href="/promo" class="underline">Unduh aplikasi Android</a></p>
 </form>
</div>`, String.raw`
if(IS_APK)$('#dl').parentNode.innerHTML='Gratis trial 14 hari';
$('#eye').onclick=function(){var p=$('#pw');p.type=p.type==='password'?'text':'password'};
$('#demo').onclick=function(){var b=this;guard(b,async function(){b.textContent='Menyiapkan toko demo…';try{var d=await api('/api/demo','POST',{});location.href=d.redirect}catch(err){b.textContent='🎮 COBA TOKO DEMO';$('#err').textContent=err.message;$('#err').classList.remove('hidden')}})};
$('#f').addEventListener('submit',function(e){e.preventDefault();var btn=$('#btn');guard(btn,async function(){
  $('#err').classList.add('hidden');
  try{var d=await api('/api/login','POST',formData($('#f')));location.href=d.redirect}
  catch(err){$('#err').textContent=err.message;$('#err').classList.remove('hidden')}})});
`);

const REGISTER_HTML = page('Daftar', `${AUTH_BG}
<div class="min-h-screen flex items-center justify-center p-5">
 <form id="f" class="w-full max-w-sm bg-white/95 rounded-[2rem] shadow-2xl px-7 py-8 border-t-4 border-amber-600">
  ${LOGO}
  <h1 class="text-2xl font-extrabold text-center text-slate-900">Daftar Toko Baru</h1>
  <p class="text-center text-sm text-amber-800 font-bold mt-1 mb-5">🎁 Gratis trial 14 hari, tanpa kartu kredit</p>
  <div id="err" class="hidden mb-4 bg-red-50 border border-red-200 text-red-600 font-bold text-center rounded-2xl py-3 px-3 text-sm"></div>
  <div id="fields"></div>
  <button id="btn" class="w-full bg-amber-700 text-white rounded-2xl py-4 font-extrabold tracking-widest mt-2">MULAI TRIAL</button>
  <p class="text-center text-sm text-slate-500 mt-5 font-semibold">Sudah punya akun? <a href="/" class="text-amber-700 font-extrabold">MASUK</a></p>
 </form>
</div>`, String.raw`
$('#fields').innerHTML=field('Nama toko / usaha','store_name','','text','required placeholder="JCOFFE Cabang 1"')+field('Nama pemilik','owner_name','','text','required')+field('No. WhatsApp','phone','','tel','required placeholder="08xxxxxxxxxx"')+field('Username (untuk login)','username','','text','required autocapitalize="none" placeholder="huruf kecil tanpa spasi"')+field('Password (min 6)','password','','password','required')+'<details id="snd" class="mb-3 bg-amber-50 rounded-2xl px-3 py-2"><summary class="text-sm font-bold text-amber-800 cursor-pointer">🔑 Punya serial number lisensi? (opsional)</summary><div class="pt-2">'+field('Serial number','sn','','text','autocapitalize="characters" autocomplete="off" placeholder="JCF-XXXX-XXXX-XXXX"')+'</div></details>';
(function(){var q=new URLSearchParams(location.search).get('sn');if(q){$('[name=sn]').value=q;$('#snd').open=true}})();
$('#f').addEventListener('submit',function(e){e.preventDefault();guard($('#btn'),async function(){
  $('#err').classList.add('hidden');
  try{var d=await api('/api/register','POST',formData($('#f')));location.href=d.redirect}
  catch(err){$('#err').textContent=err.message;$('#err').classList.remove('hidden');window.scrollTo(0,0)}})});
`);

// ---------------------------------------------------------------- APP (owner, om, admin, spv, kasir)
const APP_HTML = page('Kasir', `<div id="root"><div class="min-h-screen flex items-center justify-center text-slate-400">Memuat…</div></div>`, String.raw`
var S={me:null,menu:[],stock:[],promos:[],cart:{},orderId:null,tab:'kasir',cat:'Semua',q:'',loaded:false};
function can(p){return S.me.perms.indexOf(p)>=0}
function isOwner(){return S.me.user.role==='owner'}
function isMgr(){return ['owner','om','admin'].indexOf(S.me.user.role)>=0}
function waAdmin(text){return 'https://wa.me/'+S.me.admin_wa+'?text='+encodeURIComponent(text)}
function licenseModal(prefill){
  if(S.me.access.label==='demo'){toast('Daftar toko dulu untuk aktivasi lisensi');return}
  if(!isMgr()){toast('Minta owner/admin untuk aktivasi lisensi');return}
  var a=S.me.access,lim=S.me.limited;
  var st=lim?'<span class="text-red-600 font-extrabold">Masa aktif habis</span> — hanya transaksi yang aktif':a.label==='trial'?'Trial gratis, sisa <b>'+a.daysLeft+' hari</b>':'Lisensi aktif, sisa <b>'+a.daysLeft+' hari</b>';
  var b=openModal('🔑 Lisensi JCOFFE','<div class="bg-slate-50 rounded-2xl p-3 text-sm mb-4">'+st+(a.end?'<div class="text-xs text-slate-500 mt-1">Berakhir '+fmtD(new Date(a.end).toISOString())+'</div>':'')+'</div>'+
   '<label class="block mb-2"><span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Serial number</span><input id="sn" value="'+esc(prefill||'')+'" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="JCF-XXXX-XXXX-XXXX" class="mt-1 w-full border-2 border-amber-300 rounded-xl px-3 py-3 font-mono text-lg tracking-wider uppercase text-center"></label>'+
   '<p class="text-xs text-slate-500 mb-3">Masa lisensi ditambahkan ke sisa trial/langganan, tidak ada hari yang hangus.</p>'+
   '<button id="act" class="'+BP+' w-full mb-4">Aktifkan lisensi</button>'+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Belum punya serial number?</div>'+
   (S.me.lynk_url?'<button id="buy" class="w-full bg-[#1c0f0a] text-amber-300 rounded-xl py-3 font-extrabold mb-2">🛒 Beli lisensi 3 bulan</button><button id="klm" class="w-full bg-white border rounded-xl py-2.5 font-bold text-sm mb-2">📩 Sudah beli? Ambil SN di sini</button>':'')+
   '<button id="ask" class="w-full bg-green-600 text-white rounded-xl py-3 font-bold">💬 Chat Head Admin'+(a.label==='trial'&&!lim?' (minta perpanjang trial)':'')+'</button><div id="lh" class="mt-4"></div>');
  var inp=$('#sn',b);
  inp.oninput=function(){var v=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(v.indexOf('JCF')===0)v=v.slice(3);v=v.slice(0,12);this.value=v?'JCF-'+v.match(/.{1,4}/g).join('-'):''};
  if(prefill)inp.oninput.call(inp);
  $('#act',b).onclick=function(){if(inp.value.replace(/[^A-Z0-9]/g,'').length<15){toast('Lengkapi serial number',true);inp.focus();return}
    guard(this,async function(){var d=await api('/api/license/activate','POST',{code:inp.value});closeModal();S.me=await api('/api/me');renderShell();go(S.tab||'kasir');
     openModal('🎉 Lisensi aktif','<div class="text-center"><div class="text-6xl mb-2">✅</div><p class="font-extrabold text-lg">'+esc(d.note)+'</p><p class="text-sm text-slate-500 mt-2">Semua fitur JCOFFE sudah terbuka. Terima kasih!</p></div>')})};
  if($('#buy',b))$('#buy',b).onclick=function(){openExternal(S.me.lynk_url)};
  if($('#klm',b))$('#klm',b).onclick=function(){openExternal(location.origin+'/klaim')};
  $('#ask',b).onclick=askExtend;
  api('/api/license').then(function(d){if(d.history.length)$('#lh',b).innerHTML='<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Riwayat aktivasi</div>'+d.history.map(function(h){return '<div class="flex justify-between text-xs py-1.5 border-b last:border-0"><span class="font-mono">'+esc(h.code)+'</span><span class="text-slate-500">'+h.days+' hr · '+fmtD(h.used_at)+'</span></div>'}).join('')}).catch(function(){});
}
function askExtend(){waOpen(waAdmin('Halo Head Admin JCOFFE, saya ingin memperpanjang masa '+(S.me.access.label==='trial'?'trial':'langganan')+' untuk toko "'+S.me.store.name+'" (username: '+S.me.user.username+'). Mohon dibantu, terima kasih.'))}

async function init(){
  try{S.me=await api('/api/me')}catch(e){return}
  var a=S.me.access;
  if(!a.ok&&!S.me.limited){renderExpired();return}
  renderShell();
  if(S.me.user.must_change)setTimeout(function(){pwModal(true)},400);
  go(can('kasir')?'kasir':can('pesanan')?'pesanan':'trx');
  if(can('pesanan'))startOrderWatch();
  checkUpdate();
  var qs=new URLSearchParams(location.search);
  if(qs.get('sn_ok')){openModal('🎉 Lisensi aktif','<div class="text-center"><div class="text-6xl mb-2">✅</div><p class="font-extrabold">Toko kamu sudah aktif sampai '+fmtD(new Date(S.me.access.end).toISOString())+'.</p></div>')}
  else if(qs.get('snerr')){toast(qs.get('snerr'),true);setTimeout(function(){licenseModal()},300)}
  else if(qs.get('sn'))setTimeout(function(){licenseModal(qs.get('sn'))},300);
  if(qs.toString())history.replaceState(null,'','/app');
}

function renderExpired(){
  var a=S.me.access;
  $('#root').innerHTML='<div class="min-h-screen flex items-center justify-center p-6 coffee-bg"><div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">'+
  '<div class="text-5xl mb-3">'+(a.label==='diblokir'?'🔒':'⏰')+'</div>'+
  '<h1 class="text-2xl font-extrabold mb-2">'+(a.label==='diblokir'?'Akun toko diblokir':'Masa demo telah habis')+'</h1>'+
  '<p class="text-slate-500 mb-4">Toko <b>'+esc(S.me.store.name)+'</b>. Hubungi Head Admin untuk bantuan.</p>'+
  '<a href="'+esc(waAdmin('Halo Head Admin JCOFFE, toko "'+S.me.store.name+'" ('+S.me.user.username+') tidak bisa diakses. Mohon dibantu.'))+'" class="block bg-green-600 text-white rounded-2xl py-3.5 font-bold mb-3">💬 Chat Head Admin via WhatsApp</a>'+
  '<button onclick="logout()" class="'+BG+' w-full">Keluar</button></div></div>';
}

function navItems(){var n=[];if(can('kasir'))n.push(['kasir','Kasir','🛒']);if(can('pesanan'))n.push(['pesanan','Pesanan','🛎️']);n.push(['trx','Transaksi','🧾']);if(can('laporan'))n.push(['laporan','Laporan','📊']);if(can('menu'))n.push(['menu','Menu','☕']);if(can('stok')||can('stok_adjust'))n.push(['stok','Stok','📦']);n.push(['lainnya','Lainnya','⚙️']);return n}

function renderShell(){
  var a=S.me.access,lim=S.me.limited;
  var badge=a.label==='demo'?'<span class="text-[11px] font-extrabold bg-amber-400 text-slate-900 rounded-full px-2.5 py-1">DEMO</span>':lim?'<button id="bdg" class="text-[11px] font-extrabold bg-red-500 text-white rounded-full px-2.5 py-1">Habis · Aktivasi ⟶</button>':a.label==='trial'?'<button id="bdg" class="text-[11px] font-bold bg-amber-400 text-slate-900 rounded-full px-2.5 py-1">Trial '+a.daysLeft+' hari ⟶</button>':'<button id="bdg" class="text-[11px] font-bold bg-emerald-500 text-white rounded-full px-2.5 py-1">Aktif '+a.daysLeft+' hari</button>';
  $('#root').innerHTML='<header class="sticky top-0 z-30 bg-[#1c0f0a] text-white px-4 py-3 flex items-center gap-3 shadow">'+
    '<img src="/icon-192.png" class="w-9 h-9 rounded-xl"><div class="flex-1 min-w-0"><div class="font-extrabold truncate">'+esc(S.me.store.name)+'</div><div class="text-[11px] text-amber-200/70 truncate">'+esc(S.me.user.name||S.me.user.username)+' · '+esc(S.me.user.role_label)+'</div></div>'+badge+'</header>'+
    (a.label==='demo'?'<div class="bg-amber-100 text-amber-900 text-sm px-4 py-2.5 flex items-center gap-2"><span class="flex-1">🎮 <b>Mode demo</b> — data contoh, terhapus otomatis dalam 24 jam.</span><a href="/daftar" class="shrink-0 bg-slate-900 text-white font-bold text-xs rounded-lg px-3 py-2">Daftar gratis</a></div>':'')+
    (lim?'<div class="bg-red-600 text-white text-sm px-4 py-2.5 flex items-center gap-2"><span class="flex-1">⏰ <b>Masa aktif habis.</b> Kamu tetap bisa bertransaksi, fitur lain terkunci.</span><button id="ext2" class="shrink-0 bg-white text-red-700 font-bold text-xs rounded-lg px-3 py-2">🔑 Aktivasi</button></div>':'')+
    '<div id="sndBar" class="hidden bg-slate-800 text-amber-200 text-xs px-4 py-2 text-center">🔔 Ketuk di mana saja untuk mengaktifkan <b>suara notifikasi pesanan</b></div>'+
    '<div id="updBar"></div>'+
    '<main id="view" class="max-w-6xl mx-auto p-4 pb-40"></main>'+
    '<button id="chatFab" title="Chat Head Admin" class="fixed right-4 bottom-24 z-30 w-14 h-14 rounded-full bg-green-600 text-white text-2xl shadow-xl flex items-center justify-center">💬</button>'+
    '<nav class="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-safe"><div class="max-w-2xl mx-auto flex">'+
    navItems().map(function(n){return '<button data-tab="'+n[0]+'" class="nav relative flex-1 pt-2 pb-1 flex flex-col items-center text-[10px] font-bold text-slate-400"><span class="text-xl leading-6">'+n[2]+'</span>'+n[1]+(n[0]==='pesanan'?'<span id="ordBadge" class="hidden absolute top-1 right-1/4 bg-red-600 text-white text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"></span>':'')+'</button>'}).join('')+
    '</div></nav>';
  $$('.nav').forEach(function(b){b.onclick=function(){go(b.dataset.tab)}});
  if($('#bdg'))$('#bdg').onclick=function(){licenseModal()};
  if($('#ext2'))$('#ext2').onclick=function(){licenseModal()};
  $('#chatFab').onclick=supportModal;
}

var VIEWS={};
function go(tab){
  S.tab=tab;
  var sub={promo:1,users:1,profil:1,telegram:1,meja:1,roles:1,printer:1};
  $$('.nav').forEach(function(b){var on=b.dataset.tab===tab||(b.dataset.tab==='lainnya'&&sub[tab]);b.classList.toggle('text-amber-700',!!on);b.classList.toggle('text-slate-400',!on)});
  window.scrollTo(0,0);
  if(tab==='pesanan')stopAlarm();
  var v=$('#view');v.innerHTML='<div class="text-center text-slate-400 py-10">Memuat…</div>';
  Promise.resolve(VIEWS[tab](v)).catch(function(e){v.innerHTML='<div class="bg-red-50 text-red-600 rounded-2xl p-4">'+esc(e.message)+'</div>'});
}
function backBtn(){return '<button onclick="go(\'lainnya\')" class="mb-3 text-sm font-bold text-slate-500">← Kembali</button>'}

// ---------------- suara & notifikasi pesanan QR
var AC=null,alarmTimer=null,alarmStop=null,lastOrderId=null;
function audioUnlock(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){}setTimeout(sndBar,200)}
document.addEventListener('pointerdown',audioUnlock,true);
function sndBar(){var b=$('#sndBar');if(!b)return;b.classList.toggle('hidden',!(can('pesanan')&&(!AC||AC.state!=='running')))}
function beep(t0,f,d){var o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain();o.type='square';o2.type='sawtooth';o.frequency.setValueAtTime(f,t0);o2.frequency.setValueAtTime(f*1.5,t0);g.gain.setValueAtTime(1,t0);g.gain.setValueAtTime(0.0001,t0+d);o.connect(g);o2.connect(g);g.connect(AC.destination);o.start(t0);o2.start(t0);o.stop(t0+d+0.03);o2.stop(t0+d+0.03)}
function alarmOnce(){if(!AC)return;try{if(AC.state==='suspended')AC.resume();var t=AC.currentTime+0.03;for(var i=0;i<8;i++)beep(t+i*0.22,i%2?1900:1400,0.18)}catch(e){}if(navigator.vibrate)navigator.vibrate([400,150,400,150,400])}
function startAlarm(info){
  stopAlarm();alarmOnce();alarmTimer=setInterval(alarmOnce,2200);alarmStop=setTimeout(stopAlarm,180000);
  try{if(window.speechSynthesis&&info){var u=new SpeechSynthesisUtterance('Pesanan baru, '+(info.table_name||''));u.lang='id-ID';u.volume=1;speechSynthesis.speak(u)}}catch(e){}
  var ov=document.createElement('div');ov.id='alarmOv';ov.className='fixed inset-0 z-[90] bg-red-700/95 text-white flex flex-col items-center justify-center p-6 text-center';
  ov.innerHTML='<div class="text-7xl mb-4 shake">🛎️</div><div class="text-3xl font-extrabold">PESANAN BARU!</div><div class="text-xl mt-2 font-bold">'+esc(info?info.table_name:'')+(info&&info.customer?' · '+esc(info.customer):'')+'</div>'+(info?'<div class="text-lg mt-1">'+rp(info.total)+'</div>':'')+'<button id="ovGo" class="mt-8 bg-white text-red-700 font-extrabold rounded-2xl px-8 py-4 text-lg ring-pulse">LIHAT PESANAN</button><button id="ovMute" class="mt-4 text-white/80 underline">Matikan suara</button>';
  document.body.appendChild(ov);$('#ovGo').onclick=function(){stopAlarm();go('pesanan')};$('#ovMute').onclick=stopAlarm}
function stopAlarm(){if(alarmTimer)clearInterval(alarmTimer);if(alarmStop)clearTimeout(alarmStop);alarmTimer=null;var o=$('#alarmOv');if(o)o.remove();try{if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}}
async function pollOrders(){try{var r=await fetch('/api/orders/poll',{credentials:'same-origin'});if(!r.ok)return;var d=await r.json();var bd=$('#ordBadge');if(bd){bd.textContent=d.pending;bd.classList.toggle('hidden',!d.pending);bd.classList.toggle('flex',!!d.pending)}
  if(lastOrderId===null){lastOrderId=d.max_id;if(d.pending>0&&S.tab!=='pesanan')startAlarm(d.latest);return}
  if(d.max_id>lastOrderId){lastOrderId=d.max_id;startAlarm(d.latest);if(S.tab==='pesanan')VIEWS.pesanan($('#view'))}}catch(e){}}
function startOrderWatch(){sndBar();pollOrders();setInterval(pollOrders,6000)}

// ---------------- update aplikasi (APK)
function checkUpdate(){if(!IS_APK||!S.me.apk)return;var cur=APK_V||1;if(cur>=S.me.apk.version)return;
  $('#updBar').innerHTML='<div class="bg-blue-600 text-white text-sm px-4 py-2.5 flex items-center gap-2"><span class="flex-1">⬆️ <b>Versi baru aplikasi tersedia</b> (v'+S.me.apk.version+')</span><button id="updBtn" class="shrink-0 bg-white text-blue-700 font-bold text-xs rounded-lg px-3 py-2">Update</button></div>';
  $('#updBtn').onclick=updateModal}
function updateModal(){var a=S.me.apk,cur=IS_APK?(APK_V||1):null;openModal('⬆️ Update aplikasi','<div class="text-center mb-4"><img src="/logo.png" class="w-20 h-20 mx-auto mb-2"><div class="font-extrabold text-lg">JCOFFE POS v'+a.version+'</div>'+(cur?'<div class="text-sm text-slate-500">Versi terpasang: v'+cur+'</div>':'')+'</div><p class="text-sm bg-slate-50 rounded-xl p-3 mb-4">'+esc(a.notes)+'</p><ol class="text-sm text-slate-600 list-decimal pl-5 mb-4 space-y-1"><li>Tap <b>Unduh APK</b> — file terunduh lewat browser.</li><li>Buka file <b>JCOFFE-POS.apk</b> → <b>Instal / Perbarui</b>.</li><li>Data & akun tetap aman (tersimpan di server).</li></ol><a id="updGo" href="'+esc(a.url)+'" class="block text-center '+BT+' py-3.5">⬇️ Unduh APK v'+a.version+'</a>');
  $('#updGo').onclick=function(e){e.preventDefault();waOpen(a.url)}}

// ---------------- chat / keluhan ke Head Admin
function supportModal(){
  var b=openModal('💬 Chat Head Admin','<p class="text-sm text-slate-500 mb-3">Sampaikan keluhan, saran, atau permintaan. Pesan dicatat dan langsung dibuka di WhatsApp Head Admin.</p>'+
   selectField('Kategori','category',[['Keluhan','Keluhan'],['Bantuan teknis','Bantuan teknis'],['Perpanjang trial / langganan','Perpanjang trial / langganan'],['Saran fitur','Saran fitur'],['Lainnya','Lainnya']],S.me.limited||S.me.access.label==='trial'?'Perpanjang trial / langganan':'Keluhan')+
   '<label class="block mb-3"><span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pesan</span><textarea name="message" rows="4" class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" placeholder="Tulis pesanmu…"></textarea></label>'+
   '<button id="sup" class="'+B+' bg-green-600 text-white w-full py-3.5">Kirim ke WhatsApp Head Admin</button><a id="wadirect" href="#" class="block text-center text-sm text-green-700 font-bold mt-3">atau langsung chat WA tanpa formulir →</a>');
  $('#sup').onclick=function(){guard(this,async function(){var d=await api('/api/support','POST',formData(b));closeModal();toast('Pesan tercatat, membuka WhatsApp…');waOpen(d.wa_link)})};
  $('#wadirect').onclick=function(e){e.preventDefault();waOpen(waAdmin('Halo Head Admin JCOFFE, saya dari toko "'+S.me.store.name+'".'))}}

// ---------------- KASIR
async function loadMenu(force){if(S.loaded&&!force)return;var r=await Promise.all([api('/api/menu'),api('/api/promos').catch(function(){return {promos:[]}})]);S.menu=r[0].menu;S.promos=r[1].promos.filter(function(p){return p.active});S.loaded=true}
VIEWS.kasir=async function(v){
  await loadMenu();
  var cats=['Semua'].concat(Array.from(new Set(S.menu.filter(function(m){return m.active}).map(function(m){return m.category||'Lainnya'}))));
  if(cats.indexOf(S.cat)<0)S.cat='Semua';
  v.innerHTML='<div class="lg:grid lg:grid-cols-[1fr_360px] lg:gap-5">'+
   '<div>'+(S.orderId?'<div class="bg-amber-100 text-amber-900 rounded-2xl px-4 py-3 mb-3 text-sm font-semibold flex items-center gap-2"><span class="flex-1">🛎️ Memproses pesanan meja #'+S.orderId+'</span><button id="cancelOrd" class="text-xs underline">batal</button></div>':'')+'<div class="flex gap-2 mb-3"><input id="q" placeholder="🔍 Cari menu…" value="'+esc(S.q)+'" class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 bg-white"><button id="reload" class="'+BG+'">↻</button></div>'+
   '<div class="flex gap-2 overflow-x-auto no-scrollbar mb-3">'+cats.map(function(c){return '<button data-cat="'+esc(c)+'" class="cat whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold '+(c===S.cat?'bg-slate-900 text-white':'bg-white text-slate-600')+'">'+esc(c)+'</button>'}).join('')+'</div>'+
   '<div id="grid" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3"></div></div>'+
   '<aside class="hidden lg:block"><div class="sticky top-20 bg-white rounded-3xl p-4 shadow-sm" id="cartPanel"></div></aside></div>'+
   '<div id="cartBar" class="lg:hidden fixed inset-x-0 bottom-[68px] z-20 px-3 pr-20"></div>';
  $('#q').oninput=function(){S.q=this.value;renderGrid()};
  $('#reload').onclick=function(){guard(this,async function(){await loadMenu(true);VIEWS.kasir(v)})};
  if($('#cancelOrd'))$('#cancelOrd').onclick=function(){S.orderId=null;S.cart={};VIEWS.kasir(v)};
  $$('.cat').forEach(function(b){b.onclick=function(){S.cat=b.dataset.cat;VIEWS.kasir(v)}});
  renderGrid();renderCart();
};
function renderGrid(){
  var g=$('#grid');if(!g)return;
  var list=S.menu.filter(function(m){return m.active&&(S.cat==='Semua'||(m.category||'Lainnya')===S.cat)&&(!S.q||m.name.toLowerCase().indexOf(S.q.toLowerCase())>=0)});
  if(!S.menu.length){g.innerHTML='<div class="col-span-full bg-white rounded-3xl p-6 text-center text-slate-500">Belum ada menu.'+(can('menu')?' <button onclick="go(\'menu\')" class="text-amber-700 font-bold">Tambah menu dulu →</button>':' Minta owner/admin menambahkan menu.')+'</div>';return}
  if(!list.length){g.innerHTML='<div class="col-span-full text-center text-slate-400 py-8">Menu tidak ditemukan</div>';return}
  var colors=['bg-amber-100 text-amber-800','bg-orange-100 text-orange-800','bg-stone-200 text-stone-800','bg-rose-100 text-rose-700','bg-emerald-100 text-emerald-700','bg-sky-100 text-sky-700'];
  g.innerHTML=list.map(function(m){var q=S.cart[m.id]||0;var c=colors[m.name.charCodeAt(0)%colors.length];
    return '<button data-id="'+m.id+'" class="mi relative bg-white rounded-2xl p-3 text-left shadow-sm active:scale-95 transition border-2 '+(q?'border-amber-600':'border-transparent')+'">'+
    (q?'<span class="absolute top-2 right-2 bg-amber-700 text-white text-xs font-extrabold rounded-full w-6 h-6 flex items-center justify-center">'+q+'</span>':'')+
    '<div class="w-11 h-11 rounded-xl '+c+' flex items-center justify-center font-extrabold text-lg mb-2">'+esc(m.name.charAt(0).toUpperCase())+'</div>'+
    '<div class="font-bold text-sm leading-tight line-clamp-2 min-h-[2.5em]">'+esc(m.name)+'</div><div class="text-amber-800 font-extrabold text-sm mt-1">'+rp(m.price)+'</div></button>'}).join('');
  $$('.mi').forEach(function(b){b.onclick=function(){var id=b.dataset.id;S.cart[id]=(S.cart[id]||0)+1;renderGrid();renderCart()}});
}
function cartLines(){return Object.keys(S.cart).map(function(id){var m=S.menu.find(function(x){return String(x.id)===id});return m?{m:m,qty:S.cart[id]}:null}).filter(Boolean)}
function cartTotal(){return cartLines().reduce(function(a,l){return a+l.m.price*l.qty},0)}
function cartCount(){return cartLines().reduce(function(a,l){return a+l.qty},0)}
function cartHtml(){
  var lines=cartLines();
  if(!lines.length)return '<div class="text-center text-slate-400 py-8">🛒 Keranjang kosong<br><span class="text-xs">Tap menu untuk menambah</span></div>';
  return '<div class="space-y-2 mb-3">'+lines.map(function(l){return '<div class="flex items-center gap-2"><div class="flex-1 min-w-0"><div class="font-bold text-sm truncate">'+esc(l.m.name)+'</div><div class="text-xs text-slate-500">'+rp(l.m.price)+' × '+l.qty+' = <b>'+rp(l.m.price*l.qty)+'</b></div></div>'+
   '<button data-d="-1" data-id="'+l.m.id+'" class="cq w-8 h-8 rounded-lg bg-slate-100 font-extrabold">−</button><span class="w-6 text-center font-bold">'+l.qty+'</span><button data-d="1" data-id="'+l.m.id+'" class="cq w-8 h-8 rounded-lg bg-slate-100 font-extrabold">+</button></div>'}).join('')+'</div>'+
   '<div class="flex justify-between items-center border-t pt-3 mb-3"><span class="font-bold text-slate-500">Total</span><span class="text-xl font-extrabold">'+rp(cartTotal())+'</span></div>'+
   '<div class="flex gap-2"><button class="clr '+BR+'">Hapus</button><button class="pay '+BT+' flex-1 py-3">BAYAR</button></div>';
}
function bindCart(root){
  $$('.cq',root).forEach(function(b){b.onclick=function(){var id=b.dataset.id;S.cart[id]=(S.cart[id]||0)+Number(b.dataset.d);if(S.cart[id]<=0)delete S.cart[id];renderGrid();renderCart();if($('#mb')&&$('#mb').dataset.cart){openCartSheet()}}});
  $$('.clr',root).forEach(function(b){b.onclick=function(){if(confirm('Kosongkan keranjang?')){S.cart={};S.orderId=null;closeModal();renderGrid();renderCart()}}});
  $$('.pay',root).forEach(function(b){b.onclick=payModal});
}
function renderCart(){
  var p=$('#cartPanel');if(p){p.innerHTML='<h3 class="font-extrabold mb-3">Pesanan</h3>'+cartHtml();bindCart(p)}
  var bar=$('#cartBar');if(bar){var n=cartCount();bar.innerHTML=n?'<button id="openCart" class="w-full max-w-xl mx-auto flex items-center justify-between bg-slate-900 text-white rounded-2xl px-5 py-4 shadow-2xl"><span class="font-bold">🛒 '+n+' item</span><span class="font-extrabold">'+rp(cartTotal())+' →</span></button>':'';
    var o=$('#openCart');if(o)o.onclick=openCartSheet}
}
function openCartSheet(){var b=openModal('Pesanan',cartHtml());b.dataset.cart='1';bindCart(b);if(!cartLines().length)closeModal()}

function payModal(){
  var sub=cartTotal();if(!sub)return;
  var b=openModal('Pembayaran',
   '<div class="flex justify-between mb-3"><span class="text-slate-500 font-bold">Subtotal</span><b>'+rp(sub)+'</b></div>'+
   (S.promos.length?selectField('Promo','promo_id',[['','— Tanpa promo —']].concat(S.promos.map(function(p){return [p.id,p.name+' ('+(p.type==='percent'?p.value+'%':rp(p.value))+')']})),''):'')+
   field('Diskon manual (Rp)','discount','0','number','inputmode="numeric" min="0"')+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Metode bayar</div><div class="grid grid-cols-4 gap-2 mb-3">'+['Tunai','QRIS','Transfer','Debit'].map(function(m,i){return '<button type="button" data-m="'+m+'" class="pm py-2.5 rounded-xl text-sm font-bold border-2 '+(i===0?'border-amber-600 bg-amber-50 text-amber-800':'border-slate-200')+'">'+m+'</button>'}).join('')+'</div>'+
   '<div id="cashBox">'+field('Uang diterima (Rp)','paid','','number','inputmode="numeric" min="0"')+'<div id="quick" class="flex flex-wrap gap-2 mb-3"></div></div>'+
   field('Catatan (opsional)','note','','text','placeholder="Meja 3 / bungkus"')+
   '<div class="bg-slate-50 rounded-2xl p-4 mb-4 space-y-1"><div class="flex justify-between text-sm"><span>Diskon</span><b id="vDisc">Rp 0</b></div><div class="flex justify-between text-lg"><span class="font-bold">Total</span><b id="vTotal"></b></div><div class="flex justify-between text-sm"><span>Kembalian</span><b id="vChg" class="text-amber-800"></b></div></div>'+
   '<button id="doPay" class="'+BT+' w-full py-4 text-base">✔ PROSES PEMBAYARAN</button>');
  var method='Tunai';
  function calc(){var f=formData(b);var d=0;var p=S.promos.find(function(x){return String(x.id)===f.promo_id});if(p)d+=p.type==='percent'?Math.round(sub*Math.min(p.value,100)/100):Math.round(p.value);d+=Math.max(0,Math.round(Number(f.discount)||0));d=Math.min(d,sub);var t=sub-d;
    $('#vDisc').textContent='- '+rp(d);$('#vTotal').textContent=rp(t);var paid=Number(f.paid)||0;$('#vChg').textContent=method==='Tunai'?(paid>=t?rp(paid-t):'kurang '+rp(t-paid)):'-';
    var qs=[t,Math.ceil(t/5000)*5000,Math.ceil(t/10000)*10000,Math.ceil(t/50000)*50000,100000].filter(function(x,i,a){return x>=t&&a.indexOf(x)===i}).slice(0,5);
    $('#quick').innerHTML=qs.map(function(x,i){return '<button type="button" data-v="'+x+'" class="qv px-3 py-2 rounded-lg bg-slate-100 text-sm font-bold">'+(i===0?'Uang pas':rp(x))+'</button>'}).join('');
    $$('.qv',b).forEach(function(q){q.onclick=function(){$('[name=paid]',b).value=q.dataset.v;calc()}});return t}
  $$('input,select',b).forEach(function(el){el.addEventListener('input',calc)});
  $$('.pm',b).forEach(function(x){x.onclick=function(){method=x.dataset.m;$$('.pm',b).forEach(function(y){var on=y===x;y.classList.toggle('border-amber-600',on);y.classList.toggle('bg-amber-50',on);y.classList.toggle('text-amber-800',on);y.classList.toggle('border-slate-200',!on)});$('#cashBox').style.display=method==='Tunai'?'':'none';calc()}});
  calc();
  $('#doPay').onclick=function(){guard(this,async function(){var t=calc();var f=formData(b);
    if(method==='Tunai'&&!(Number(f.paid)>0)){f.paid=t}
    var d=await api('/api/transactions','POST',{items:cartLines().map(function(l){return {menu_id:l.m.id,qty:l.qty}}),promo_id:f.promo_id||null,discount:Number(f.discount)||0,pay_method:method,paid:Number(f.paid)||0,note:f.note,order_id:S.orderId});
    S.cart={};S.orderId=null;renderGrid();renderCart();receiptModal(d.transaction,true)})};
}
function receiptText(t){return linesText(receiptLines(t))}
function receiptModal(t,fresh){
  var txt=receiptText(t);
  var b=openModal('Transaksi '+(fresh?'berhasil ✅':t.code),'<pre class="bg-slate-50 rounded-2xl p-4 text-[11px] font-mono whitespace-pre-wrap mb-4">'+esc(txt)+'</pre>'+
   (fresh&&t.change_amt?'<div class="text-center mb-4"><div class="text-slate-500 text-sm font-bold">KEMBALIAN</div><div class="text-3xl font-extrabold text-amber-800">'+rp(t.change_amt)+'</div></div>':'')+
   '<div class="grid grid-cols-4 gap-2"><button id="rPrint" class="'+BT+' col-span-2">🖨️ Cetak</button><button id="rMore" class="'+BG+'">⋯</button><button id="rWa" class="'+BG+'">💬 WA</button></div><button data-close class="'+BG+' w-full mt-2">Selesai</button>');
  $('#rPrint').onclick=function(){quickPrint(t)};$('#rMore').onclick=function(){printMenu(t)};
  $('#rWa').onclick=function(){guard(this,async function(){var link='';try{link=(await api('/api/receipt-link/'+t.id)).url}catch(e){}waOpen('https://wa.me/?text='+encodeURIComponent(txt+(link?'\n\nStruk digital: '+link:'')))})};
  if(fresh&&PRN.auto&&PRN.set)printTrx(t);
}

// ---------------- PESANAN (QR meja)
VIEWS.pesanan=async function(v){
  var d=await api('/api/orders');var os=d.orders;
  var grp={baru:[],diproses:[],lain:[]};os.forEach(function(o){(grp[o.status]||grp.lain).push(o)});
  function card(o){var col={baru:'border-red-500',diproses:'border-amber-500',selesai:'border-emerald-400',ditolak:'border-slate-300'}[o.status]||'border-slate-200';
    return '<div class="bg-white rounded-2xl p-4 mb-3 border-l-8 '+col+'"><div class="flex justify-between items-start gap-2"><div><div class="font-extrabold text-lg">'+esc(o.table_name||'-')+'</div><div class="text-xs text-slate-500">👤 '+esc(o.customer||'Tamu')+' · '+ago(o.created_at)+' · #'+o.id+'</div></div><span class="text-xs font-extrabold uppercase px-2 py-1 rounded-full '+({baru:'bg-red-100 text-red-700',diproses:'bg-amber-100 text-amber-800',selesai:'bg-emerald-100 text-emerald-700'}[o.status]||'bg-slate-100 text-slate-500')+'">'+o.status+'</span></div>'+
    '<div class="mt-2 text-sm">'+o.items.map(function(i){return '<div class="flex justify-between"><span><b>'+i.qty+'×</b> '+esc(i.name)+'</span><span>'+rp(i.price*i.qty)+'</span></div>'}).join('')+'</div>'+(o.note?'<div class="text-sm bg-amber-50 rounded-lg px-2 py-1 mt-2">📝 '+esc(o.note)+'</div>':'')+
    '<div class="flex justify-between font-extrabold mt-2 border-t pt-2"><span>Total</span><span>'+rp(o.total)+'</span></div>'+
    (o.status==='baru'?'<div class="grid grid-cols-3 gap-2 mt-3"><button data-a="accept" data-id="'+o.id+'" class="oa '+BT+' col-span-2">✔ Terima</button><button data-a="reject" data-id="'+o.id+'" class="oa '+BR+'">Tolak</button></div>':'')+
    (o.status==='diproses'?'<div class="grid grid-cols-3 gap-2 mt-3"><button data-pay="'+o.id+'" class="'+BT+' col-span-2">💳 Bayar di kasir</button><button data-kit="'+o.id+'" class="'+BG+'">🖨️ Dapur</button></div>':'')+'</div>'}
  v.innerHTML='<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Pesanan Meja</h2><div class="flex gap-2"><button id="tst" class="'+BG+'">🔊 Tes bunyi</button><button id="rl" class="'+BG+'">↻</button></div></div>'+
   (grp.baru.length?'<div class="text-xs font-extrabold text-red-600 uppercase tracking-wider mb-2">🔴 Baru ('+grp.baru.length+')</div>'+grp.baru.map(card).join(''):'')+
   (grp.diproses.length?'<div class="text-xs font-extrabold text-amber-700 uppercase tracking-wider mb-2 mt-4">🟡 Sedang diproses ('+grp.diproses.length+')</div>'+grp.diproses.map(card).join(''):'')+
   (grp.lain.length?'<div class="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 mt-4">Riwayat 2 hari</div>'+grp.lain.map(card).join(''):'')+
   (!os.length?'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada pesanan dari QR meja.'+(can('meja')?'<br><button onclick="go(\'meja\')" class="text-amber-700 font-bold mt-2">Buat QR meja →</button>':'')+'</div>':'');
  $('#rl').onclick=function(){VIEWS.pesanan(v)};
  $('#tst').onclick=function(){audioUnlock();alarmOnce();toast('Kalau tidak terdengar: naikkan volume media HP')};
  $$('.oa').forEach(function(b){b.onclick=function(){guard(b,async function(){await api('/api/orders/'+b.dataset.id,'PUT',{action:b.dataset.a});if(b.dataset.a==='accept'&&PRN.kitchen&&PRN.set){var o=os.find(function(x){return String(x.id)===b.dataset.id});printKitchen(o)}toast(b.dataset.a==='accept'?'Pesanan diterima':'Pesanan ditolak');VIEWS.pesanan(v)})}});
  $$('[data-kit]').forEach(function(b){b.onclick=function(){quickPrint(os.find(function(x){return String(x.id)===b.dataset.kit}),true)}});
  $$('[data-pay]').forEach(function(b){b.onclick=function(){guard(b,async function(){var o=os.find(function(x){return String(x.id)===b.dataset.pay});await loadMenu(true);S.cart={};var miss=0;o.items.forEach(function(i){if(S.menu.some(function(m){return m.id===i.menu_id}))S.cart[i.menu_id]=(S.cart[i.menu_id]||0)+i.qty;else miss++});if(miss)toast(miss+' item sudah tidak ada di menu',true);S.orderId=o.id;go('kasir');setTimeout(payModal,300)})}});
};

// ---------------- TRANSAKSI
VIEWS.trx=async function(v){
  if(!S.trxFrom){S.trxFrom=dayStr(0);S.trxTo=dayStr(0)}
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Riwayat Transaksi</h2><div class="bg-white rounded-2xl p-3 mb-3 flex flex-wrap gap-2 items-end"><label class="text-xs font-bold text-slate-500">Dari<input type="date" id="f1" value="'+S.trxFrom+'" class="block border rounded-lg px-2 py-2"></label><label class="text-xs font-bold text-slate-500">Sampai<input type="date" id="f2" value="'+S.trxTo+'" class="block border rounded-lg px-2 py-2"></label><button id="ld" class="'+BP+'">Tampilkan</button></div><div id="tl"></div>';
  async function load(){S.trxFrom=$('#f1').value;S.trxTo=$('#f2').value;var d=await api('/api/transactions?from='+S.trxFrom+'&to='+S.trxTo);var list=d.transactions;
    var tot=list.reduce(function(a,t){return a+t.total},0);
    $('#tl').innerHTML='<div class="flex justify-between bg-slate-900 text-white rounded-2xl p-4 mb-3"><span class="font-bold">'+list.length+' transaksi'+(can('trx_all')?'':' (milikmu)')+'</span><b>'+rp(tot)+'</b></div>'+(list.length?list.map(function(t){return '<details class="bg-white rounded-2xl mb-2 overflow-hidden"><summary class="p-4 flex justify-between items-center cursor-pointer list-none"><div><div class="font-bold text-sm">'+esc(t.code)+'</div><div class="text-xs text-slate-500">'+fmtDT(t.created_at)+' · '+esc(t.pay_method)+' · '+esc(t.cashier||'-')+'</div></div><b>'+rp(t.total)+'</b></summary><div class="px-4 pb-4 text-sm border-t pt-3">'+t.items.map(function(i){return '<div class="flex justify-between"><span>'+esc(i.name)+' × '+i.qty+'</span><span>'+rp(i.subtotal)+'</span></div>'}).join('')+(t.discount?'<div class="flex justify-between text-red-600"><span>Diskon</span><span>-'+rp(t.discount)+'</span></div>':'')+(t.note?'<div class="text-xs text-slate-500 mt-1">📝 '+esc(t.note)+'</div>':'')+
      '<div class="flex gap-2 mt-3"><button data-id="'+t.id+'" class="rpr '+BT+' flex-1">🖨️ Cetak</button><button data-id="'+t.id+'" class="rp '+BG+'">Struk</button>'+(can('trx_void')?'<button data-id="'+t.id+'" class="del '+BR+'">Batalkan</button>':'')+'</div></div></details>'}).join(''):'<div class="text-center text-slate-400 py-8">Tidak ada transaksi</div>');
    function find(id){return list.find(function(x){return String(x.id)===id})}
    $$('.rp').forEach(function(b){b.onclick=function(){receiptModal(find(b.dataset.id))}});
    $$('.rpr').forEach(function(b){b.onclick=function(){quickPrint(find(b.dataset.id))}});
    $$('.del').forEach(function(b){b.onclick=function(){if(!confirm('Batalkan transaksi ini? Stok bahan akan dikembalikan.'))return;guard(b,async function(){await api('/api/transactions/'+b.dataset.id,'DELETE');toast('Transaksi dibatalkan');load()})}})}
  $('#ld').onclick=function(){guard(this,load)};await load();
};

// ---------------- LAPORAN
function rangeOf(p){var t=dayStr(0);if(p==='today')return [t,t];if(p==='yesterday'){var y=dayStr(-1);return [y,y]}if(p==='7')return [dayStr(-6),t];if(p==='30')return [dayStr(-29),t];if(p==='month')return [t.slice(0,8)+'01',t];
  if(p==='lastmonth'){var d=new Date(t.slice(0,8)+'01T00:00:00Z');d.setUTCDate(0);var e=d.toISOString().slice(0,10);return [e.slice(0,8)+'01',e]}return null}
VIEWS.laporan=async function(v){
  S.rp=S.rp||'today';
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Laporan Penjualan</h2>'+
  '<div class="bg-white rounded-2xl p-3 mb-3"><div class="flex flex-wrap gap-2 mb-2">'+[['today','Hari ini'],['yesterday','Kemarin'],['7','7 hari'],['30','30 hari'],['month','Bulan ini'],['lastmonth','Bulan lalu'],['pickmonth','Pilih bulan'],['custom','Custom']].map(function(x){return '<button data-p="'+x[0]+'" class="rpb px-3 py-1.5 rounded-full text-xs font-bold '+(S.rp===x[0]?'bg-slate-900 text-white':'bg-slate-100')+'">'+x[1]+'</button>'}).join('')+'</div>'+
  '<div id="rx" class="flex flex-wrap gap-2 items-end"></div></div><div id="rep"></div>';
  $$('.rpb').forEach(function(b){b.onclick=function(){S.rp=b.dataset.p;VIEWS.laporan(v)}});
  var rx=$('#rx');
  if(S.rp==='pickmonth'){rx.innerHTML='<input type="month" id="mon" value="'+(S.mon||dayStr(0).slice(0,7))+'" class="border rounded-lg px-2 py-2"><button id="go" class="'+BP+'">Tampilkan</button>';$('#go').onclick=function(){S.mon=$('#mon').value;var y=+S.mon.slice(0,4),m=+S.mon.slice(5,7);var last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);loadRep(S.mon+'-01',last)};$('#go').click();return}
  if(S.rp==='custom'){rx.innerHTML='<input type="date" id="c1" value="'+(S.c1||dayStr(-6))+'" class="border rounded-lg px-2 py-2"><input type="date" id="c2" value="'+(S.c2||dayStr(0))+'" class="border rounded-lg px-2 py-2"><button id="go" class="'+BP+'">Tampilkan</button>';$('#go').onclick=function(){S.c1=$('#c1').value;S.c2=$('#c2').value;loadRep(S.c1,S.c2)};$('#go').click();return}
  var r=rangeOf(S.rp);await loadRep(r[0],r[1]);
};
async function loadRep(from,to){
  var el=$('#rep');el.innerHTML='<div class="text-center text-slate-400 py-8">Memuat…</div>';
  var d=await api('/api/report?from='+from+'&to='+to);var s=d.summary;var laba=s.omzet-s.hpp;
  function card(l,val,cls){return '<div class="bg-white rounded-2xl p-4"><div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">'+l+'</div><div class="text-lg font-extrabold mt-1 '+(cls||'')+'">'+val+'</div></div>'}
  el.innerHTML='<div class="flex justify-between items-center mb-2"><div class="text-xs text-slate-500 font-bold">Periode '+from+' s/d '+to+'</div><button id="pRep" class="'+BG+' !py-1.5">🖨️ Cetak ringkasan</button></div>'+
   '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">'+card('Omzet',rp(s.omzet),'text-amber-800')+card('Laba kotor',rp(laba),laba>=0?'text-emerald-700':'text-red-600')+card('HPP',rp(s.hpp))+card('Transaksi',s.n+' trx')+card('Rata-rata/trx',rp(s.n?s.omzet/s.n:0))+card('Diskon',rp(s.disc))+card('Margin',(s.omzet?Math.round(laba/s.omzet*100):0)+'%')+card('Item terjual',d.top.reduce(function(a,x){return a+x.qty},0)+' pcs')+'</div>'+
   '<div class="bg-white rounded-2xl p-4 mb-3"><div class="font-extrabold mb-2">Grafik harian</div><div class="h-56"><canvas id="ch1"></canvas></div></div>'+
   '<div class="grid lg:grid-cols-2 gap-3 mb-3"><div class="bg-white rounded-2xl p-4"><div class="font-extrabold mb-2">Jam ramai</div><div class="h-48"><canvas id="ch2"></canvas></div></div>'+
   '<div class="bg-white rounded-2xl p-4"><div class="font-extrabold mb-2">Metode bayar & kasir</div>'+d.methods.map(function(m){return '<div class="flex justify-between text-sm py-1"><span>'+esc(m.m)+' ('+m.n+')</span><b>'+rp(m.omzet)+'</b></div>'}).join('')+'<div class="border-t my-2"></div>'+d.cashiers.map(function(c){return '<div class="flex justify-between text-sm py-1"><span>👤 '+esc(c.c)+' ('+c.n+')</span><b>'+rp(c.omzet)+'</b></div>'}).join('')+'</div></div>'+
   '<div class="bg-white rounded-2xl p-4 mb-3"><div class="flex justify-between items-center mb-2"><div class="font-extrabold">Penjualan per menu</div><div class="flex gap-2">'+(IS_APK?'':'<button id="xl" class="'+BT+'">⬇ Excel</button>')+'<button id="xtg" class="'+BG+'">📤 Telegram</button></div></div><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-slate-500 text-xs"><th class="py-2">Menu</th><th class="text-right">Qty</th><th class="text-right">Omzet</th><th class="text-right">Laba</th></tr></thead><tbody>'+
   (d.top.length?d.top.map(function(m){return '<tr class="border-t"><td class="py-2 font-semibold">'+esc(m.name)+'</td><td class="text-right">'+m.qty+'</td><td class="text-right">'+rp(m.omzet)+'</td><td class="text-right">'+rp(m.omzet-m.hpp)+'</td></tr>'}).join(''):'<tr><td colspan="4" class="text-center text-slate-400 py-6">Belum ada penjualan</td></tr>')+'</tbody></table></div></div>';
  $('#pRep').onclick=function(){var L=summaryLines(d);if(!PRN.set||PRN.mode==='a4')printLines(L,PRN.mode==='a4'?'browser':PRN.mode);else printLines(L)};
  if($('#xl'))$('#xl').onclick=function(){guard(this,function(){return exportExcel(d)})};
  $('#xtg').onclick=function(){guard(this,async function(){await api('/api/report/telegram','POST',{from:from,to:to});toast('Laporan terkirim ke Telegram 📤')})};
  try{await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js','Chart');
    new Chart($('#ch1'),{type:'line',data:{labels:d.daily.map(function(x){return x.d.slice(5)}),datasets:[{label:'Omzet',data:d.daily.map(function(x){return x.omzet}),borderColor:'#b45309',backgroundColor:'rgba(180,83,9,.12)',fill:true,tension:.3},{label:'Laba',data:d.daily.map(function(x){return x.omzet-x.hpp}),borderColor:'#047857',tension:.3}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:function(v){return v>=1000?(v/1000)+'rb':v}}}}}});
    var hrs=[];for(var h=0;h<24;h++){var f=d.hours.find(function(x){return x.h===h});hrs.push(f?f.n:0)}
    new Chart($('#ch2'),{type:'bar',data:{labels:hrs.map(function(_,i){return i}),datasets:[{label:'Transaksi',data:hrs,backgroundColor:'#3b2316',borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  }catch(e){}
}
async function exportExcel(d){
  await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
  var t=await api('/api/transactions?from='+d.from+'&to='+d.to);var s=d.summary;
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Laporan '+S.me.store.name],['Periode',d.from+' s/d '+d.to],[],['Omzet',s.omzet],['HPP',s.hpp],['Laba kotor',s.omzet-s.hpp],['Diskon',s.disc],['Jumlah transaksi',s.n]]),'Ringkasan');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.daily.map(function(x){return {Tanggal:x.d,Transaksi:x.n,Omzet:x.omzet,HPP:x.hpp,Laba:x.omzet-x.hpp}})),'Harian');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.top.map(function(x){return {Menu:x.name,Qty:x.qty,Omzet:x.omzet,HPP:x.hpp,Laba:x.omzet-x.hpp}})),'Per Menu');
  var rows=[];t.transactions.forEach(function(tr){tr.items.forEach(function(i){rows.push({Tanggal:fmtDT(tr.created_at),Kode:tr.code,Kasir:tr.cashier,Metode:tr.pay_method,Menu:i.name,Qty:i.qty,Harga:i.price,Subtotal:i.subtotal,HPP:i.hpp*i.qty,'Diskon Trx':tr.discount,'Total Trx':tr.total})})});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Detail');
  XLSX.writeFile(wb,'Laporan_'+S.me.store.name.replace(/[^a-z0-9]+/gi,'_')+'_'+d.from+'_'+d.to+'.xlsx');
}

// ---------------- MENU (resep wajib)
VIEWS.menu=async function(v){
  var r=await Promise.all([api('/api/menu'),api('/api/stock')]);S.menu=r[0].menu;S.stock=r[1].stock;S.loaded=false;
  var cats={};S.menu.forEach(function(m){(cats[m.category||'Lainnya']=cats[m.category||'Lainnya']||[]).push(m)});
  v.innerHTML='<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Menu ('+S.menu.length+')</h2><button id="add" class="'+BT+'">+ Menu</button></div>'+
   (S.stock.length?'':'<div class="bg-amber-50 text-amber-900 rounded-2xl p-3 mb-3 text-sm">ℹ️ Setiap menu wajib punya resep. Tambahkan bahan dulu di <button onclick="go(\'stok\')" class="font-bold underline">Stok</button>.</div>')+
   (S.menu.length?Object.keys(cats).map(function(c){return '<div class="text-xs font-extrabold text-slate-500 uppercase tracking-wider mt-4 mb-2">'+esc(c)+'</div>'+cats[c].map(function(m){var hpp=m.recipe.length?m.recipe_cost:m.hpp;var mg=m.price?Math.round((m.price-hpp)/m.price*100):0;
     return '<button data-id="'+m.id+'" class="me w-full text-left bg-white rounded-2xl p-4 mb-2 flex items-center gap-3 '+(m.active?'':'opacity-50')+'"><div class="flex-1 min-w-0"><div class="font-bold truncate">'+esc(m.name)+(m.active?'':' <span class="text-xs text-red-500">(nonaktif)</span>')+(m.recipe.length?'':' <span class="text-xs text-red-600 font-bold">⚠ tanpa resep</span>')+'</div><div class="text-xs text-slate-500">HPP '+rp(hpp)+' · margin '+mg+'% · '+m.recipe.length+' bahan</div></div><b class="text-amber-800">'+rp(m.price)+'</b></button>'}).join('')}).join(''):'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada menu. Tap <b>+ Menu</b> untuk mulai.</div>');
  $('#add').onclick=function(){if(!S.stock.length){toast('Tambahkan bahan di Stok dulu — menu wajib punya resep',true);go('stok');return}menuModal(null)};
  $$('.me').forEach(function(b){b.onclick=function(){menuModal(S.menu.find(function(m){return String(m.id)===b.dataset.id}))}});
};
function menuModal(m){
  m=m||{name:'',category:'',price:'',hpp:0,active:1,recipe:[]};
  var cats=Array.from(new Set(S.menu.map(function(x){return x.category}).filter(Boolean)));
  var rec=m.recipe.map(function(r){return {stock_id:r.stock_id,qty:r.qty}});
  if(!rec.length&&S.stock.length)rec.push({stock_id:S.stock[0].id,qty:''});
  var b=openModal(m.id?'Edit menu':'Menu baru',field('Nama menu','name',m.name,'text','required')+field('Kategori','category',m.category,'text','list="cats" placeholder="Kopi / Non-kopi / Makanan"')+'<datalist id="cats">'+cats.map(function(c){return '<option value="'+esc(c)+'">'}).join('')+'</datalist>'+
   field('Harga jual (Rp)','price',m.price,'number','inputmode="numeric"')+
   '<label class="flex items-center gap-2 mb-4 font-semibold"><input type="checkbox" name="active" '+(m.active?'checked':'')+' class="w-5 h-5"> Tampilkan di kasir & QR meja</label>'+
   '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4"><div class="flex justify-between items-center mb-1"><b>Resep <span class="text-red-600">*wajib</span></b><button type="button" id="ar" class="text-amber-800 font-bold text-sm">+ Bahan</button></div><div class="text-xs text-slate-500 mb-2">Bahan & takaran per 1 porsi. Stok terpotong otomatis setiap terjual.</div><div id="rl"></div><div class="text-sm mt-2">HPP dari resep: <b id="rc">Rp 0</b> · Margin: <b id="mg">-</b></div><div id="recErr" class="hidden text-sm text-red-600 font-bold mt-2">⚠ Isi minimal 1 bahan dengan takaran lebih dari 0.</div></div>'+
   '<div class="flex gap-2">'+(m.id?'<button id="dl" class="'+BR+'">Hapus</button>':'')+'<button id="sv" class="'+BP+' flex-1">Simpan</button></div>');
  function drawRec(){
    $('#rl').innerHTML=rec.map(function(r,i){return '<div class="flex gap-2 mb-2"><select data-i="'+i+'" class="rs flex-1 min-w-0 border rounded-lg px-2 py-2 bg-white">'+S.stock.map(function(s){return '<option value="'+s.id+'" '+(s.id==r.stock_id?'selected':'')+'>'+esc(s.name)+' ('+esc(s.unit||'')+')</option>'}).join('')+'</select><input data-i="'+i+'" type="number" step="any" value="'+r.qty+'" class="rq w-20 border rounded-lg px-2 py-2" placeholder="qty"><button data-i="'+i+'" class="rd w-9 rounded-lg bg-red-50 text-red-600 font-bold">×</button></div>'}).join('');
    $$('.rs',b).forEach(function(s){s.onchange=function(){rec[s.dataset.i].stock_id=+s.value;cost()}});
    $$('.rq',b).forEach(function(s){s.oninput=function(){rec[s.dataset.i].qty=+s.value;cost()}});
    $$('.rd',b).forEach(function(s){s.onclick=function(){rec.splice(+s.dataset.i,1);drawRec()}});cost()}
  function valid(){return rec.filter(function(r){return r.stock_id&&Number(r.qty)>0})}
  function cost(){var c=rec.reduce(function(a,r){var s=S.stock.find(function(x){return x.id==r.stock_id});return a+(s?s.cost_per_unit*(Number(r.qty)||0):0)},0);$('#rc').textContent=rp(c);var p=+formData(b).price||0;$('#mg').textContent=p?Math.round((p-c)/p*100)+'%':'-';
    var ok=valid().length>0;$('#sv').disabled=!ok;$('#sv').classList.toggle('opacity-40',!ok);$('#recErr').classList.toggle('hidden',ok)}
  $('[name=price]',b).addEventListener('input',cost);
  $('#ar').onclick=function(){rec.push({stock_id:S.stock[0].id,qty:''});drawRec()};drawRec();
  $('#sv').onclick=function(){if(!valid().length){$('#recErr').classList.remove('hidden');toast('Resep belum diisi — menu belum bisa dibuat',true);return}guard(this,async function(){var f=formData(b);var body={name:f.name,category:f.category,price:+f.price||0,hpp:0,active:f.active,recipe:valid()};
    if(m.id)await api('/api/menu/'+m.id,'PUT',body);else await api('/api/menu','POST',body);closeModal();toast('Menu tersimpan');go('menu')})};
  if(m.id)$('#dl').onclick=function(){if(!confirm('Hapus menu '+m.name+'?'))return;guard(this,async function(){await api('/api/menu/'+m.id,'DELETE');closeModal();go('menu')})};
}

// ---------------- STOK
VIEWS.stok=async function(v){
  S.stock=(await api('/api/stock')).stock;var low=S.stock.filter(function(s){return s.qty<=s.min_qty});var full=can('stok');
  v.innerHTML='<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Stok Bahan</h2>'+(full?'<button id="add" class="'+BT+'">+ Bahan</button>':'')+'</div>'+
   (low.length?'<div class="bg-red-50 text-red-700 rounded-2xl p-3 mb-3 text-sm font-semibold">⚠️ '+low.length+' bahan menipis: '+low.map(function(s){return esc(s.name)}).join(', ')+'</div>':'')+
   (S.stock.length?S.stock.map(function(s){var isLow=s.qty<=s.min_qty;return '<div class="bg-white rounded-2xl p-4 mb-2 flex items-center gap-3 '+(isLow?'ring-2 ring-red-300':'')+'"><button data-id="'+s.id+'" class="se flex-1 text-left min-w-0"><div class="font-bold truncate">'+esc(s.name)+'</div><div class="text-xs text-slate-500">min '+fnum(s.min_qty)+' · '+rp(s.cost_per_unit)+'/'+esc(s.unit||'unit')+'</div></button><div class="text-right mr-1"><div class="font-extrabold '+(isLow?'text-red-600':'')+'">'+fnum(s.qty)+'</div><div class="text-xs text-slate-500">'+esc(s.unit||'')+'</div></div><button data-id="'+s.id+'" class="sa w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-extrabold text-lg">±</button></div>'}).join(''):'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada bahan. Contoh: Kopi bubuk (gram), Gula (gram), Susu (ml), Cup (pcs).</div>');
  if($('#add'))$('#add').onclick=function(){stockModal(null)};
  $$('.se').forEach(function(b){b.onclick=function(){if(!full)return toast('Kamu hanya bisa catat stok masuk/keluar (±)');stockModal(S.stock.find(function(s){return String(s.id)===b.dataset.id}))}});
  $$('.sa').forEach(function(b){b.onclick=function(){var s=S.stock.find(function(x){return String(x.id)===b.dataset.id});var mb=openModal('Ubah stok: '+s.name,'<p class="text-sm text-slate-500 mb-3">Stok sekarang <b>'+fnum(s.qty)+' '+esc(s.unit||'')+'</b>.</p>'+field('Jumlah','delta','','number','step="any" inputmode="decimal"')+'<div class="grid grid-cols-2 gap-2"><button id="mn" class="'+BR+'">− Keluar</button><button id="pl" class="'+BT+'">+ Masuk</button></div>');
    function doIt(sign,btn){guard(btn,async function(){var n=Math.abs(+$('[name=delta]',mb).value||0);if(!n)throw new Error('Isi jumlah');await api('/api/stock/'+s.id+'/adjust','POST',{delta:sign*n});closeModal();toast('Stok diperbarui');go('stok')})}
    $('#pl').onclick=function(){doIt(1,this)};$('#mn').onclick=function(){doIt(-1,this)}}});
};
function stockModal(s){
  s=s||{name:'',unit:'',qty:0,min_qty:0,cost_per_unit:0};
  var b=openModal(s.id?'Edit bahan':'Bahan baru',field('Nama bahan','name',s.name)+field('Satuan (gram/ml/pcs)','unit',s.unit)+field('Jumlah stok','qty',s.qty,'number','step="any"')+field('Batas minimum (peringatan)','min_qty',s.min_qty,'number','step="any"')+field('Harga modal per satuan (Rp)','cost_per_unit',s.cost_per_unit,'number','step="any"')+
   '<p class="text-xs text-slate-500 -mt-1 mb-4">Contoh: kopi 1 kg Rp 120.000 → per gram Rp 120.</p><div class="flex gap-2">'+(s.id?'<button id="dl" class="'+BR+'">Hapus</button>':'')+'<button id="sv" class="'+BP+' flex-1">Simpan</button></div>');
  $('#sv').onclick=function(){guard(this,async function(){var f=formData(b);if(s.id)await api('/api/stock/'+s.id,'PUT',f);else await api('/api/stock','POST',f);closeModal();toast('Tersimpan');go('stok')})};
  if(s.id)$('#dl').onclick=function(){if(!confirm('Hapus bahan '+s.name+'? Resep yang memakai bahan ini ikut dihapus.'))return;guard(this,async function(){await api('/api/stock/'+s.id,'DELETE');closeModal();go('stok')})};
}

// ---------------- LAINNYA
VIEWS.lainnya=async function(v){
  S.me=await api('/api/me');var a=S.me.access,demo=a.label==='demo',lim=S.me.limited;
  function item(icon,label,sub,attr,locked){return '<button '+attr+' class="w-full bg-white rounded-2xl p-4 mb-2 flex items-center gap-3 text-left '+(locked?'opacity-60':'')+'"><span class="text-2xl">'+icon+'</span><div class="flex-1"><div class="font-bold">'+label+(locked?' 🔒':'')+'</div>'+(sub?'<div class="text-xs text-slate-500">'+sub+'</div>':'')+'</div><span class="text-slate-300">›</span></button>'}
  var R=S.me.user.role,mgr=isMgr();
  function feat(key,icon,label,sub,perm){var ok=perm===true||can(perm);var full=perm===true||(S.me.perms.indexOf(perm)>=0);if(lim&&!ok&&mgr)return item(icon,label,'Terkunci — aktifkan lisensi','data-lock="1"',true);if(!ok)return '';return item(icon,label,sub,'data-go="'+key+'"')}
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Lainnya</h2>'+
   (demo?'<div class="rounded-3xl p-5 mb-4 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900"><div class="text-xs font-bold uppercase tracking-widest opacity-80">Mode demo</div><div class="text-2xl font-extrabold mt-1">Toko contoh</div><div class="text-sm">Data ini terhapus dalam 24 jam. Daftar untuk <b>trial gratis 14 hari</b>.</div><a href="/daftar" class="inline-block mt-3 bg-slate-900 text-white font-bold text-sm rounded-xl px-4 py-2">Daftar gratis sekarang</a></div>':
   '<div class="rounded-3xl p-5 mb-4 text-white '+(lim?'bg-gradient-to-br from-red-600 to-rose-700':a.label==='trial'?'bg-gradient-to-br from-amber-600 to-orange-700':'bg-gradient-to-br from-emerald-600 to-teal-700')+'"><div class="text-xs font-bold uppercase tracking-widest opacity-80">Status lisensi</div><div class="text-2xl font-extrabold mt-1">'+(lim?'Masa aktif habis':a.label==='trial'?'Trial gratis':'Lisensi aktif')+'</div><div class="text-sm opacity-90">'+(lim?'Hanya fitur transaksi yang aktif.':'Sisa <b>'+a.daysLeft+' hari</b> · berakhir '+fmtD(new Date(a.end).toISOString()))+'</div>'+(S.me.price_text?'<div class="text-xs mt-2 opacity-90 whitespace-pre-line">'+esc(S.me.price_text)+'</div>':'')+(mgr?'<div class="flex flex-wrap gap-2 mt-3"><button id="licB" class="bg-white text-slate-900 font-extrabold text-sm rounded-xl px-4 py-2">🔑 Masukkan serial number</button>'+(S.me.lynk_url?'<button id="buyB" class="bg-[#1c0f0a] text-amber-300 font-bold text-sm rounded-xl px-4 py-2">🛒 Beli lisensi</button>':'')+'<button id="extB" class="bg-white/20 text-white font-bold text-sm rounded-xl px-4 py-2">💬 Chat admin</button></div>':'')+'</div>')+
   feat('meja','🪑','Meja & QR code','Buat QR untuk ditempel di meja','meja')+
   feat('promo','🎟️','Promo & diskon','Promo persen / nominal','promo')+
   feat('users','👥','Pengguna & role','Owner, OM, Admin, SPV, Kasir','users')+
   (R==='owner'?(lim?item('🛡️','Hak akses role','Terkunci — aktifkan lisensi','data-lock="1"',true):item('🛡️','Hak akses role','Atur fitur yang boleh dipakai tiap role','data-go="roles"')):'')+
   item('🖨️','Printer & struk',PRN.set?(PRN_MODES.find(function(m){return m[0]===PRN.mode})||[0,0,''])[2]+' · '+PRN.paper+' mm':'Belum diatur','data-go="printer"')+
   feat('profil','🏪','Profil toko & struk','Nama, alamat, catatan bawah struk','toko')+
   feat('telegram','🤖','Bot Telegram',S.me.store.tg_connected?'✅ Terhubung':'Notifikasi transaksi & laporan harian','telegram')+
   (mgr&&!demo?item('🔑','Lisensi & aktivasi','Masukkan serial number · riwayat','id="licI"'):'')+
   item('💬','Chat Head Admin','Keluhan, bantuan, perpanjang · WhatsApp','id="sup"')+
   (IS_APK?item('⬆️','Update aplikasi','Versi terpasang v'+(APK_V||1)+' · terbaru v'+S.me.apk.version,'id="upd"'):item('📲','Unduh aplikasi Android','JCOFFE POS untuk HP','id="inst"'))+
   (demo?'':item('🔑','Ganti password','','id="cpw"'))+item('🚪','Keluar','','id="lo"');
  $$('[data-go]').forEach(function(b){b.onclick=function(){go(b.dataset.go)}});
  $$('[data-lock]').forEach(function(b){b.onclick=function(){toast('Fitur terkunci — aktifkan lisensi untuk membuka');licenseModal()}});
  if($('#extB'))$('#extB').onclick=askExtend;
  if($('#licB'))$('#licB').onclick=function(){licenseModal()};
  if($('#licI'))$('#licI').onclick=function(){licenseModal()};
  if($('#buyB'))$('#buyB').onclick=function(){openExternal(S.me.lynk_url)};
  $('#sup').onclick=supportModal;
  if($('#upd'))$('#upd').onclick=updateModal;if($('#inst'))$('#inst').onclick=installApp;
  if($('#cpw'))$('#cpw').onclick=function(){pwModal(false)};$('#lo').onclick=logout;
};
VIEWS.promo=async function(v){
  var list=(await api('/api/promos')).promos;S.loaded=false;
  v.innerHTML=backBtn()+'<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Promo</h2><button id="add" class="'+BT+'">+ Promo</button></div>'+
   (list.length?list.map(function(p){return '<button data-id="'+p.id+'" class="pe w-full text-left bg-white rounded-2xl p-4 mb-2 flex justify-between '+(p.active?'':'opacity-50')+'"><b>'+esc(p.name)+'</b><span class="font-extrabold text-amber-800">'+(p.type==='percent'?p.value+'%':rp(p.value))+'</span></button>'}).join(''):'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada promo</div>');
  function modal(p){p=p||{name:'',type:'percent',value:10,active:1};var b=openModal(p.id?'Edit promo':'Promo baru',field('Nama promo','name',p.name)+selectField('Jenis','type',[['percent','Persen (%)'],['nominal','Nominal (Rp)']],p.type)+field('Nilai','value',p.value,'number','step="any"')+'<label class="flex items-center gap-2 mb-4 font-semibold"><input type="checkbox" name="active" '+(p.active?'checked':'')+' class="w-5 h-5"> Aktif</label><div class="flex gap-2">'+(p.id?'<button id="dl" class="'+BR+'">Hapus</button>':'')+'<button id="sv" class="'+BP+' flex-1">Simpan</button></div>');
    $('#sv').onclick=function(){guard(this,async function(){var f=formData(b);if(p.id)await api('/api/promos/'+p.id,'PUT',f);else await api('/api/promos','POST',f);closeModal();go('promo')})};
    if(p.id)$('#dl').onclick=function(){guard(this,async function(){await api('/api/promos/'+p.id,'DELETE');closeModal();go('promo')})}}
  $('#add').onclick=function(){modal()};$$('.pe').forEach(function(b){b.onclick=function(){modal(list.find(function(p){return String(p.id)===b.dataset.id}))}});
};
var ROLE_OPTS=[['kasir','Kasir / Barista'],['spv','Supervisor'],['admin','Admin'],['om','Operational Manager']];
VIEWS.users=async function(v){
  var list=(await api('/api/users')).users;var LBL={owner:'Owner',om:'Operational Manager',admin:'Admin',spv:'Supervisor',kasir:'Kasir / Barista'};
  var COL={owner:'bg-slate-900 text-white',om:'bg-violet-100 text-violet-700',admin:'bg-sky-100 text-sky-700',spv:'bg-amber-100 text-amber-800',kasir:'bg-emerald-100 text-emerald-700'};
  var opts=isOwner()?ROLE_OPTS:ROLE_OPTS.filter(function(r){return r[0]!=='om'});
  v.innerHTML=backBtn()+'<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Pengguna & role</h2><button id="add" class="'+BT+'">+ Pengguna</button></div>'+
   (isOwner()?'<button onclick="go(\'roles\')" class="w-full text-left bg-amber-50 text-amber-900 rounded-2xl p-3 mb-3 text-sm font-semibold">🛡️ Atur hak akses tiap role →</button>':'')+
   list.map(function(u){return '<div class="bg-white rounded-2xl p-4 mb-2 flex items-center gap-3 '+(u.active?'':'opacity-50')+'"><div class="flex-1 min-w-0"><div class="font-bold">'+esc(u.name)+' <span class="text-[10px] font-bold px-2 py-0.5 rounded-full '+(COL[u.role]||'')+'">'+(LBL[u.role]||u.role)+'</span></div><div class="text-xs text-slate-500">@'+esc(u.username)+' · login terakhir '+fmtDT(u.last_login)+'</div></div>'+(u.role==='owner'||(!isOwner()&&u.role==='om')?'':'<button data-id="'+u.id+'" class="ue '+BG+'">Kelola</button>')+'</div>'}).join('');
  $('#add').onclick=function(){var b=openModal('Tambah pengguna',field('Nama','name','')+field('Username','username','','text','autocapitalize="none"')+field('Password (min 6)','password','','text')+selectField('Role','role',opts,'kasir')+'<button id="sv" class="'+BP+' w-full">Simpan</button>');
    $('#sv').onclick=function(){guard(this,async function(){await api('/api/users','POST',formData(b));closeModal();toast('Pengguna ditambahkan');go('users')})}};
  $$('.ue').forEach(function(btn){btn.onclick=function(){var u=list.find(function(x){return String(x.id)===btn.dataset.id});var b=openModal('Kelola @'+u.username,field('Nama','name',u.name)+selectField('Role','role',opts,u.role)+field('Password baru (kosongkan jika tidak diganti)','password','','text')+'<label class="flex items-center gap-2 mb-4 font-semibold"><input type="checkbox" name="active" '+(u.active?'checked':'')+' class="w-5 h-5"> Akun aktif</label><div class="flex gap-2"><button id="dl" class="'+BR+'">Hapus</button><button id="sv" class="'+BP+' flex-1">Simpan</button></div>');
    $('#sv').onclick=function(){guard(this,async function(){await api('/api/users/'+u.id,'PUT',formData(b));closeModal();toast('Tersimpan');go('users')})};
    $('#dl').onclick=function(){if(!confirm('Hapus akun '+u.username+'?'))return;guard(this,async function(){await api('/api/users/'+u.id,'DELETE');closeModal();go('users')})}}});
};
VIEWS.roles=async function(v){
  var d=await api('/api/roles');
  v.innerHTML=backBtn()+'<h2 class="text-xl font-extrabold mb-1">Hak akses role</h2><p class="text-sm text-slate-500 mb-3">Owner selalu punya semua akses. Centang fitur yang boleh dipakai tiap role, lalu simpan.</p>'+
   d.roles.map(function(r){return '<div class="bg-white rounded-2xl p-4 mb-3" data-role="'+r.key+'"><div class="font-extrabold">'+esc(r.label)+'</div><div class="text-xs text-slate-500 mb-3">'+esc(r.desc)+'</div><div class="grid sm:grid-cols-2 gap-x-4 gap-y-1">'+d.perm_list.map(function(p){return '<label class="flex items-center gap-2 text-sm py-1"><input type="checkbox" value="'+p[0]+'" '+(r.perms.indexOf(p[0])>=0?'checked':'')+' class="w-5 h-5"> '+esc(p[1])+'</label>'}).join('')+'</div><div class="flex gap-2 mt-3"><button class="rsv '+BP+' flex-1">Simpan '+esc(r.label)+'</button><button class="rrs '+BG+'">Default</button></div></div>'}).join('');
  $$('[data-role]').forEach(function(box){var role=box.dataset.role;
    $('.rsv',box).onclick=function(){guard(this,async function(){var perms=$$('input:checked',box).map(function(i){return i.value});await api('/api/roles','PUT',{role:role,perms:perms});toast('Hak akses '+role.toUpperCase()+' disimpan')})};
    $('.rrs',box).onclick=function(){guard(this,async function(){await api('/api/roles','PUT',{role:role,reset:true});toast('Dikembalikan ke default');go('roles')})}});
};
VIEWS.meja=async function(v){
  var d=await api('/api/tables');try{await loadScript('/qr.js','qrcode')}catch(e){}
  v.innerHTML=backBtn()+'<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Meja & QR code</h2><button id="add" class="'+BT+'">+ Meja</button></div>'+
   '<div class="bg-amber-50 text-amber-900 rounded-2xl p-3 mb-3 text-sm">Pelanggan scan QR di meja → lihat menu → pesan. Pesanan masuk ke tab <b>Pesanan</b> dengan <b>bunyi alarm keras</b> dan notifikasi Telegram.</div>'+
   (d.tables.length?'<button id="prt" class="'+BP+' w-full mb-3">🖨️ Cetak semua QR ('+d.tables.length+' meja)</button>':'')+
   '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">'+d.tables.map(function(t){return '<div class="bg-white rounded-2xl p-3 text-center '+(t.active?'':'opacity-50')+'"><div class="font-extrabold mb-1">'+esc(t.name)+'</div><div class="mx-auto w-32 h-32 [&>svg]:w-full [&>svg]:h-full">'+qrSvg(t.url,3)+'</div><div class="flex gap-1 mt-2"><button data-open="'+esc(t.url)+'" class="flex-1 text-xs font-bold bg-slate-100 rounded-lg py-2">Coba</button><button data-id="'+t.id+'" class="te flex-1 text-xs font-bold bg-slate-100 rounded-lg py-2">Kelola</button></div></div>'}).join('')+'</div>'+
   (d.tables.length?'':'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada meja. Tap <b>+ Meja</b> untuk membuat beberapa sekaligus.</div>');
  if($('#prt'))$('#prt').onclick=function(){openExternal(d.print_url)};
  $$('[data-open]').forEach(function(b){b.onclick=function(){openExternal(b.dataset.open)}});
  $('#add').onclick=function(){var b=openModal('Tambah meja',field('Jumlah meja sekaligus','count','5','number','min="1" max="60"')+field('Nama awalan','prefix','Meja')+field('Mulai dari nomor','start',String(d.tables.length+1),'number')+'<p class="text-xs text-slate-500 mb-3">Contoh: 5 meja, awalan "Meja", mulai 1 → Meja 1 … Meja 5. Untuk nama khusus (mis. "Teras VIP") isi jumlah 1 lalu ubah namanya.</p><button id="sv" class="'+BP+' w-full">Buat</button>');
    $('#sv').onclick=function(){guard(this,async function(){var f=formData(b);await api('/api/tables','POST',{count:+f.count,prefix:f.prefix,start:+f.start});closeModal();toast('Meja dibuat');go('meja')})}};
  $$('.te').forEach(function(btn){btn.onclick=function(){var t=d.tables.find(function(x){return String(x.id)===btn.dataset.id});var b=openModal(t.name,field('Nama meja','name',t.name)+'<label class="flex items-center gap-2 mb-4 font-semibold"><input type="checkbox" name="active" '+(t.active?'checked':'')+' class="w-5 h-5"> Aktif (bisa dipakai pesan)</label><div class="grid grid-cols-2 gap-2 mb-2"><button id="rg" class="'+BG+'">🔄 Ganti QR</button><button id="dl" class="'+BR+'">Hapus</button></div><p class="text-xs text-slate-500 mb-3">Ganti QR = QR lama tidak berlaku lagi (cetak ulang).</p><button id="sv" class="'+BP+' w-full">Simpan</button>');
    $('#sv').onclick=function(){guard(this,async function(){var f=formData(b);await api('/api/tables/'+t.id,'PUT',{name:f.name,active:f.active});closeModal();go('meja')})};
    $('#rg').onclick=function(){if(!confirm('Ganti QR meja ini?'))return;guard(this,async function(){await api('/api/tables/'+t.id,'PUT',{regen:true});closeModal();toast('QR baru dibuat — cetak ulang');go('meja')})};
    $('#dl').onclick=function(){if(!confirm('Hapus '+t.name+'?'))return;guard(this,async function(){await api('/api/tables/'+t.id,'DELETE');closeModal();go('meja')})}}});
};
VIEWS.printer=async function(v){
  v.innerHTML=backBtn()+'<h2 class="text-xl font-extrabold mb-1">Printer & struk</h2><p class="text-sm text-slate-500 mb-3">Pengaturan disimpan di perangkat ini. Pilih sekali, struk berikutnya langsung tercetak.</p>'+
  '<div class="bg-white rounded-2xl p-4 mb-3" id="pf"><div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cara cetak utama</div><div class="grid gap-2 mb-3">'+PRN_MODES.map(function(m){return '<label class="flex items-center gap-3 rounded-2xl border-2 p-3 '+(PRN.mode===m[0]?'border-amber-600 bg-amber-50':'border-slate-200')+'"><input type="radio" name="mode" value="'+m[0]+'" '+(PRN.mode===m[0]?'checked':'')+' class="w-5 h-5"><span class="text-2xl">'+m[1]+'</span><span><b class="block">'+m[2]+'</b><small class="text-slate-500">'+m[3]+'</small></span></label>'}).join('')+'</div>'+
  selectField('Lebar kertas thermal','paper',[['58','58 mm (32 karakter)'],['80','80 mm (48 karakter)']],PRN.paper)+
  field('Jumlah salinan','copies',PRN.copies,'number','min="1" max="5"')+
  '<label class="flex items-center gap-2 mb-2 font-semibold"><input type="checkbox" name="auto" '+(PRN.auto?'checked':'')+' class="w-5 h-5"> Cetak struk otomatis setelah bayar</label>'+
  '<label class="flex items-center gap-2 mb-4 font-semibold"><input type="checkbox" name="kitchen" '+(PRN.kitchen?'checked':'')+' class="w-5 h-5"> Cetak order dapur otomatis saat pesanan meja diterima</label>'+
  '<button id="sv" class="'+BP+' w-full">Simpan</button></div>'+
  '<div class="bg-white rounded-2xl p-4 mb-3"><div class="font-extrabold mb-2">🧪 Cetak tes</div><div class="flex flex-wrap gap-2">'+PRN_MODES.map(function(m){return '<button data-t="'+m[0]+'" class="'+BG+'">'+m[1]+' '+m[2].split(' (')[0]+'</button>'}).join('')+'</div></div>'+
  '<div class="bg-white rounded-2xl p-4 mb-3 text-sm text-slate-600 space-y-2"><div class="font-extrabold text-slate-900">Panduan singkat</div><p><b>Printer thermal Bluetooth (paling umum):</b> pasang aplikasi gratis <a class="text-amber-700 font-bold" href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank">RawBT</a>, sambungkan printer sekali di RawBT, lalu pilih mode RawBT di sini.</p><p><b>Bluetooth langsung (BLE):</b> buka JCOFFE di Google Chrome, pilih mode BLE, tap Cetak tes, lalu pilih printer.</p><p><b>Printer PC / USB:</b> buka di laptop/PC, pilih "Printer PC" — dialog cetak muncul, pilih printer thermal atau biasa.</p><p><b>Struk ke pelanggan:</b> tombol 💬 WA mengirim struk + link struk digital.</p>'+(PRN.bleName?'<p>Printer BLE terakhir: <b>'+esc(PRN.bleName)+'</b></p>':'')+'</div>';
  function read(){var f=formData($('#pf'));var r=$('input[name=mode]:checked');PRN.mode=r?r.value:PRN.mode;PRN.paper=+f.paper;PRN.copies=Math.max(1,Math.min(5,+f.copies||1));PRN.auto=!!f.auto;PRN.kitchen=!!f.kitchen;PRN.set=true;prnSave()}
  $$('input[name=mode]').forEach(function(r){r.onchange=function(){read();VIEWS.printer(v)}});
  $('#sv').onclick=function(){read();toast('Pengaturan printer disimpan')};
  $$('[data-t]').forEach(function(b){b.onclick=function(){read();printLines(testLines(),b.dataset.t,{trx:{code:'TES-PRINT',created_at:new Date().toISOString(),cashier:'Kasir',pay_method:'Tunai',items:[{name:'Kopi Susu Gula Aren',qty:2,price:15000,subtotal:30000}],subtotal:30000,discount:0,total:30000,paid:50000,change_amt:20000}})}});
};
VIEWS.profil=async function(v){
  var s=S.me.store;
  v.innerHTML=backBtn()+'<h2 class="text-xl font-extrabold mb-3">Profil toko</h2><div id="pf" class="bg-white rounded-2xl p-4">'+field('Nama toko','name',s.name)+field('Nama pemilik','owner_name',s.owner_name)+field('No. WhatsApp','phone',s.phone,'tel')+field('Alamat (tampil di struk)','address',s.address)+field('Catatan bawah struk','receipt_note',s.receipt_note,'text','placeholder="Terima kasih, datang lagi ya!"')+'<button id="sv" class="'+BP+' w-full">Simpan</button></div>';
  $('#sv').onclick=function(){guard(this,async function(){await api('/api/store','PUT',formData($('#pf')));S.me=await api('/api/me');renderShell();toast('Profil disimpan');go('lainnya')})};
};
VIEWS.telegram=async function(v){
  S.me=await api('/api/me');var on=S.me.store.tg_connected;
  v.innerHTML=backBtn()+'<h2 class="text-xl font-extrabold mb-3">Bot Telegram</h2><div class="bg-white rounded-2xl p-5">'+
   '<div class="text-4xl mb-2">🤖</div><div class="font-extrabold text-lg">@'+esc(S.me.bot_username)+'</div><div class="mb-4 font-bold '+(on?'text-emerald-600':'text-slate-400')+'">'+(on?'✅ Terhubung ke toko ini':'Belum terhubung')+'</div>'+
   '<ul class="text-sm text-slate-600 space-y-1 mb-5"><li>• Notifikasi setiap transaksi + stok menipis</li><li>• Notifikasi pesanan QR meja</li><li>• Laporan harian otomatis jam 21:00 WITA</li><li>• Perintah: /omzet, /omzet bulan, /laris, /stok, /transaksi</li></ul>'+
   '<div id="code"></div><div class="flex flex-wrap gap-2"><button id="cn" class="'+BT+'">'+(on?'Hubungkan ulang':'Hubungkan Telegram')+'</button>'+(on?'<button id="ts" class="'+BG+'">Kirim tes</button><button id="dc" class="'+BR+'">Putuskan</button>':'')+'</div></div>';
  $('#cn').onclick=function(){guard(this,async function(){var d=await api('/api/store/telegram','POST',{});
    $('#code').innerHTML='<div class="bg-slate-50 rounded-2xl p-4 mb-4 text-sm"><p class="mb-2">1. Tap tombol di bawah untuk membuka bot, lalu tekan <b>START</b>.</p><a href="'+esc(d.link)+'" target="_blank" class="block text-center bg-sky-500 text-white font-bold rounded-xl py-3 mb-3">Buka @'+esc(d.bot)+'</a><p>Atau kirim manual ke bot: <b class="font-mono select-all">/start '+esc(d.code)+'</b></p></div>'})};
  if(on){$('#ts').onclick=function(){guard(this,async function(){await api('/api/store/telegram/test','POST',{});toast('Pesan tes terkirim')})};
    $('#dc').onclick=function(){if(!confirm('Putuskan Telegram?'))return;guard(this,async function(){await api('/api/store/telegram','DELETE');go('telegram')})}}
};
init();
`, { print: true });

// ---------------------------------------------------------------- ADMIN (Head Admin)
const ADMIN_HTML = page('Head Admin', `<div id="root"><div class="min-h-screen flex items-center justify-center text-slate-400">Memuat…</div></div>`, String.raw`
var A={tab:'ringkasan',filter:'semua',q:'',stores:[]};
var LABEL={trial:'bg-amber-100 text-amber-800',aktif:'bg-emerald-100 text-emerald-800',expired:'bg-slate-200 text-slate-600',diblokir:'bg-red-100 text-red-700'};
async function init(){
  A.me=await api('/api/me');
  $('#root').innerHTML='<header class="sticky top-0 z-30 bg-[#1c0f0a] text-white px-4 py-3 flex items-center gap-3 shadow"><img src="/icon-192.png" class="w-9 h-9 rounded-xl"><div class="flex-1"><div class="font-extrabold">JCOFFE Head Admin</div><div class="text-[11px] text-amber-200/70">@'+esc(A.me.user.username)+'</div></div><button onclick="logout()" class="text-sm font-bold bg-white/10 rounded-xl px-3 py-2">Keluar</button></header>'+
   (A.me.user.must_change?'<div class="bg-amber-400 text-slate-900 text-sm font-bold px-4 py-2 text-center">⚠️ Kamu masih memakai password default. <button onclick="pwModal(true)" class="underline">Ganti sekarang</button></div>':'')+
   '<main id="view" class="max-w-6xl mx-auto p-4 pb-32"></main><nav class="fixed bottom-0 inset-x-0 z-30 bg-white border-t pb-safe"><div class="max-w-md mx-auto flex">'+
   [['ringkasan','Ringkasan','📊'],['toko','Toko','🏪'],['lisensi','Lisensi','🔑'],['pesan','Pesan','📨'],['setting','Atur','⚙️']].map(function(n){return '<button data-tab="'+n[0]+'" class="nav relative flex-1 pt-2 pb-1 flex flex-col items-center text-[11px] font-bold text-slate-400"><span class="text-xl">'+n[2]+'</span>'+n[1]+(n[0]==='pesan'?'<span id="msgBadge" class="hidden absolute top-1 right-1/4 bg-red-600 text-white text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center"></span>':'')+'</button>'}).join('')+'</div></nav>';
  $$('.nav').forEach(function(b){b.onclick=function(){go(b.dataset.tab)}});
  if(A.me.user.must_change)setTimeout(function(){pwModal(true)},400);
  go('ringkasan');refreshBadge();setInterval(refreshBadge,30000);
}
async function refreshBadge(){try{var d=await api('/api/admin/support');var b=$('#msgBadge');b.textContent=d.unread;b.classList.toggle('hidden',!d.unread);b.classList.toggle('flex',!!d.unread)}catch(e){}}
function go(t){A.tab=t;$$('.nav').forEach(function(b){var on=b.dataset.tab===t;b.classList.toggle('text-amber-700',on);b.classList.toggle('text-slate-400',!on)});var v=$('#view');v.innerHTML='<div class="text-center text-slate-400 py-10">Memuat…</div>';
  Promise.resolve({ringkasan:vRing,toko:vToko,lisensi:vLis,pesan:vPesan,setting:vSet}[t](v)).catch(function(e){v.innerHTML='<div class="bg-red-50 text-red-600 rounded-2xl p-4">'+esc(e.message)+'</div>'})}
function badge(l){return '<span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full '+(LABEL[l]||'')+'">'+l.toUpperCase()+'</span>'}
function waNum(p){return String(p||'').replace(/[^0-9]/g,'').replace(/^0/,'62')}

async function vRing(v){
  var r=await Promise.all([api('/api/admin/stats'),api('/api/admin/stores')]);var s=r[0];A.stores=r[1].stores;
  function card(l,val,cls){return '<div class="bg-white rounded-2xl p-4"><div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">'+l+'</div><div class="text-2xl font-extrabold mt-1 '+(cls||'')+'">'+val+'</div></div>'}
  var soon=A.stores.filter(function(x){return (x.status_label==='trial'||x.status_label==='aktif')&&x.days_left<=3});
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Ringkasan Platform</h2><div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">'+
   card('Total toko',s.stores)+card('Trial',s.trial,'text-amber-600')+card('Aktif (bayar)',s.active,'text-emerald-700')+card('Expired',s.expired,'text-slate-500')+card('Diblokir',s.blocked,'text-red-600')+card('Total user',s.users)+card('Trx hari ini',s.trxToday)+card('Omzet hari ini',rp(s.omzetToday),'text-amber-800 text-lg')+'</div>'+
   '<div class="bg-white rounded-2xl p-4 mb-3"><div class="font-extrabold mb-2">Transaksi semua toko (14 hari)</div><div class="h-52"><canvas id="ch"></canvas></div></div>'+
   '<div class="grid lg:grid-cols-2 gap-3"><div class="bg-white rounded-2xl p-4"><div class="font-extrabold mb-2">⏳ Akan habis ≤ 3 hari ('+soon.length+')</div>'+(soon.length?soon.map(row).join(''):'<div class="text-sm text-slate-400">Tidak ada</div>')+'</div>'+
   '<div class="bg-white rounded-2xl p-4"><div class="font-extrabold mb-2">🆕 Toko terbaru</div>'+(A.stores.slice(0,6).map(row).join('')||'<div class="text-sm text-slate-400">Belum ada toko</div>')+'</div></div>';
  $$('.srow').forEach(function(b){b.onclick=function(){storeModal(A.stores.find(function(x){return String(x.id)===b.dataset.id}))}});
  try{await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js','Chart');
   new Chart($('#ch'),{type:'bar',data:{labels:s.daily.map(function(x){return x.d.slice(5)}),datasets:[{label:'Transaksi',data:s.daily.map(function(x){return x.n}),backgroundColor:'#b45309',borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}}}})}catch(e){}
}
function row(x){return '<button data-id="'+x.id+'" class="srow w-full text-left flex items-center justify-between py-2 border-b last:border-0"><div class="min-w-0"><div class="font-bold text-sm truncate">'+esc(x.name)+'</div><div class="text-xs text-slate-500">'+esc(x.owner_name||'-')+' · daftar '+fmtD(x.created_at)+'</div></div><div class="text-right">'+badge(x.status_label)+'<div class="text-xs text-slate-500 mt-1">'+(x.status_label==='trial'||x.status_label==='aktif'?'sisa '+x.days_left+' hr':'')+'</div></div></button>'}

async function vToko(v){
  A.stores=(await api('/api/admin/stores')).stores;
  var counts={semua:A.stores.length};A.stores.forEach(function(s){counts[s.status_label]=(counts[s.status_label]||0)+1});
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Toko & User</h2><input id="q" value="'+esc(A.q)+'" placeholder="🔍 Cari nama toko / pemilik / no WA / username" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 mb-3 bg-white">'+
   '<div class="flex gap-2 overflow-x-auto no-scrollbar mb-3">'+['semua','trial','aktif','expired','diblokir'].map(function(f){return '<button data-f="'+f+'" class="flt whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold '+(A.filter===f?'bg-slate-900 text-white':'bg-white')+'">'+f.charAt(0).toUpperCase()+f.slice(1)+' ('+(counts[f]||0)+')</button>'}).join('')+'</div><div id="sl" class="grid lg:grid-cols-2 gap-3"></div>';
  $('#q').oninput=function(){A.q=this.value;list()};$$('.flt').forEach(function(b){b.onclick=function(){A.filter=b.dataset.f;vToko(v)}});list();
  function list(){var q=A.q.toLowerCase();var rows=A.stores.filter(function(s){return (A.filter==='semua'||s.status_label===A.filter)&&(!q||[s.name,s.owner_name,s.phone,s.owner_username].join(' ').toLowerCase().indexOf(q)>=0)});
    $('#sl').innerHTML=rows.length?rows.map(function(s){return '<button data-id="'+s.id+'" class="sc text-left bg-white rounded-2xl p-4"><div class="flex justify-between items-start gap-2 mb-2"><div class="min-w-0"><div class="font-extrabold truncate">'+esc(s.name)+'</div><div class="text-xs text-slate-500">'+esc(s.owner_name||'-')+' · @'+esc(s.owner_username||'-')+' · '+esc(s.phone||'-')+'</div></div>'+badge(s.status_label)+'</div>'+
      '<div class="grid grid-cols-4 gap-2 text-center text-xs"><div class="bg-slate-50 rounded-xl py-2"><b class="block text-sm">'+(s.status_label==='trial'||s.status_label==='aktif'?s.days_left:0)+'</b>hari</div><div class="bg-slate-50 rounded-xl py-2"><b class="block text-sm">'+s.users+'</b>user</div><div class="bg-slate-50 rounded-xl py-2"><b class="block text-sm">'+s.trx_all+'</b>trx</div><div class="bg-slate-50 rounded-xl py-2"><b class="block text-sm">'+(s.tg_chat_id?'✅':'—')+'</b>TG</div></div>'+
      '<div class="text-xs text-slate-500 mt-2">Omzet 30 hr: <b>'+rp(s.omzet30)+'</b> · aktif terakhir '+fmtDT(s.last_trx||s.last_login)+'</div></button>'}).join(''):'<div class="text-center text-slate-400 py-8 col-span-full">Tidak ada toko</div>';
    $$('.sc').forEach(function(b){b.onclick=function(){storeModal(A.stores.find(function(x){return String(x.id)===b.dataset.id}))}})}
}
function storeModal(s){
  var b=openModal(s.name,'<div class="text-sm space-y-1 mb-4"><div>Status: '+badge(s.status_label)+'</div><div>Pemilik: <b>'+esc(s.owner_name||'-')+'</b> (@'+esc(s.owner_username||'-')+')</div><div>WA: <b>'+esc(s.phone||'-')+'</b></div><div>Daftar: '+fmtDT(s.created_at)+'</div><div>Trial s/d: '+fmtD(s.trial_end)+'</div><div>Langganan s/d: '+(s.paid_until?fmtD(s.paid_until):'-')+'</div><div>Berakhir efektif: <b>'+(s.end?fmtD(s.end):'-')+'</b></div></div>'+
   (s.phone?'<a target="_blank" href="https://wa.me/'+esc(waNum(s.phone))+'" class="block text-center bg-green-600 text-white rounded-xl py-2.5 font-bold mb-3">💬 Chat WhatsApp pemilik</a>':'')+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Trial</div><div class="grid grid-cols-3 gap-2 mb-3"><button data-a="extend_trial" data-d="3" class="act '+BG+'">+3 hari</button><button data-a="extend_trial" data-d="7" class="act '+BG+'">+7 hari</button><button data-a="extend_trial" data-d="14" class="act '+BG+'">+14 hari</button></div>'+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Langganan berbayar</div><div class="grid grid-cols-4 gap-2 mb-3"><button data-a="extend_paid" data-d="30" class="act '+BT+'">1 bln</button><button data-a="extend_paid" data-d="90" class="act '+BT+'">3 bln</button><button data-a="extend_paid" data-d="180" class="act '+BT+'">6 bln</button><button data-a="extend_paid" data-d="365" class="act '+BT+'">1 thn</button></div>'+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Kontrol</div><div class="grid grid-cols-2 gap-2 mb-3">'+(s.status==='blocked'?'<button data-a="unblock" class="act '+BT+'">🔓 Buka blokir</button>':'<button data-a="block" class="act '+BR+'">🔒 Blokir</button>')+'<button data-a="end_now" class="act '+BG+'">⏹ Hentikan masa aktif</button><button id="rst" class="'+BG+'">🔑 Reset password owner</button><button id="del" class="'+BR+'">🗑 Hapus toko</button></div><div id="out"></div>');
  $$('.act',b).forEach(function(x){x.onclick=function(){if((x.dataset.a==='block'||x.dataset.a==='end_now')&&!confirm('Yakin?'))return;guard(x,async function(){var d=await api('/api/admin/stores/'+s.id,'PUT',{action:x.dataset.a,days:+x.dataset.d||0});closeModal();toast(d.note);go(A.tab)})}});
  $('#rst').onclick=function(){if(!confirm('Reset password owner toko ini?'))return;guard(this,async function(){var d=await api('/api/admin/stores/'+s.id+'/reset-owner','POST',{});$('#out').innerHTML='<div class="bg-amber-50 rounded-xl p-3 text-sm">Username: <b>'+esc(d.username)+'</b><br>Password baru: <b class="font-mono select-all">'+esc(d.password)+'</b><br><span class="text-xs text-slate-500">Kirim ke pemilik toko. Ia akan diminta ganti password.</span></div>'})};
  $('#del').onclick=function(){var n=prompt('Semua data toko akan DIHAPUS PERMANEN. Ketik nama toko persis untuk konfirmasi:\n'+s.name);if(n===null)return;guard(this,async function(){await api('/api/admin/stores/'+s.id,'DELETE',{confirm:n});closeModal();toast('Toko dihapus');go(A.tab)})};
}
var LIC_C={baru:'bg-sky-100 text-sky-800',terjual:'bg-amber-100 text-amber-800',terpakai:'bg-emerald-100 text-emerald-800',dicabut:'bg-red-100 text-red-700'};
function dLabel(d){return d%365===0?(d/365)+' thn':d%30===0?(d/30)+' bln':d+' hr'}
async function vLis(v){
  A.lf=A.lf||'';A.lq=A.lq||'';
  var r=await Promise.all([api('/api/admin/licenses?status='+A.lf+'&q='+encodeURIComponent(A.lq)),api('/api/admin/lynk')]);var d=r[0],L=r[1],c=d.counts;A.lic=d.licenses;
  function card(l,val,cls){return '<div class="bg-white rounded-2xl p-3"><div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">'+l+'</div><div class="text-2xl font-extrabold '+cls+'">'+(val||0)+'</div></div>'}
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Lisensi Serial Number</h2>'+
   '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">'+card('Stok (belum terjual)',c.baru,'text-sky-700')+card('Terjual',c.terjual,'text-amber-700')+card('Sudah dipakai',c.terpakai,'text-emerald-700')+card('Dicabut',c.dicabut,'text-red-600')+'</div>'+
   ((c.baru||0)<5?'<div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3 text-sm mb-3">⚠️ Stok SN tinggal <b>'+(c.baru||0)+'</b>. Generate lagi (webhook Lynk tetap membuat SN otomatis bila stok habis).</div>':'')+
   '<div class="grid lg:grid-cols-2 gap-3 mb-3"><div class="bg-white rounded-2xl p-4" id="gf"><div class="font-extrabold mb-3">➕ Generate serial number</div><div class="grid grid-cols-2 gap-2">'+field('Jumlah SN','count','10','number','min="1" max="500"')+selectField('Masa aktif','days',[['30','1 bulan'],['90','3 bulan'],['180','6 bulan'],['365','1 tahun']],'90')+'</div>'+field('Nama batch (opsional)','batch','','text','placeholder="mis. Lynk Desember"')+'<button id="gen" class="'+BP+' w-full">Generate</button></div>'+
   '<div class="bg-white rounded-2xl p-4" id="lk"><div class="font-extrabold mb-1">🔗 Integrasi Lynk.id</div><p class="text-xs text-slate-500 mb-3">Setiap pembayaran sukses di Lynk.id otomatis mengambil 1 SN untuk pembeli, lalu kamu dapat notifikasi Telegram + tombol kirim WA.</p>'+
   '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Webhook URL (tempel di Lynk.id)</div><div class="flex gap-2 mb-3 mt-1"><input readonly value="'+esc(L.webhook_url)+'" class="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-slate-50"><button id="cpw" class="'+BG+'">Salin</button></div>'+
   field('Link produk lisensi di Lynk.id','lynk_url',L.lynk_url,'url','placeholder="https://lynk.id/namakamu/xxxx"')+'<div class="grid grid-cols-2 gap-2">'+field('Kata kunci produk','keyword',L.keyword,'text','placeholder="JCOFFE"')+selectField('Masa aktif default','days',[['30','1 bulan'],['90','3 bulan'],['180','6 bulan'],['365','1 tahun']],String(L.days))+'</div>'+
   '<p class="text-xs text-slate-500 mb-3">Kata kunci: hanya produk Lynk yang judulnya mengandung kata ini yang diberi SN (kosongkan = semua produk). Judul berisi “6 bulan” / “1 tahun” otomatis memakai masa itu.</p>'+
   '<div class="flex flex-wrap gap-2"><button id="svl" class="'+BP+'">Simpan</button><button id="cpk" class="'+BG+'">Salin link klaim</button><button id="cpb" class="'+BG+'">Salin link beli</button><button id="rtk" class="'+BG+'">Ganti token</button></div>'+
   (L.logs.length?'<details class="mt-3"><summary class="text-sm font-bold cursor-pointer">Log webhook ('+L.logs.length+')</summary>'+L.logs.map(function(g){return '<button data-lg="'+g.id+'" class="block w-full text-left text-xs py-1.5 border-b"><b>'+fmtDT(g.created_at)+'</b> · '+esc(g.ref||'-')+'<br><span class="text-slate-500">'+esc(g.result)+'</span></button>'}).join('')+'</details>':'<p class="text-xs text-slate-400 mt-3">Belum ada panggilan webhook.</p>')+'</div></div>'+
   '<div class="bg-white rounded-2xl p-4"><div class="flex flex-wrap gap-2 items-center mb-3"><input id="lq" value="'+esc(A.lq)+'" placeholder="🔍 Cari SN / pembeli / email / toko / batch" class="flex-1 min-w-[200px] border border-slate-200 rounded-xl px-3 py-2.5"><button id="cpa" class="'+BG+'">📋 Salin SN</button><a href="/api/admin/licenses?format=csv&status='+A.lf+'&q='+encodeURIComponent(A.lq)+'" class="'+BG+'">⬇️ CSV</a></div>'+
   '<div class="flex gap-2 overflow-x-auto no-scrollbar mb-3">'+[['','Semua'],['baru','Stok'],['terjual','Terjual'],['terpakai','Terpakai'],['dicabut','Dicabut']].map(function(f){return '<button data-lf="'+f[0]+'" class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold '+(A.lf===f[0]?'bg-slate-900 text-white':'bg-slate-100')+'">'+f[1]+'</button>'}).join('')+'</div>'+
   (A.lic.length?'<div class="divide-y">'+A.lic.map(function(l){return '<button data-li="'+l.id+'" class="w-full text-left py-2.5 flex items-center gap-3"><div class="flex-1 min-w-0"><div class="font-mono font-bold tracking-wide">'+esc(l.code)+'</div><div class="text-xs text-slate-500 truncate">'+dLabel(l.days)+' · '+esc(l.store_name?'🏪 '+l.store_name:l.buyer_name||l.buyer_email?'👤 '+(l.buyer_name||'')+' '+(l.buyer_email||''):l.batch||'')+'</div></div><span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full '+LIC_C[l.status]+'">'+l.status.toUpperCase()+'</span></button>'}).join('')+'</div>':'<div class="text-center text-slate-400 py-6">Belum ada serial number. Generate dulu di atas.</div>')+'</div>';
  $('#gen').onclick=function(){guard(this,async function(){var r=await api('/api/admin/licenses','POST',formData($('#gf')));var t=r.codes.join('\n');
    var b=openModal('✅ '+r.codes.length+' SN dibuat ('+dLabel(r.days)+')','<textarea readonly rows="10" class="w-full border rounded-xl p-3 font-mono text-sm mb-3">'+esc(t)+'</textarea><div class="grid grid-cols-2 gap-2"><button id="c1" class="'+BP+'">📋 Salin semua</button><button id="c2" class="'+BG+'">⬇️ Unduh .txt</button></div><p class="text-xs text-slate-500 mt-3">SN berstatus <b>Stok</b>. Saat ada pembelian di Lynk.id, webhook otomatis mengambil SN dari stok ini.</p>');
    $('#c1',b).onclick=function(){copyText(t,r.codes.length+' SN disalin')};
    $('#c2',b).onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'}));a.download='SN-JCOFFE-'+r.batch.replace(/[^A-Za-z0-9-]+/g,'_')+'.txt';a.click()};
    vLis(v)})};
  $('#cpw').onclick=function(){copyText(L.webhook_url,'Webhook URL disalin')};
  $('#cpk').onclick=function(){copyText(L.claim_url,'Link klaim disalin')};
  $('#cpb').onclick=function(){copyText(L.buy_short,'Link beli disalin')};
  $('#svl').onclick=function(){guard(this,async function(){await api('/api/admin/lynk','PUT',formData($('#lk')));toast('Pengaturan Lynk disimpan');vLis(v)})};
  $('#rtk').onclick=function(){if(!confirm('Ganti token? URL webhook lama tidak berlaku lagi, perbarui di Lynk.id.'))return;guard(this,async function(){await api('/api/admin/lynk/token','POST',{});vLis(v)})};
  $$('[data-lg]').forEach(function(b){b.onclick=function(){guard(b,async function(){var g=await api('/api/admin/lynk/log/'+b.dataset.lg);var pl=g.payload||'';try{pl=JSON.stringify(JSON.parse(pl),null,2)}catch(e){}openModal('Log webhook','<div class="text-sm mb-2"><b>'+esc(g.result||'')+'</b></div><pre class="text-[11px] bg-slate-50 rounded-xl p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap">'+esc(pl)+'</pre>')})}});
  var tq;$('#lq').oninput=function(){var val=this.value;clearTimeout(tq);tq=setTimeout(function(){A.lq=val;vLis(v).then(function(){var i=$('#lq');i.focus();i.setSelectionRange(val.length,val.length)})},450)};
  $$('[data-lf]').forEach(function(b){b.onclick=function(){A.lf=b.dataset.lf;vLis(v)}});
  $('#cpa').onclick=function(){if(!A.lic.length)return toast('Tidak ada SN');copyText(A.lic.map(function(l){return l.code}).join('\n'),A.lic.length+' SN disalin')};
  $$('[data-li]').forEach(function(b){b.onclick=function(){licModal(A.lic.find(function(x){return String(x.id)===b.dataset.li}),v)}});
}
function licModal(l,v){
  var info=[['Status','<span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full '+LIC_C[l.status]+'">'+l.status.toUpperCase()+'</span>'],['Masa aktif',dLabel(l.days)],['Batch',esc(l.batch||'-')],['Dibuat',fmtDT(l.created_at)]];
  if(l.sold_at)info.push(['Pembeli',esc((l.buyer_name||'-')+' · '+(l.buyer_phone||'-'))],['Email',esc(l.buyer_email||'-')],['Order Lynk',esc(l.order_ref||'-')],['Terjual',fmtDT(l.sold_at)]);
  if(l.used_at)info.push(['Dipakai toko','<b>'+esc(l.store_name||'-')+'</b>'],['Oleh',esc(l.used_by||'-')],['Tanggal',fmtDT(l.used_at)]);
  var canSell=l.status==='baru'||l.status==='terjual';
  var b=openModal(l.code,'<div class="text-sm divide-y mb-4">'+info.map(function(i){return '<div class="flex justify-between gap-3 py-1.5"><span class="text-slate-500">'+i[0]+'</span><span class="text-right">'+i[1]+'</span></div>'}).join('')+'</div>'+
   '<button id="cp" class="'+BG+' w-full mb-3">📋 Salin serial number</button>'+
   (canSell?'<div id="sf" class="bg-amber-50 rounded-2xl p-3 mb-3"><div class="font-extrabold text-sm mb-2">📲 Kirim ke pembeli (manual)</div>'+field('Nama pembeli','buyer_name',l.buyer_name||'')+field('No. WhatsApp','buyer_phone',l.buyer_phone||'','tel','placeholder="08xxxxxxxxxx"')+field('Email (untuk halaman klaim)','buyer_email',l.buyer_email||'','email')+field('No. order Lynk (opsional)','order_ref',l.order_ref||'')+'<button id="sell" class="w-full bg-green-600 text-white rounded-xl py-3 font-bold">Tandai terjual & kirim WA</button></div>':'')+
   '<div class="grid grid-cols-2 gap-2">'+(l.status==='terjual'?'<button data-x="unsell" class="'+BG+'">↩️ Kembalikan ke stok</button>':'')+(canSell?'<button data-x="revoke" class="'+BR+'">⛔ Cabut SN</button>':'')+(l.status==='dicabut'?'<button data-x="restore" class="'+BG+'">♻️ Pulihkan</button>':'')+'</div>');
  $('#cp',b).onclick=function(){copyText(l.code,'SN disalin')};
  if($('#sell',b))$('#sell',b).onclick=function(){var f=formData($('#sf',b));if(!f.buyer_phone&&!f.buyer_email){toast('Isi WA atau email pembeli',true);return}
    guard(this,async function(){var d=await api('/api/admin/licenses/'+l.id,'PUT',Object.assign({action:'sell'},f));closeModal();toast('SN ditandai terjual');if(d.wa_link)window.open(d.wa_link,'_blank');else copyText(d.message,'Pesan untuk pembeli disalin');vLis(v)})};
  $$('[data-x]',b).forEach(function(x){x.onclick=function(){if(x.dataset.x==='revoke'&&!confirm('Cabut SN ini? SN tidak bisa dipakai aktivasi.'))return;guard(x,async function(){await api('/api/admin/licenses/'+l.id,'PUT',{action:x.dataset.x});closeModal();toast('Berhasil');vLis(v)})}});
}
async function vPesan(v){
  var d=await api('/api/admin/support');
  v.innerHTML='<div class="flex justify-between items-center mb-3"><h2 class="text-xl font-extrabold">Pesan dari toko</h2>'+(d.unread?'<button id="ra" class="'+BG+'">Tandai semua dibaca</button>':'')+'</div>'+
   (d.messages.length?d.messages.map(function(m){var s=A.stores.find(function(x){return x.id===m.store_id})||{};return '<div class="bg-white rounded-2xl p-4 mb-2 '+(m.is_read?'':'ring-2 ring-amber-400')+'"><div class="flex justify-between gap-2"><div><div class="font-extrabold">'+esc(m.store_name)+'</div><div class="text-xs text-slate-500">'+esc(m.user_name)+' · '+fmtDT(m.created_at)+'</div></div><span class="text-[11px] font-bold bg-slate-100 rounded-full px-2 py-1 h-fit">'+esc(m.category)+'</span></div><p class="text-sm mt-2 whitespace-pre-line">'+esc(m.message)+'</p><div class="flex gap-2 mt-3">'+(s.phone?'<a target="_blank" href="https://wa.me/'+esc(waNum(s.phone))+'" class="'+B+' bg-green-600 text-white">💬 Balas WA</a>':'')+(m.is_read?'':'<button data-r="'+m.id+'" class="'+BG+'">Tandai dibaca</button>')+'</div></div>'}).join(''):'<div class="bg-white rounded-2xl p-6 text-center text-slate-500">Belum ada pesan. Pesan dari tombol 💬 di aplikasi toko akan muncul di sini (dan di Telegram admin).</div>');
  if(!A.stores.length)try{A.stores=(await api('/api/admin/stores')).stores}catch(e){}
  if($('#ra'))$('#ra').onclick=function(){guard(this,async function(){await api('/api/admin/support/read-all','POST',{});refreshBadge();vPesan(v)})};
  $$('[data-r]').forEach(function(b){b.onclick=function(){guard(b,async function(){await api('/api/admin/support/'+b.dataset.r,'PUT',{});refreshBadge();vPesan(v)})}});
}
async function vSet(v){
  var s=await api('/api/admin/settings');var link='https://t.me/'+s.bot_username+'?start='+s.admin_link_code;
  v.innerHTML='<h2 class="text-xl font-extrabold mb-3">Pengaturan</h2>'+
  '<div class="bg-white rounded-2xl p-4 mb-3" id="gen"><div class="font-extrabold mb-3">Info untuk toko</div>'+field('No. WhatsApp Head Admin (628xxx)','admin_wa',s.admin_wa,'tel')+'<label class="block mb-3"><span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Teks harga langganan</span><textarea name="price_text" rows="3" class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" placeholder="Paket bulanan Rp 50.000 / Tahunan Rp 500.000">'+esc(s.price_text)+'</textarea></label><button id="sv" class="'+BP+' w-full">Simpan</button></div>'+
  '<div class="bg-white rounded-2xl p-4 mb-3" id="apkf"><div class="font-extrabold mb-1">📲 Update aplikasi (APK)</div><p class="text-xs text-slate-500 mb-3">Pengguna APK versi lama akan melihat tombol Update. Kosongkan untuk memakai bawaan (v'+s.apk.version+').</p>'+field('Versi terbaru','apk_version',s.apk.version,'number')+field('Link unduh APK','apk_url',s.apk.url)+field('Catatan rilis','apk_notes',s.apk.notes)+'<button id="sva" class="'+BP+' w-full">Simpan info APK</button></div>'+
  '<div class="bg-white rounded-2xl p-4 mb-3"><div class="font-extrabold mb-2">🤖 Bot Telegram @'+esc(s.bot_username)+'</div><div class="text-sm space-y-1 mb-3"><div>Token bot: '+(s.tg_token_set?'✅ terpasang':'❌ belum diisi')+'</div><div>Webhook: '+(s.tg_webhook?'✅ '+esc(s.tg_webhook):'❌ belum dipasang')+'</div><div>Chat admin: '+(s.tg_admin_linked?'✅ terhubung':'❌ belum')+'</div></div>'+
  (s.tg_token_from_secret?'':'<div id="tkf" class="bg-slate-50 rounded-xl p-3 mb-3">'+field('Token bot dari @BotFather','token','','text','autocapitalize="none" autocomplete="off" placeholder="123456789:AAH..."')+'<button id="tks" class="'+BT+' w-full">'+(s.tg_token_set?'Ganti token & aktifkan ulang':'1. Simpan token & aktifkan bot')+'</button></div>')+
  '<div class="flex flex-wrap gap-2 mb-3"><a href="'+esc(link)+'" target="_blank" class="'+B+' bg-sky-500 text-white">2. Hubungkan chat admin</a><button id="wh" class="'+BG+'">Pasang ulang webhook</button><button id="tt" class="'+BG+'">Kirim tes</button><button id="rd" class="'+BG+'">Kirim laporan harian sekarang</button></div>'+
  '<div class="text-xs text-slate-500">Kode admin manual: <b class="font-mono select-all">/start '+esc(s.admin_link_code)+'</b><br>'+esc(s.cron_hint)+'</div></div>'+
  '<div class="bg-white rounded-2xl p-4 mb-3"><div class="font-extrabold mb-2">Akun & tautan</div><div class="flex flex-wrap gap-2"><button id="cp" class="'+BP+'">🔑 Ganti password</button><a href="/promo" target="_blank" class="'+BG+'">🌐 Halaman promo</a></div></div>';
  $('#sv').onclick=function(){guard(this,async function(){await api('/api/admin/settings','PUT',formData($('#gen')));toast('Tersimpan')})};
  $('#sva').onclick=function(){guard(this,async function(){await api('/api/admin/settings','PUT',formData($('#apkf')));toast('Info APK disimpan')})};
  $('#wh').onclick=function(){guard(this,async function(){await api('/api/admin/telegram/setup','POST',{});toast('Webhook terpasang');go('setting')})};
  if($('#tks'))$('#tks').onclick=function(){guard(this,async function(){var d=await api('/api/admin/telegram/token','POST',formData($('#tkf')));toast('Bot @'+d.bot_username+' aktif ✅');go('setting')})};
  $('#tt').onclick=function(){guard(this,async function(){await api('/api/admin/telegram/test','POST',{});toast('Tes terkirim')})};
  $('#rd').onclick=function(){guard(this,async function(){await api('/api/admin/run-daily','POST',{});toast('Laporan dikirim')})};
  $('#cp').onclick=function(){pwModal(false)};
}
init();
`);

// ---------------------------------------------------------------- halaman pelanggan: pesan dari QR meja
const ORDER_HTML = page('Pesan dari meja', `<div id="root" class="max-w-xl mx-auto"><div class="min-h-screen flex items-center justify-center text-slate-400">Memuat menu…</div></div>`, String.raw`
var T=location.pathname.split('/').pop(),O={menu:[],cart:{},cat:'Semua'};
var KEY='jc_order_'+T;
function saveOrd(id){try{localStorage.setItem(KEY,JSON.stringify({id:id,t:Date.now()}))}catch(e){}}
function lastOrd(){try{var o=JSON.parse(localStorage.getItem(KEY)||'null');if(o&&Date.now()-o.t<3*3600000)return o}catch(e){}return null}
async function init(){
  try{var d=await api('/api/public/menu?t='+T)}catch(e){$('#root').innerHTML='<div class="min-h-screen flex flex-col items-center justify-center p-8 text-center"><div class="text-5xl mb-3">😕</div><div class="font-extrabold text-lg">'+esc(e.message)+'</div></div>';return}
  O.store=d.store;O.table=d.table;O.menu=d.menu;
  var lo=lastOrd();if(lo){showStatus(lo.id);return}
  render();
}
function render(){
  var cats=['Semua'].concat(Array.from(new Set(O.menu.map(function(m){return m.category||'Lainnya'}))));
  var list=O.menu.filter(function(m){return O.cat==='Semua'||(m.category||'Lainnya')===O.cat});
  var n=0,tot=0;Object.keys(O.cart).forEach(function(id){var m=O.menu.find(function(x){return String(x.id)===id});if(m){n+=O.cart[id];tot+=m.price*O.cart[id]}});
  $('#root').innerHTML='<header class="coffee-bg text-white px-5 pt-6 pb-8 rounded-b-[2rem]"><div class="flex items-center gap-3"><img src="/logo.png" class="w-12 h-12"><div><div class="text-xl font-extrabold">'+esc(O.store.name)+'</div><div class="text-amber-200 text-sm">'+esc(O.store.address)+'</div></div></div><div class="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 font-bold">🪑 '+esc(O.table.name)+'</div></header>'+
   '<div class="px-4 -mt-4"><div class="flex gap-2 overflow-x-auto no-scrollbar mb-3">'+cats.map(function(c){return '<button data-c="'+esc(c)+'" class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold shadow '+(c===O.cat?'bg-amber-700 text-white':'bg-white text-slate-600')+'">'+esc(c)+'</button>'}).join('')+'</div>'+
   (list.length?list.map(function(m){var q=O.cart[m.id]||0;return '<div class="bg-white rounded-2xl p-4 mb-2 flex items-center gap-3 shadow-sm"><div class="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold text-lg">'+esc(m.name.charAt(0))+'</div><div class="flex-1 min-w-0"><div class="font-bold">'+esc(m.name)+'</div><div class="text-amber-800 font-extrabold text-sm">'+rp(m.price)+'</div></div>'+(q?'<div class="flex items-center gap-2"><button data-m="'+m.id+'" data-d="-1" class="q w-9 h-9 rounded-xl bg-slate-100 font-extrabold text-lg">−</button><b class="w-5 text-center">'+q+'</b><button data-m="'+m.id+'" data-d="1" class="q w-9 h-9 rounded-xl bg-amber-700 text-white font-extrabold text-lg">+</button></div>':'<button data-m="'+m.id+'" data-d="1" class="q px-4 h-9 rounded-xl bg-amber-700 text-white font-bold">Tambah</button>')+'</div>'}).join(''):'<div class="text-center text-slate-400 py-10">Menu belum tersedia</div>')+'<div class="h-28"></div></div>'+
   (n?'<div class="fixed bottom-0 inset-x-0 p-4 pb-safe"><button id="co" class="max-w-xl mx-auto w-full flex justify-between items-center bg-slate-900 text-white rounded-2xl px-5 py-4 shadow-2xl"><span class="font-bold">🛒 '+n+' item</span><span class="font-extrabold">'+rp(tot)+' · Pesan →</span></button></div>':'');
  $$('[data-c]').forEach(function(b){b.onclick=function(){O.cat=b.dataset.c;render()}});
  $$('.q').forEach(function(b){b.onclick=function(){var id=b.dataset.m;O.cart[id]=(O.cart[id]||0)+Number(b.dataset.d);if(O.cart[id]<=0)delete O.cart[id];render()}});
  if($('#co'))$('#co').onclick=checkout;
}
function checkout(){
  var lines=Object.keys(O.cart).map(function(id){var m=O.menu.find(function(x){return String(x.id)===id});return {m:m,q:O.cart[id]}}).filter(function(l){return l.m});
  var tot=lines.reduce(function(a,l){return a+l.m.price*l.q},0);
  var b=openModal('Konfirmasi pesanan','<div class="mb-3">'+lines.map(function(l){return '<div class="flex justify-between py-1"><span><b>'+l.q+'×</b> '+esc(l.m.name)+'</span><span>'+rp(l.m.price*l.q)+'</span></div>'}).join('')+'<div class="flex justify-between font-extrabold border-t mt-2 pt-2"><span>Total</span><span>'+rp(tot)+'</span></div></div>'+
   field('Nama kamu','customer','','text','placeholder="Supaya pesanan mudah dipanggil"')+field('Catatan (opsional)','note','','text','placeholder="Less sugar, tanpa es, dll"')+
   '<p class="text-xs text-slate-500 mb-3">Pembayaran dilakukan di kasir. Pesanan langsung masuk ke kasir/dapur.</p><button id="send" class="'+BT+' w-full py-4 text-base">Kirim pesanan</button>');
  $('#send').onclick=function(){guard(this,async function(){var f=formData(b);var d=await api('/api/public/order','POST',{t:T,customer:f.customer,note:f.note,items:lines.map(function(l){return {menu_id:l.m.id,qty:l.q}})});O.cart={};saveOrd(d.id);closeModal();showStatus(d.id)})};
}
var stTimer=null;
async function showStatus(id){
  if(stTimer)clearTimeout(stTimer);
  var d;try{d=await api('/api/public/order?t='+T+'&id='+id)}catch(e){try{localStorage.removeItem(KEY)}catch(x){}render();return}
  var o=d.order,st=o.status;
  var steps=[['baru','📨','Pesanan terkirim','Menunggu kasir menerima'],['diproses','☕','Sedang dibuat','Barista sedang menyiapkan pesananmu'],['selesai','✅','Selesai','Terima kasih! Selamat menikmati']];
  var idx=st==='baru'?0:st==='diproses'?1:st==='selesai'?2:-1;
  $('#root').innerHTML='<header class="coffee-bg text-white px-5 pt-6 pb-8 rounded-b-[2rem] text-center"><img src="/logo.png" class="w-16 h-16 mx-auto mb-2"><div class="text-xl font-extrabold">'+esc(O.store.name)+'</div><div class="text-amber-200">🪑 '+esc(o.table_name)+' · '+esc(o.customer)+'</div></header><div class="p-4 -mt-4">'+
   (st==='ditolak'?'<div class="bg-white rounded-2xl p-6 text-center shadow"><div class="text-5xl mb-2">😔</div><div class="font-extrabold text-lg">Pesanan tidak bisa diproses</div><div class="text-slate-500 text-sm">Silakan tanya ke kasir.</div></div>':
   '<div class="bg-white rounded-2xl p-5 shadow">'+steps.map(function(s,i){var on=i<=idx;return '<div class="flex items-center gap-3 py-2 '+(on?'':'opacity-40')+'"><div class="w-11 h-11 rounded-full flex items-center justify-center text-xl '+(on?'bg-amber-100':'bg-slate-100')+'">'+s[1]+'</div><div><div class="font-extrabold">'+s[2]+'</div><div class="text-xs text-slate-500">'+s[3]+'</div></div></div>'}).join('')+'</div>')+
   '<div class="bg-white rounded-2xl p-4 mt-3 shadow">'+o.items.map(function(i){return '<div class="flex justify-between py-1 text-sm"><span><b>'+i.qty+'×</b> '+esc(i.name)+'</span><span>'+rp(i.price*i.qty)+'</span></div>'}).join('')+'<div class="flex justify-between font-extrabold border-t mt-2 pt-2"><span>Total (bayar di kasir)</span><span>'+rp(o.total)+'</span></div></div>'+
   '<button id="again" class="'+BG+' w-full mt-3 py-3">+ Pesan lagi</button><p class="text-center text-xs text-slate-400 mt-4">Powered by JCOFFE POS</p></div>';
  $('#again').onclick=function(){try{localStorage.removeItem(KEY)}catch(e){}render()};
  if(st==='baru'||st==='diproses')stTimer=setTimeout(function(){showStatus(id)},5000);
}
init();
`);

// ---------------------------------------------------------------- lembar cetak QR meja
const QR_PRINT_HTML = page('QR Meja', `<div class="qwrap max-w-5xl mx-auto p-6"><div class="flex flex-wrap gap-3 items-center justify-between mb-6 print:hidden" id="bar"><div><h1 class="text-2xl font-extrabold">QR code meja</h1><p class="text-slate-500 text-sm">Cetak di kertas A4, gunting, lalu tempel di setiap meja.</p></div><button onclick="window.print()" class="px-6 py-3 rounded-xl font-bold bg-amber-700 text-white">🖨️ Cetak</button></div><div id="grid" class="grid grid-cols-2 gap-5"></div></div>
<style>@media print{body>div.qwrap{display:block!important}#bar{display:none!important}.qcard{break-inside:avoid}@page{size:A4;margin:10mm}}</style>`, String.raw`
var D=__QR_DATA__;
loadScript('/qr.js','qrcode').then(function(){
  $('#grid').innerHTML=D.tables.length?D.tables.map(function(t){return '<div class="qcard border-2 border-amber-800 rounded-3xl p-5 text-center bg-white"><div class="flex items-center justify-center gap-2 mb-1"><img src="/logo.png" class="w-10 h-10"><div class="font-extrabold text-lg">'+esc(D.store)+'</div></div><div class="text-amber-800 font-bold text-sm mb-2">Scan untuk lihat menu & pesan</div><div class="mx-auto w-52 h-52 [&>svg]:w-full [&>svg]:h-full">'+qrSvg(t.url,5)+'</div><div class="mt-2 text-3xl font-extrabold">'+esc(t.name)+'</div><div class="text-xs text-slate-500 mt-1">Bayar di kasir · JCOFFE POS</div></div>'}).join(''):'<div class="col-span-2 text-center text-slate-500">Belum ada meja aktif.</div>';
  if(/print=1/.test(location.search))setTimeout(function(){window.print()},500);
});
`);

// ---------------------------------------------------------------- struk digital publik
const RECEIPT_HTML = page('Struk', `<div class="min-h-screen p-4 flex justify-center"><div id="r" class="bg-white shadow rounded-2xl p-5 w-full max-w-sm"></div></div>`, String.raw`
var R=__RCPT__,t=R.trx,s=R.store;
window.S={me:{store:s}};
t.items=t.items||[];
var mode=(location.search.match(/print=(\w+)/)||[])[1];
if(mode==='80')PRN.paper=80;else PRN.paper=58;
$('#r').innerHTML='<div class="text-center mb-3"><img src="/logo.png" class="w-14 h-14 mx-auto"><div class="font-extrabold text-lg">'+esc(s.name)+'</div><div class="text-xs text-slate-500">'+esc(s.address||'')+'</div></div><pre class="text-[11px] font-mono whitespace-pre-wrap bg-stone-50 rounded-xl p-3">'+esc(linesText(receiptLines(t)))+'</pre><div class="grid grid-cols-3 gap-2 mt-3"><button data-p="58" class="'+BG+'">🖨️ 58mm</button><button data-p="80" class="'+BG+'">🖨️ 80mm</button><button data-p="a4" class="'+BG+'">📄 A4</button></div>';
$$('[data-p]').forEach(function(b){b.onclick=function(){go(b.dataset.p)}});
function go(m){if(m==='a4'){$('#print-area').innerHTML=a4Html(t);setTimeout(function(){window.print()},60)}else{PRN.paper=+m;browserPrint(receiptLines(t),PRN.paper)}}
if(mode)setTimeout(function(){go(mode)},400);
`, { print: true });

// ---------------------------------------------------------------- PROMO / unduh aplikasi
const PROMO_HTML = page('Aplikasi Kasir Coffee Shop & Warkop', `
<header class="coffee-bg text-white">
 <nav class="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between"><a href="/promo" class="flex items-center gap-2"><img src="/logo.png" class="w-10 h-10"><b class="text-lg tracking-wide">JCOFFE POS</b></a><a href="/" class="text-sm font-bold bg-white/10 rounded-xl px-4 py-2">Masuk</a></nav>
 <div class="max-w-6xl mx-auto px-5 pt-8 pb-16 grid lg:grid-cols-2 gap-10 items-center">
  <div><span class="inline-block bg-amber-400/20 text-amber-200 text-xs font-bold rounded-full px-3 py-1 mb-4">☕ Untuk coffee shop, warkop & kafe</span>
   <h1 class="text-4xl sm:text-5xl font-extrabold leading-tight">Kasir pintar, stok terkendali, <span class="text-amber-400">pesanan meja otomatis.</span></h1>
   <p class="mt-4 text-amber-100/80 text-lg">JCOFFE POS: kasir cepat, resep potong stok otomatis, pesan lewat QR meja dengan alarm, struk Bluetooth, laporan laba rugi, dan notifikasi Telegram. Gratis trial 14 hari.</p>
   <div class="mt-7 flex flex-wrap gap-3"><a href="/jcoffe-pos.apk" class="px-6 py-4 rounded-2xl font-extrabold bg-amber-400 text-slate-900 shadow-xl">📲 Unduh APK Android</a><button id="demo" class="px-6 py-4 rounded-2xl font-extrabold bg-white text-slate-900">🎮 Coba demo</button><a href="/daftar" class="px-6 py-4 rounded-2xl font-extrabold border-2 border-white/40">Daftar gratis</a></div>
   <div class="mt-3 flex flex-wrap gap-3 text-sm"><a href="/beli" class="px-5 py-3 rounded-2xl font-extrabold bg-[#2a160d] text-amber-300 border border-amber-400/40">🔑 Beli lisensi 3 bulan</a><a href="/klaim" class="px-5 py-3 rounded-2xl font-bold text-amber-100 underline">Sudah beli? Ambil serial number</a></div>
   <p class="mt-3 text-xs text-amber-100/60">Gratis 14 hari · tanpa kartu kredit · bisa dipakai di HP, tablet & laptop</p></div>
  <div class="relative mx-auto w-full max-w-sm"><div class="absolute -inset-6 bg-amber-500/20 blur-3xl rounded-full"></div>
   <div class="relative bg-white text-slate-800 rounded-[2rem] shadow-2xl p-4 border-8 border-slate-900">
    <div class="bg-[#1c0f0a] text-white rounded-2xl px-4 py-3 flex items-center gap-2 mb-3"><img src="/icon-192.png" class="w-8 h-8"><b class="flex-1">JCOFFE Cabang 1</b><span class="text-[10px] bg-amber-400 text-slate-900 font-bold rounded-full px-2 py-0.5">Trial 14 hari</span></div>
    <div class="grid grid-cols-2 gap-2 mb-3">${['Es Kopi Susu|Rp 18.000', 'Americano|Rp 15.000', 'Caramel Latte|Rp 22.000', 'Croissant|Rp 20.000'].map((x) => `<div class="bg-amber-50 rounded-xl p-3"><div class="font-bold text-sm">${x.split('|')[0]}</div><div class="text-amber-800 font-extrabold text-sm">${x.split('|')[1]}</div></div>`).join('')}</div>
    <div class="bg-red-600 text-white rounded-2xl p-3 text-center font-extrabold mb-3"><span class="shake">🛎️</span> PESANAN BARU · Meja 3</div>
    <div class="bg-slate-900 text-white rounded-2xl px-4 py-3 flex justify-between font-bold"><span>🛒 3 item</span><span>Rp 58.000 →</span></div>
   </div></div>
 </div>
</header>
<section class="max-w-6xl mx-auto px-5 py-16"><h2 class="text-3xl font-extrabold text-center mb-2">Semua yang dibutuhkan coffee shop</h2><p class="text-center text-slate-500 mb-10">Dirancang dari kebutuhan nyata warkop & kafe di Indonesia.</p>
 <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${[
   ['🛒', 'Kasir super cepat', 'Tap menu, pilih promo, bayar Tunai/QRIS/Transfer, kembalian otomatis.'],
   ['🪑', 'Pesan lewat QR meja', 'Pelanggan scan QR, pilih menu, pesanan langsung masuk ke kasir.'],
   ['🔊', 'Alarm pesanan keras', 'Bunyi sirene + getar + suara “Pesanan baru, Meja 3” — tidak ada pesanan terlewat.'],
   ['🖨️', 'Cetak struk lengkap', 'Printer Bluetooth (RawBT/BLE), USB/PC 58–80 mm, nota A4, order dapur, struk digital WA.'],
   ['🧪', 'Resep & HPP otomatis', 'Setiap menu wajib punya resep — stok bahan terpotong otomatis, HPP & margin akurat.'],
   ['📦', 'Stok & peringatan', 'Catat stok masuk/keluar, peringatan bahan menipis ke Telegram.'],
   ['👥', 'Role & hak akses', 'Owner, Operational Manager, Admin, Supervisor, Kasir — hak akses bisa diatur owner.'],
   ['📊', 'Laporan laba rugi', 'Omzet, HPP, laba, margin, jam ramai, menu terlaris, ekspor Excel.'],
   ['🤖', 'Bot Telegram', 'Notifikasi transaksi & pesanan, laporan harian jam 21:00, perintah /omzet /stok.'],
 ].map((f) => `<div class="bg-white rounded-3xl p-6 shadow-sm"><div class="text-3xl mb-3">${f[0]}</div><div class="font-extrabold text-lg mb-1">${f[1]}</div><p class="text-slate-500 text-sm">${f[2]}</p></div>`).join('')}</div></section>
<section class="bg-white"><div class="max-w-6xl mx-auto px-5 py-16 grid lg:grid-cols-3 gap-6 text-center">${[
   ['1', 'Unduh & daftar', 'Pasang APK atau buka di browser, daftar toko — langsung trial 14 hari.'],
   ['2', 'Isi bahan & menu', 'Masukkan bahan baku, buat menu beserta resep, cetak QR meja.'],
   ['3', 'Mulai jualan', 'Terima pesanan kasir & QR meja, pantau omzet dari HP kapan saja.'],
 ].map((s) => `<div><div class="mx-auto w-14 h-14 rounded-2xl bg-amber-700 text-white text-2xl font-extrabold flex items-center justify-center mb-3">${s[0]}</div><div class="font-extrabold text-lg">${s[1]}</div><p class="text-slate-500 text-sm mt-1">${s[2]}</p></div>`).join('')}</div></section>
<section class="max-w-3xl mx-auto px-5 py-16"><h2 class="text-3xl font-extrabold text-center mb-8">Pertanyaan umum</h2>${[
   ['Apakah benar gratis?', 'Ya, trial 14 hari penuh tanpa kartu kredit. Setelah trial, kamu tetap bisa bertransaksi; fitur lain dibuka dengan lisensi.'],
   ['Bagaimana cara membeli lisensi?', 'Beli lisensi 3 bulan di toko Lynk.id kami (tombol Beli lisensi). Setiap pembelian mendapat 1 serial number. Buka aplikasi → tap badge Trial / menu Lainnya → Lisensi → masukkan serial number. Sisa trial tidak hangus.'],
   ['Serial number belum saya terima?', 'Buka halaman Ambil Serial Number (/klaim), isi email & nomor WhatsApp yang dipakai saat membeli di Lynk.id. Atau chat admin di WhatsApp 0813-4064-173.'],
   ['Printer apa yang didukung?', 'Hampir semua printer thermal Bluetooth 58/80 mm (lewat aplikasi gratis RawBT), printer BLE, printer USB/PC, dan printer biasa untuk nota A4.'],
   ['Apakah data aman?', 'Data tersimpan di server cloud (Cloudflare), bukan di HP. Ganti HP pun data tetap ada.'],
   ['Bagaimana update aplikasi?', 'Tampilan & fitur ter-update otomatis dari server. Jika ada versi APK baru, aplikasi menampilkan tombol Update.'],
 ].map((q) => `<details class="bg-white rounded-2xl p-5 mb-3 shadow-sm"><summary class="font-extrabold cursor-pointer">${q[0]}</summary><p class="text-slate-600 mt-2 text-sm">${q[1]}</p></details>`).join('')}</section>
<section class="coffee-bg text-white"><div class="max-w-4xl mx-auto px-5 py-16 text-center"><img src="/logo.png" class="w-24 h-24 mx-auto mb-4"><h2 class="text-3xl font-extrabold">Siap bikin kafemu lebih rapi?</h2><p class="text-amber-100/80 mt-2">Unduh sekarang, coba gratis 14 hari.</p><div class="mt-6 flex flex-wrap gap-3 justify-center"><a href="/jcoffe-pos.apk" class="px-6 py-4 rounded-2xl font-extrabold bg-amber-400 text-slate-900">📲 Unduh APK</a><a href="https://wa.me/628134064173?text=Halo%20admin%20JCOFFE%20POS%2C%20saya%20mau%20tanya%20aplikasinya" target="_blank" class="px-6 py-4 rounded-2xl font-extrabold bg-green-600">💬 Tanya via WhatsApp</a></div>
 <p class="text-xs text-amber-100/50 mt-8">© 2026 JCOFFE POS · J-DATA Digital Solution</p></div></section>`, String.raw`
$('#demo').onclick=function(){var b=this;guard(b,async function(){b.textContent='Menyiapkan demo…';try{var d=await api('/api/demo','POST',{});location.href=d.redirect}catch(e){b.textContent='🎮 Coba demo';toast(e.message,true)}})};
`, { head: '<meta name="description" content="JCOFFE POS — aplikasi kasir coffee shop & warkop: pesan QR meja dengan alarm, resep potong stok otomatis, cetak struk Bluetooth, laporan laba rugi, bot Telegram. Gratis trial 14 hari."><meta property="og:title" content="JCOFFE POS — Aplikasi Kasir Coffee Shop"><meta property="og:description" content="Kasir, QR meja, stok & resep, struk Bluetooth, laporan. Gratis 14 hari."><meta property="og:image" content="/logo.png">' });

// ---------------------------------------------------------------- KLAIM SERIAL NUMBER (pembeli Lynk.id)
const CLAIM_HTML = page('Ambil Serial Number', `${AUTH_BG}
<div class="min-h-screen flex items-center justify-center p-5">
 <div class="w-full max-w-sm bg-white/95 rounded-[2rem] shadow-2xl px-7 py-8 border-t-4 border-amber-600">
  ${LOGO}
  <h1 class="text-2xl font-extrabold text-center text-slate-900">Ambil Serial Number</h1>
  <p class="text-center text-sm text-slate-500 mt-1 mb-5">Untuk pembeli lisensi JCOFFE POS di Lynk.id</p>
  <form id="f"><div id="fields"></div><div id="err" class="hidden mb-3 bg-red-50 border border-red-200 text-red-600 font-semibold text-center rounded-2xl py-3 px-3 text-sm"></div>
  <button id="btn" class="w-full bg-amber-700 text-white rounded-2xl py-4 font-extrabold tracking-wider">TAMPILKAN SERIAL NUMBER</button></form>
  <div id="res" class="hidden"></div>
  <p class="text-center text-xs text-slate-500 mt-5">Belum beli? <a href="/beli" class="text-amber-700 font-extrabold">Beli lisensi</a> · Bantuan: <a href="https://wa.me/628134064173" class="text-green-700 font-extrabold">WhatsApp admin</a></p>
 </div>
</div>`, String.raw`
$('#fields').innerHTML=field('Email saat membeli di Lynk.id','email','','email','required autocomplete="email" placeholder="nama@gmail.com"')+field('Nomor WhatsApp saat membeli','phone','','tel','required placeholder="08xxxxxxxxxx"');
$('#f').addEventListener('submit',function(e){e.preventDefault();guard($('#btn'),async function(){$('#err').classList.add('hidden');
  try{var d=await api('/api/public/klaim','POST',formData($('#f')));
   $('#f').classList.add('hidden');var r=$('#res');r.classList.remove('hidden');
   r.innerHTML='<div class="text-center text-5xl mb-2">🎉</div><p class="text-center font-extrabold mb-3">Serial number kamu</p>'+d.licenses.map(function(l){return '<div class="rounded-2xl p-4 mb-3 '+(l.used?'bg-slate-100':'bg-amber-50 ring-2 ring-amber-400')+'"><div class="font-mono text-lg font-extrabold text-center tracking-wider select-all">'+esc(l.code)+'</div><div class="text-center text-xs text-slate-500 mt-1">Masa aktif '+esc(l.label)+(l.used?' · <b>sudah dipakai</b>':'')+'</div>'+(l.used?'':'<div class="grid grid-cols-2 gap-2 mt-3"><button data-c="'+esc(l.code)+'" class="cp bg-white border rounded-xl py-2.5 font-bold text-sm">📋 Salin</button><a href="/app?sn='+encodeURIComponent(l.code)+'" class="text-center bg-slate-900 text-white rounded-xl py-2.5 font-bold text-sm">Aktifkan</a></div>')+'</div>'}).join('')+
   '<div class="bg-slate-50 rounded-2xl p-4 text-sm"><b>Cara aktivasi</b><ol class="list-decimal ml-5 mt-1 space-y-1 text-slate-600"><li>Unduh aplikasi: <a href="/download" class="text-amber-700 font-bold">JCOFFE POS</a></li><li>Login, atau <a href="/daftar?sn='+encodeURIComponent((d.licenses.find(function(l){return !l.used})||{}).code||'')+'" class="text-amber-700 font-bold">daftar toko baru</a> (SN langsung terisi)</li><li>Tap badge <b>Trial</b> di kanan atas → masukkan SN → <b>Aktifkan</b></li></ol></div>';
   $$('.cp').forEach(function(b){b.onclick=function(){copyText(b.dataset.c,'Serial number disalin')}});
  }catch(err){$('#err').textContent=err.message;$('#err').classList.remove('hidden')}})});
`);

// ---------------------------------------------------------------- PWA
const MANIFEST = {
  id: '/', name: 'JCOFFE POS', short_name: 'JCOFFE', description: 'Aplikasi kasir coffee shop & warkop — JCOFFE POS',
  start_url: '/?source=pwa', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'id',
  background_color: '#1c0f0a', theme_color: '#1c0f0a', categories: ['business', 'productivity', 'food'],
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const SW_JS = `const C='jc-v2';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['/icon-192.png','/icon-512.png','/logo.png','/manifest.json'])))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>new Response('<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;background:#1c0f0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h2>Tidak ada koneksi internet</h2><p>Periksa koneksi lalu coba lagi.</p><button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:0;font-weight:bold">Coba lagi</button></div>',{headers:{'content-type':'text/html'}})));return}
 if(u.origin===location.origin&&/\\.(png|json)$/.test(u.pathname)){e.respondWith(caches.match(r).then(m=>m||fetch(r)))}});`;
