#!/usr/bin/env python3
"""
Builder APK WebView "Warkop Rafli POS" tanpa Android SDK.
Menulis sendiri: classes.dex, AndroidManifest.xml (binary XML), resources.arsc,
lalu zip (resources.arsc stored + 4-byte aligned) dan tanda tangan APK Signature Scheme v2.
"""
import struct, hashlib, zlib, zipfile, io, os, sys, datetime

PKG = 'com.warkoprafli.pos'
APP_LABEL = 'JCOFFE POS'
URL = 'https://warkop-rafli.muchlis7771.workers.dev/?source=apk&v=3'
HOST_PREFIX = 'https://warkop-rafli.muchlis7771.workers.dev'
VERSION_CODE = 3
VERSION_NAME = "3.0"
MIN_SDK, TARGET_SDK = 24, 34
STATUS_COLOR = 0xFF1C0F0A

def u8(x): return struct.pack('<B', x)
def u16(x): return struct.pack('<H', x)
def u32(x): return struct.pack('<I', x & 0xffffffff)
def i32(x): return struct.pack('<i', x)
def pad4(b): return b + b'\0' * ((-len(b)) % 4)

def uleb(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

# =====================================================================================
# DEX
# =====================================================================================
def mutf8(s):
    out = bytearray()
    for ch in s:
        c = ord(ch)
        if c == 0: out += b'\xc0\x80'
        elif c < 0x80: out.append(c)
        elif c < 0x800: out += bytes([0xc0 | (c >> 6), 0x80 | (c & 0x3f)])
        else: out += bytes([0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)])
    return bytes(out)

SHORTY = {'V': 'V', 'Z': 'Z', 'I': 'I', 'J': 'J', 'F': 'F', 'D': 'D', 'B': 'B', 'S': 'S', 'C': 'C'}
def shorty(ret, params):
    f = lambda t: SHORTY.get(t, 'L')
    return f(ret) + ''.join(f(p) for p in params)

class Dex:
    def __init__(self):
        self.strings, self.types, self.protos, self.fields, self.methods = set(), set(), set(), set(), set()
        self.classes = []
    def s(self, x): self.strings.add(x); return x
    def t(self, x): self.types.add(x); self.s(x); return x
    def p(self, ret, params):
        params = tuple(params); self.t(ret); [self.t(x) for x in params]; self.s(shorty(ret, params))
        k = (ret, params); self.protos.add(k); return k
    def f(self, cls, name, typ):
        self.t(cls); self.t(typ); self.s(name); k = (cls, name, typ); self.fields.add(k); return k
    def m(self, cls, name, ret, params):
        self.t(cls); self.s(name); pr = self.p(ret, params); k = (cls, name, pr); self.methods.add(k); return k

# --- instruction helpers (symbolic; resolved at build) -------------------------------
def ins_35c(op, regs, mref):
    return ('35c', op, regs, mref)
def invoke_virtual(regs, m): return ins_35c(0x6e, regs, m)
def invoke_super(regs, m): return ins_35c(0x6f, regs, m)
def invoke_direct(regs, m): return ins_35c(0x70, regs, m)
def invoke_static(regs, m): return ins_35c(0x71, regs, m)
def const4(a, v): return ('raw', [0x12 | (a << 8) | ((v & 0xf) << 12)])
def const32(a, v): return ('raw', [0x14 | (a << 8), v & 0xffff, (v >> 16) & 0xffff])
def move_result(a): return ('raw', [0x0a | (a << 8)])
def move_result_obj(a): return ('raw', [0x0c | (a << 8)])
def move_exception(a): return ('raw', [0x0d | (a << 8)])
def return_void(): return ('raw', [0x0e])
def return_(a): return ('raw', [0x0f | (a << 8)])
def new_instance(a, t): return ('21c_type', 0x22, a, t)
def const_string(a, s): return ('21c_str', 0x1a, a, s)
def iput_object(a, b, f): return ('22c_field', 0x5b, a, b, f)
def iget_object(a, b, f): return ('22c_field', 0x54, a, b, f)
def if_eqz(a, label): return ('21t', 0x38, a, label)
def if_nez(a, label): return ('21t', 0x39, a, label)
def label(name): return ('label', name)

def ins_len(i):
    k = i[0]
    if k == 'label': return 0
    if k == 'raw': return len(i[1])
    if k == '35c': return 3
    return 2

def build_dex(d):
    strings = sorted(d.strings, key=lambda s: [ord(c) for c in s])
    sidx = {s: i for i, s in enumerate(strings)}
    types = sorted(d.types, key=lambda t: sidx[t])
    tidx = {t: i for i, t in enumerate(types)}
    protos = sorted(d.protos, key=lambda p: (tidx[p[0]], [tidx[x] for x in p[1]]))
    pidx = {p: i for i, p in enumerate(protos)}
    fields = sorted(d.fields, key=lambda f: (tidx[f[0]], sidx[f[1]], tidx[f[2]]))
    fidx = {f: i for i, f in enumerate(fields)}
    methods = sorted(d.methods, key=lambda m: (tidx[m[0]], sidx[m[1]], pidx[m[2]]))
    midx = {m: i for i, m in enumerate(methods)}

    def assemble(code):
        labels, pos = {}, 0
        for i in code:
            if i[0] == 'label': labels[i[1]] = pos
            pos += ins_len(i)
        units, pos = [], 0
        for i in code:
            k = i[0]
            if k == 'label': continue
            if k == 'raw': units += i[1]
            elif k == '35c':
                _, op, regs, m = i
                regs = list(regs); n = len(regs); assert n <= 5 and all(r < 16 for r in regs)
                rr = regs + [0] * (5 - n)
                units += [op | (n << 12) | (rr[4] << 8), midx[m], rr[0] | (rr[1] << 4) | (rr[2] << 8) | (rr[3] << 12)]
            elif k == '21c_type': units += [i[1] | (i[2] << 8), tidx[i[3]]]
            elif k == '21c_str': units += [i[1] | (i[2] << 8), sidx[i[3]]]
            elif k == '22c_field': units += [i[1] | (i[2] << 8) | (i[3] << 12), fidx[i[4]]]
            elif k == '21t':
                off = labels[i[3]] - pos
                units += [i[1] | (i[2] << 8), off & 0xffff]
            pos += ins_len(i)
        return units, labels

    # layout sizes
    n_s, n_t, n_p, n_f, n_m, n_c = len(strings), len(types), len(protos), len(fields), len(methods), len(d.classes)
    off = 0x70
    string_ids_off = off; off += 4 * n_s
    type_ids_off = off; off += 4 * n_t
    proto_ids_off = off; off += 12 * n_p
    field_ids_off = off; off += 8 * n_f
    method_ids_off = off; off += 8 * n_m
    class_defs_off = off; off += 32 * n_c
    data_off = off

    data = bytearray()
    def here(): return data_off + len(data)
    def align4():
        while len(data) % 4: data.append(0)

    # code items
    align4(); code_items_off = here(); code_offs = {}; n_code = 0
    for c in d.classes:
        for meth in c['direct'] + c['virtual']:
            align4()
            code_offs[meth['ref']] = here(); n_code += 1
            units, labels = assemble(meth['code'])
            tries = meth.get('tries', [])
            item = bytearray()
            item += u16(meth['regs']) + u16(meth['ins']) + u16(meth['outs']) + u16(len(tries)) + u32(0) + u32(len(units))
            item += b''.join(u16(x) for x in units)
            if tries:
                if len(units) % 2: item += u16(0)
                # one catch-all handler list
                handlers = bytearray(uleb(len(tries)))
                hoffs = []
                for (a, b, h) in tries:
                    hoffs.append(len(handlers))
                    handlers += b'\x00'  # sleb128 0 -> only catch-all
                    handlers += uleb(labels[h])
                for (a, b, h), ho in zip(tries, hoffs):
                    item += u32(labels[a]) + u16(labels[b] - labels[a]) + u16(ho)
                item += handlers
            data += item

    # type lists (for protos)
    align4(); type_lists_off = here(); tl_offs = {}
    for p in protos:
        if p[1] and p[1] not in tl_offs:
            align4(); tl_offs[p[1]] = here()
            data += u32(len(p[1])) + b''.join(u16(tidx[x]) for x in p[1])
    n_tl = len(tl_offs)
    if not n_tl: type_lists_off = None

    # string data
    string_data_off = here(); s_offs = []
    for s in strings:
        s_offs.append(here())
        data += uleb(len(s.encode('utf-16-le')) // 2) + mutf8(s) + b'\0'

    # class data
    class_data_off = here(); cd_offs = []
    for c in d.classes:
        cd_offs.append(here())
        inst = sorted(c.get('ifields', []), key=lambda x: fidx[x[0]])
        dm = sorted(c['direct'], key=lambda x: midx[x['ref']])
        vm = sorted(c['virtual'], key=lambda x: midx[x['ref']])
        data += uleb(0) + uleb(len(inst)) + uleb(len(dm)) + uleb(len(vm))
        prev = 0
        for fref, acc in inst:
            data += uleb(fidx[fref] - prev) + uleb(acc); prev = fidx[fref]
        for lst in (dm, vm):
            prev = 0
            for meth in lst:
                data += uleb(midx[meth['ref']] - prev) + uleb(meth['access']) + uleb(code_offs[meth['ref']]); prev = midx[meth['ref']]

    # map list
    align4(); map_off = here()
    items = [(0x0000, 1, 0), (0x0001, n_s, string_ids_off), (0x0002, n_t, type_ids_off), (0x0003, n_p, proto_ids_off)]
    if n_f: items.append((0x0004, n_f, field_ids_off))
    items += [(0x0005, n_m, method_ids_off), (0x0006, n_c, class_defs_off), (0x2001, n_code, code_items_off)]
    if n_tl: items.append((0x1001, n_tl, type_lists_off))
    items += [(0x2002, n_s, string_data_off), (0x2000, n_c, class_data_off), (0x1000, 1, map_off)]
    items.sort(key=lambda x: x[2])
    data += u32(len(items)) + b''.join(u16(t) + u16(0) + u32(n) + u32(o) for t, n, o in items)

    # id sections
    ids = bytearray()
    ids += b''.join(u32(o) for o in s_offs)
    ids += b''.join(u32(sidx[t]) for t in types)
    for p in protos: ids += u32(sidx[shorty(p[0], p[1])]) + u32(tidx[p[0]]) + u32(tl_offs.get(p[1], 0) if p[1] else 0)
    for f in fields: ids += u16(tidx[f[0]]) + u16(tidx[f[2]]) + u32(sidx[f[1]])
    for m in methods: ids += u16(tidx[m[0]]) + u16(pidx[m[2]]) + u32(sidx[m[1]])
    for c, cdo in zip(d.classes, cd_offs):
        ids += u32(tidx[c['name']]) + u32(c['access']) + u32(tidx[c['super']]) + u32(0) + u32(0xffffffff) + u32(0) + u32(cdo) + u32(0)
    assert 0x70 + len(ids) == data_off

    file_size = data_off + len(data)
    hdr = bytearray(b'dex\n035\0') + b'\0' * 4 + b'\0' * 20
    hdr += u32(file_size) + u32(0x70) + u32(0x12345678) + u32(0) + u32(0) + u32(map_off)
    hdr += u32(n_s) + u32(string_ids_off) + u32(n_t) + u32(type_ids_off) + u32(n_p) + u32(proto_ids_off)
    hdr += u32(n_f) + u32(field_ids_off if n_f else 0) + u32(n_m) + u32(method_ids_off) + u32(n_c) + u32(class_defs_off)
    hdr += u32(len(data)) + u32(data_off)
    assert len(hdr) == 0x70
    dex = bytearray(hdr + ids + data)
    dex[12:32] = hashlib.sha1(dex[32:]).digest()
    dex[8:12] = u32(zlib.adler32(bytes(dex[12:])))
    return bytes(dex)

def make_dex():
    d = Dex()
    MA = 'L' + PKG.replace('.', '/') + '/MainActivity;'
    CL = 'L' + PKG.replace('.', '/') + '/Client;'
    ACT, BUNDLE, WV, WS, WVC, WCC, WIN = 'Landroid/app/Activity;', 'Landroid/os/Bundle;', 'Landroid/webkit/WebView;', 'Landroid/webkit/WebSettings;', 'Landroid/webkit/WebViewClient;', 'Landroid/webkit/WebChromeClient;', 'Landroid/view/Window;'
    CTX, VIEW, STR, INTENT, URI = 'Landroid/content/Context;', 'Landroid/view/View;', 'Ljava/lang/String;', 'Landroid/content/Intent;', 'Landroid/net/Uri;'
    fW = d.f(MA, 'w', WV)

    act_init = d.m(ACT, '<init>', 'V', [])
    ma_init = d.m(MA, '<init>', 'V', [])
    on_create = d.m(MA, 'onCreate', 'V', [BUNDLE])
    on_back = d.m(MA, 'onBackPressed', 'V', [])
    sup_create = d.m(ACT, 'onCreate', 'V', [BUNDLE])
    sup_back = d.m(ACT, 'onBackPressed', 'V', [])
    req_feat = d.m(ACT, 'requestWindowFeature', 'Z', ['I'])
    get_win = d.m(ACT, 'getWindow', WIN, [])
    set_sbc = d.m(WIN, 'setStatusBarColor', 'V', ['I'])
    set_cv = d.m(ACT, 'setContentView', 'V', [VIEW])
    wv_init = d.m(WV, '<init>', 'V', [CTX])
    get_set = d.m(WV, 'getSettings', WS, [])
    js_en = d.m(WS, 'setJavaScriptEnabled', 'V', ['Z'])
    dom_en = d.m(WS, 'setDomStorageEnabled', 'V', ['Z'])
    media = d.m(WS, 'setMediaPlaybackRequiresUserGesture', 'V', ['Z'])
    contains = d.m(STR, 'contains', 'Z', ['Ljava/lang/CharSequence;'])
    set_wvc = d.m(WV, 'setWebViewClient', 'V', [WVC])
    set_wcc = d.m(WV, 'setWebChromeClient', 'V', [WCC])
    load = d.m(WV, 'loadUrl', 'V', [STR])
    can_back = d.m(WV, 'canGoBack', 'Z', [])
    go_back = d.m(WV, 'goBack', 'V', [])
    wcc_init = d.m(WCC, '<init>', 'V', [])
    wvc_init = d.m(WVC, '<init>', 'V', [])
    cl_init = d.m(CL, '<init>', 'V', [])
    should = d.m(CL, 'shouldOverrideUrlLoading', 'Z', [WV, STR])
    starts = d.m(STR, 'startsWith', 'Z', [STR])
    uri_parse = d.m(URI, 'parse', URI, [STR])
    intent_init = d.m(INTENT, '<init>', 'V', [STR, URI])
    get_ctx = d.m(WV, 'getContext', CTX, [])
    start_act = d.m(CTX, 'startActivity', 'V', [INTENT])
    for x in (URL, HOST_PREFIX, 'android.intent.action.VIEW', 'ext=1'): d.s(x)
    d.t(MA); d.t(CL)

    # MainActivity: regs v0..v2, p0=v3, p1=v4
    create_code = [
        invoke_super([3, 4], sup_create),
        const4(0, 1), invoke_virtual([3, 0], req_feat),
        invoke_virtual([3], get_win), move_result_obj(0),
        const32(1, STATUS_COLOR), invoke_virtual([0, 1], set_sbc),
        new_instance(0, WV), invoke_direct([0, 3], wv_init),
        iput_object(0, 3, fW),
        invoke_virtual([0], get_set), move_result_obj(1),
        const4(2, 1), invoke_virtual([1, 2], js_en), invoke_virtual([1, 2], dom_en), const4(2, 0), invoke_virtual([1, 2], media),
        new_instance(1, CL), invoke_direct([1], cl_init), invoke_virtual([0, 1], set_wvc),
        new_instance(1, WCC), invoke_direct([1], wcc_init), invoke_virtual([0, 1], set_wcc),
        const_string(1, URL), invoke_virtual([0, 1], load),
        invoke_virtual([3, 0], set_cv),
        return_void(),
    ]
    # onBackPressed: v0, v1, p0=v2
    back_code = [
        iget_object(0, 2, fW), if_eqz(0, 'sup'),
        invoke_virtual([0], can_back), move_result(1), if_eqz(1, 'sup'),
        invoke_virtual([0], go_back), return_void(),
        label('sup'), invoke_super([2], sup_back), return_void(),
    ]
    # Client.shouldOverrideUrlLoading: v0..v2, p0=v3, p1=v4 (WebView), p2=v5 (url)
    should_code = [
        const_string(0, 'ext=1'), invoke_virtual([5, 0], contains), move_result(0), if_nez(0, 'ext'),
        const_string(0, HOST_PREFIX), invoke_virtual([5, 0], starts), move_result(0), if_eqz(0, 'ext'),
        const4(0, 0), return_(0),
        label('ext'), label('try_s'),
        new_instance(0, INTENT), const_string(1, 'android.intent.action.VIEW'),
        invoke_static([5], uri_parse), move_result_obj(2),
        invoke_direct([0, 1, 2], intent_init),
        invoke_virtual([4], get_ctx), move_result_obj(1),
        invoke_virtual([1, 0], start_act),
        label('try_e'),
        const4(0, 1), return_(0),
        label('h'), move_exception(0), const4(0, 1), return_(0),
    ]
    PUB, CTOR = 0x1, 0x10000
    d.classes = [
        {'name': MA, 'super': ACT, 'access': PUB, 'ifields': [(fW, 0x2)],
         'direct': [{'ref': ma_init, 'access': PUB | CTOR, 'regs': 1, 'ins': 1, 'outs': 1, 'code': [invoke_direct([0], act_init), return_void()]}],
         'virtual': [{'ref': on_create, 'access': 0x4, 'regs': 5, 'ins': 2, 'outs': 2, 'code': create_code},
                     {'ref': on_back, 'access': PUB, 'regs': 3, 'ins': 1, 'outs': 1, 'code': back_code}]},
        {'name': CL, 'super': WVC, 'access': PUB,
         'direct': [{'ref': cl_init, 'access': PUB | CTOR, 'regs': 1, 'ins': 1, 'outs': 1, 'code': [invoke_direct([0], wvc_init), return_void()]}],
         'virtual': [{'ref': should, 'access': PUB, 'regs': 6, 'ins': 3, 'outs': 3, 'code': should_code, 'tries': [('try_s', 'try_e', 'h')]}]},
    ]
    return build_dex(d)

# =====================================================================================
# Binary XML (AndroidManifest.xml)
# =====================================================================================
def string_pool_utf16(strings):
    offs, blob = [], bytearray()
    for s in strings:
        offs.append(len(blob))
        e = s.encode('utf-16-le'); blob += u16(len(e) // 2) + e + b'\0\0'
    blob = pad4(bytes(blob))
    hdr_size = 28
    start = hdr_size + 4 * len(strings)
    body = b''.join(u32(o) for o in offs) + blob
    return u16(0x0001) + u16(hdr_size) + u32(hdr_size + len(body)) + u32(len(strings)) + u32(0) + u32(0) + u32(start) + u32(0) + body

def string_pool_utf8(strings):
    offs, blob = [], bytearray()
    for s in strings:
        offs.append(len(blob)); e = s.encode('utf-8')
        assert len(s) < 128 and len(e) < 128
        blob += u8(len(s)) + u8(len(e)) + e + b'\0'
    blob = pad4(bytes(blob))
    start = 28 + 4 * len(strings)
    body = b''.join(u32(o) for o in offs) + blob
    return u16(0x0001) + u16(28) + u32(28 + len(body)) + u32(len(strings)) + u32(0) + u32(0x100) + u32(start) + u32(0) + body

ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010,
    'launchMode': 0x0101001d, 'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c,
    'versionCode': 0x0101021b, 'versionName': 0x0101021c, 'windowSoftInputMode': 0x0101022b,
    'targetSdkVersion': 0x01010270,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12

def make_manifest(icon_res_id):
    A = lambda name, typ, val: ('android', name, typ, val)
    tree = ('manifest', [(None, 'package', T_STR, PKG), A('versionCode', T_DEC, VERSION_CODE), A('versionName', T_STR, VERSION_NAME)], [
        ('uses-sdk', [A('minSdkVersion', T_DEC, MIN_SDK), A('targetSdkVersion', T_DEC, TARGET_SDK)], []),
        ('uses-permission', [A('name', T_STR, 'android.permission.INTERNET')], []),
        ('application', [A('label', T_STR, APP_LABEL), A('icon', T_REF, icon_res_id)], [
            ('activity', [A('name', T_STR, PKG + '.MainActivity'), A('exported', T_BOOL, True), A('launchMode', T_DEC, 2),
                          A('configChanges', T_HEX, 0x04a0 | 0x0800 | 0x0100), A('windowSoftInputMode', T_HEX, 0x10)], [
                ('intent-filter', [], [
                    ('action', [A('name', T_STR, 'android.intent.action.MAIN')], []),
                    ('category', [A('name', T_STR, 'android.intent.category.LAUNCHER')], []),
                ])
            ])
        ])
    ])
    # collect strings: resource-mapped attr names first
    attr_names = []
    def walk(n):
        for a in n[1]:
            if a[0] == 'android' and a[1] not in attr_names: attr_names.append(a[1])
        for c in n[2]: walk(c)
    walk(tree)
    attr_names.sort(key=lambda x: ATTR_IDS[x])
    strings = list(attr_names)
    def add(s):
        if s not in strings: strings.append(s)
        return strings.index(s)
    add('android'); add(ANDROID_NS)
    def walk2(n):
        add(n[0])
        for a in n[1]:
            add(a[1])
            if a[2] == T_STR: add(a[3])
        for c in n[2]: walk2(c)
    walk2(tree)
    si = lambda s: strings.index(s)

    chunks = bytearray()
    line = [1]
    def node_hdr(typ, size):
        h = u16(typ) + u16(16) + u32(size) + u32(line[0]) + u32(0xffffffff); line[0] += 1; return h
    chunks += node_hdr(0x0100, 24) + u32(si('android')) + u32(si(ANDROID_NS))
    def emit(n):
        name, attrs, kids = n
        def key(a): return ATTR_IDS.get(a[1], 0x7fffffff) if a[0] else -1
        attrs = sorted(attrs, key=lambda a: (0 if a[0] is None else 1, key(a)))
        ab = bytearray()
        for ns, an, typ, val in attrs:
            nsi = si(ANDROID_NS) if ns else 0xffffffff
            if typ == T_STR: raw, data = si(val), si(val)
            elif typ == T_BOOL: raw, data = 0xffffffff, 0xffffffff if val else 0
            else: raw, data = 0xffffffff, val
            ab += u32(nsi) + u32(si(an)) + u32(raw) + u16(8) + u8(0) + u8(typ) + u32(data)
        body = u32(0xffffffff) + u32(si(name)) + u16(20) + u16(20) + u16(len(attrs)) + u16(0) + u16(0) + u16(0) + bytes(ab)
        chunks.extend(node_hdr(0x0102, 16 + len(body)) + body)
        for k in kids: emit(k)
        chunks.extend(node_hdr(0x0103, 24) + u32(0xffffffff) + u32(si(name)))
    emit(tree)
    chunks += node_hdr(0x0101, 24) + u32(si('android')) + u32(si(ANDROID_NS))

    sp = string_pool_utf16(strings)
    rm = u16(0x0180) + u16(8) + u32(8 + 4 * len(attr_names)) + b''.join(u32(ATTR_IDS[a]) for a in attr_names)
    body = sp + rm + bytes(chunks)
    return u16(0x0003) + u16(8) + u32(8 + len(body)) + body

# =====================================================================================
# resources.arsc : satu drawable "icon" -> res/drawable/icon.png
# =====================================================================================
def make_arsc(icon_path):
    gpool = string_pool_utf8([icon_path])
    type_pool = string_pool_utf16(['drawable'])
    key_pool = string_pool_utf16(['icon'])
    spec = u16(0x0202) + u16(16) + u32(16 + 4) + u8(1) + u8(0) + u16(0) + u32(1) + u32(0)
    config = u32(64) + b'\0' * 60
    entries = u16(8) + u16(0) + u32(0) + u16(8) + u8(0) + u8(T_STR) + u32(0)
    thdr = 20 + len(config)
    tchunk_hdr = u16(0x0201) + u16(thdr) + u32(thdr + 4 + len(entries)) + u8(1) + u8(0) + u16(0) + u32(1) + u32(thdr + 4) + config
    tchunk = tchunk_hdr + u32(0) + entries
    name = PKG.encode('utf-16-le'); name = name + b'\0' * (256 - len(name))
    pkg_hdr_size = 288
    type_off = pkg_hdr_size
    key_off = pkg_hdr_size + len(type_pool)
    pkg_body = type_pool + key_pool + spec + tchunk
    pkg = u16(0x0200) + u16(pkg_hdr_size) + u32(pkg_hdr_size + len(pkg_body)) + u32(0x7f) + name + u32(type_off) + u32(1) + u32(key_off) + u32(1) + u32(0) + pkg_body
    body = gpool + pkg
    return u16(0x0002) + u16(12) + u32(12 + len(body)) + u32(1) + body

# =====================================================================================
# ZIP + APK Signature Scheme v2
# =====================================================================================
def make_zip(files):
    """files: list of (name, data, compress). Stored entries aligned to 4 bytes (resources.arsc)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for name, data, compress in files:
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
            zi.create_system = 0
            if not compress:
                hdr_end = buf.tell() + 30 + len(name.encode())
                padlen = (-(hdr_end + 6)) % 4
                zi.extra = u16(0xD935) + u16(2 + padlen) + u16(4) + b'\0' * padlen
            z.writestr(zi, data)
    return buf.getvalue()

def sign_v2(apk, key, cert_der):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    eocd = apk.rfind(b'PK\x05\x06'); assert eocd > 0
    cd_size, cd_off = struct.unpack('<II', apk[eocd + 12:eocd + 20])
    entries, cd, eo = apk[:cd_off], apk[cd_off:cd_off + cd_size], apk[eocd:]
    def chunks(b):
        return [b[i:i + 1048576] for i in range(0, len(b), 1048576)] or []
    allc = chunks(entries) + chunks(cd) + chunks(eo)
    digests = b''.join(hashlib.sha256(b'\xa5' + u32(len(c)) + c).digest() for c in allc)
    top = hashlib.sha256(b'\x5a' + u32(len(allc)) + digests).digest()
    lp = lambda b: u32(len(b)) + b
    ALG = 0x0103  # RSASSA-PKCS1-v1_5 SHA2-256
    signed_data = lp(lp(u32(ALG) + lp(top))) + lp(lp(cert_der)) + lp(b'')
    sig = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed_data) + lp(lp(u32(ALG) + lp(sig))) + lp(pub)
    v2 = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(v2)) + u32(0x7109871a) + v2
    size = len(pair) + 8 + 16
    block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'
    new_eo = bytearray(eo); new_eo[16:20] = u32(cd_off + len(block))
    return entries + block + cd + bytes(new_eo)

def load_or_create_key(path_key, path_cert):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    if os.path.exists(path_key):
        key = serialization.load_pem_private_key(open(path_key, 'rb').read(), None)
        cert = x509.load_pem_x509_certificate(open(path_cert, 'rb').read())
    else:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Warkop Rafli POS'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'J-DATA'), x509.NameAttribute(NameOID.COUNTRY_NAME, 'ID')])
        now = datetime.datetime(2026, 1, 1)
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(x509.random_serial_number()).not_valid_before(now).not_valid_after(now + datetime.timedelta(days=365 * 30))
                .sign(key, hashes.SHA256()))
        open(path_key, 'wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        open(path_cert, 'wb').write(cert.public_bytes(serialization.Encoding.PEM))
    return key, cert.public_bytes(serialization.Encoding.DER)

def main(icon_png, out, keydir):
    os.makedirs(keydir, exist_ok=True)
    key, cert = load_or_create_key(os.path.join(keydir, 'signing-key.pem'), os.path.join(keydir, 'signing-cert.pem'))
    icon_path = 'res/drawable/icon.png'
    files = [
        ('AndroidManifest.xml', make_manifest(0x7f010000), True),
        ('classes.dex', make_dex(), True),
        ('resources.arsc', make_arsc(icon_path), False),
        (icon_path, open(icon_png, 'rb').read(), False),
    ]
    apk = sign_v2(make_zip(files), key, cert)
    open(out, 'wb').write(apk)
    print('APK:', out, len(apk), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
