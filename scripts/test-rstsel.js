// Tes logika reset data pilihan (Ap.rstSel di public/js/core.js). Jalankan: node scripts/test-rstsel.js
const fs=require('fs'),vm=require('vm');
let src=fs.readFileSync(require('path').join(__dirname,'..','public','js','core.js'),'utf8');
// ambil hanya objek Ap.rstSel & helper minimal lewat ekstraksi
const m=src.match(/  rstSel\(e\) \{[\s\S]*?\n  \},\n/);
const sOut=(s)=>(s.pay=='Piutang'?Math.max(0,s.tot-(s.rtot||0)-(s.pa||0)):0);
const S0st=()=>ctx.S.p.reduce((a,p)=>a+p.st*(p.co||0),0);
const ctx={S:{sales:[{pay:'Piutang',tot:100,pa:0},{pay:'Tunai',tot:50}],rtr:[1],ap:[{amt:10}],po:[1],kv:[1],kvq:[1],van:{a:1},p:[{st:5,bad:1,bv:2}],bst:[1],j:[1],kn:[1],notif:[]},sOut,stockValue:()=>S0st(),apOut:(a)=>Math.max(0,a.amt-(a.pa||0)),badValue:()=>0,notif:(e,k,m)=>ctx.S.notif.push(m),Ap:{}};
vm.createContext(ctx);
vm.runInContext('Ap={'+m[0].replace(/,\n$/,'')+'}',ctx);
const assert=require('assert');
const run=(parts)=>{const S0=JSON.stringify(ctx.S);vm.runInContext('Ap.rstSel('+JSON.stringify({parts,t:1,u:'o',no:'x',k:'rstSel',rv:2})+')',ctx);return ctx.S}
let S=run(['piutang']); assert.strictEqual(S.sales[0].pa,100); assert.strictEqual(S.sales.length,2); assert.strictEqual(S.ap.length,1); assert.strictEqual(S.p[0].st,5);
S=run(['stok','utang']); assert.strictEqual(S.p[0].st,0); assert.strictEqual(S.ap.length,0); assert.strictEqual(S.j.length,1); assert.strictEqual(S.sales.length,2);
S=run(['akun','penjualan','po','kanvas']); assert.ok(!S.j.length && !S.kn.length && !S.sales.length && !S.rtr.length && !S.po.length && !S.kv.length); 
ctx.S={sales:[{pay:'Piutang',tot:300,pa:0}],rtr:[],ap:[{amt:100,pa:0}],po:[],kv:[],kvq:[],van:{},p:[{st:10,co:50,bad:0,bv:0}],bst:[],j:[1,2],kn:[1],notif:[]};
S=run(['akun']);
assert.strictEqual(S.sales[0].pa||0,0); assert.strictEqual(S.ap.length,1); assert.strictEqual(S.p[0].st,10); // data lain tidak berubah
assert.strictEqual(S.j.length,1); const L=S.j[0].l, dr=L.reduce((a,x)=>a+x[1],0), cr=L.reduce((a,x)=>a+x[2],0);
assert.strictEqual(dr,cr); assert.ok(L.some(x=>x[0]=='1103'&&x[1]==300)); assert.ok(L.some(x=>x[0]=='1201'&&x[1]==500)); assert.ok(L.some(x=>x[0]=='2102'&&x[2]==100));
console.log('rstSel: semua tes lulus');
