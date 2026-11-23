import struct, hashlib, sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
raw=open(sys.argv[1],'rb').read()
eocd=raw.rfind(b'PK\x05\x06'); cd_size,cd_off=struct.unpack('<II',raw[eocd+12:eocd+20])
assert raw[cd_off-16:cd_off]==b'APK Sig Block 42'
size=struct.unpack('<Q',raw[cd_off-24:cd_off-16])[0]; start=cd_off-size-8
assert struct.unpack('<Q',raw[start:start+8])[0]==size
p=start+8; v2=None
while p<cd_off-24:
    ln=struct.unpack('<Q',raw[p:p+8])[0]; pid=struct.unpack('<I',raw[p+8:p+12])[0]
    if pid==0x7109871a: v2=raw[p+12:p+8+ln]
    p+=8+ln
assert p==cd_off-24 and v2
def lp(b,o): n=struct.unpack('<I',b[o:o+4])[0]; return b[o+4:o+4+n], o+4+n
signers,_=lp(v2,0); signer,_=lp(signers,0)
sd,o=lp(signer,0); sigs,o=lp(signer,o); pub,o=lp(signer,o)
digs,o2=lp(sd,0); certs,o2=lp(sd,o2)
d1,_=lp(digs,0); alg=struct.unpack('<I',d1[:4])[0]; dig,_=lp(d1,4)
c1,_=lp(certs,0); cert=x509.load_der_x509_certificate(c1)
s1,_=lp(sigs,0); salg=struct.unpack('<I',s1[:4])[0]; sig,_=lp(s1,4)
assert alg==salg==0x0103
cert.public_key().verify(sig, sd, padding.PKCS1v15(), hashes.SHA256())
assert cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)==pub
eo=bytearray(raw[eocd:]); eo[16:20]=struct.pack('<I',start)
secs=[raw[:start], raw[cd_off:cd_off+cd_size], bytes(eo)]
ch=[s[i:i+1<<20] for s in secs for i in range(0,len(s),1<<20)]
ch=[s[i:i+(1<<20)] for s in secs for i in range(0,len(s),1<<20)]
top=hashlib.sha256(b'\x5a'+struct.pack('<I',len(ch))+b''.join(hashlib.sha256(b'\xa5'+struct.pack('<I',len(c))+c).digest() for c in ch)).digest()
assert top==dig, 'digest mismatch'
print('v2 signature OK; cert SHA-256:', hashlib.sha256(c1).hexdigest())
