from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
S=2048
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(len(a)))
def grad(size,c1,c2,angle=135):
    w,h=size; im=Image.new('RGBA',size); px=im.load()
    a=math.radians(angle); dx,dy=math.cos(a),math.sin(a)
    mn=min(0,dx*w)+min(0,dy*h); mx=max(0,dx*w)+max(0,dy*h)
    for y in range(h):
        for x in range(0,w):
            t=((x*dx+y*dy)-mn)/(mx-mn); px[x,y]=lerp(c1,c2,t)
    return im
def build(full_bg=True):
    base=Image.new('RGBA',(S,S),(0,0,0,0))
    # background
    bg=grad((S//8,S//8),(58,32,20,255),(18,10,7,255),120).resize((S,S),Image.BICUBIC)
    mask=Image.new('L',(S,S),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.22) if not full_bg else 0,fill=255)
    base.paste(bg,(0,0),mask)
    # warm glow
    glow=Image.new('RGBA',(S,S),(0,0,0,0)); g=ImageDraw.Draw(glow)
    g.ellipse([S*0.18,S*0.10,S*0.82,S*0.70],fill=(242,170,76,110))
    glow=glow.filter(ImageFilter.GaussianBlur(S*0.09)); base=Image.alpha_composite(base,Image.composite(glow,Image.new('RGBA',(S,S)),mask))
    d=ImageDraw.Draw(base)
    gold=(242,181,68,255); cream=(250,236,214,255); brown=(92,52,30,255); dark=(40,22,14,255)
    # steam (3 wavy lines)
    for i,ox in enumerate([-0.085,0,0.085]):
        pts=[]
        for k in range(0):
            t=k/59; y=S*(0.40-0.17*t); x=S*(0.5+ox)+math.sin(t*math.pi*2+i)*S*0.022
            pts.append((x,y))
        for k in range(400):
            t=k/399; y=S*(0.40-0.17*t); x=S*(0.5+ox)+math.sin(t*math.pi*2+i)*S*0.022; r=S*0.011*(1-0.35*t)
            d.ellipse([x-r,y-r,x+r,y+r],fill=(255,214,140,255))
    # saucer
    d.ellipse([S*0.22,S*0.64,S*0.78,S*0.72],fill=(205,160,110,255))
    d.ellipse([S*0.25,S*0.635,S*0.75,S*0.695],fill=cream)
    # handle (ring on right)
    d.ellipse([S*0.60,S*0.47,S*0.78,S*0.63],outline=cream,width=int(S*0.035))
    # cup body: polygon trapezoid with rounded bottom
    top_y=S*0.43; bot_y=S*0.665
    d.rounded_rectangle([S*0.29,top_y,S*0.71,bot_y],radius=int(S*0.09),fill=cream)
    d.rectangle([S*0.29,top_y,S*0.71,top_y+S*0.10],fill=cream)
    # rim & coffee
    d.ellipse([S*0.29,top_y-S*0.035,S*0.71,top_y+S*0.035],fill=cream)
    d.ellipse([S*0.31,top_y-S*0.022,S*0.69,top_y+S*0.024],fill=dark)
    # latte heart
    hx,hy=S*0.5,top_y+S*0.0
    d.ellipse([hx-S*0.05,hy-S*0.016,hx,hy+S*0.012],fill=(214,170,120,255)); d.ellipse([hx,hy-S*0.016,hx+S*0.05,hy+S*0.012],fill=(214,170,120,255))
    d.polygon([(hx-S*0.047,hy+S*0.002),(hx+S*0.047,hy+S*0.002),(hx,hy+S*0.02)],fill=(214,170,120,255))
    # J monogram on cup
    fJ=ImageFont.truetype('poppins-700.ttf',int(S*0.20))
    bb=d.textbbox((0,0),'J',font=fJ); w=bb[2]-bb[0]; h=bb[3]-bb[1]
    d.text((S*0.5-w/2-bb[0],S*0.555-h/2-bb[1]),'J',font=fJ,fill=brown)
    # wordmark
    fW=ImageFont.truetype('poppins-700.ttf',int(S*0.105))
    word='JCOFFE'; sp=S*0.012
    widths=[d.textbbox((0,0),c,font=fW)[2]-d.textbbox((0,0),c,font=fW)[0] for c in word]
    tw=sum(widths)+sp*(len(word)-1); x=S*0.5-tw/2; y=S*0.745
    for c,wc in zip(word,widths):
        bb=d.textbbox((0,0),c,font=fW); d.text((x-bb[0],y-bb[1]),c,font=fW,fill=gold); x+=wc+sp
    return base
for full,name in [(False,'logo-rounded'),(True,'logo-square')]:
    im=build(full)
    for sz in (512,192):
        im.resize((sz,sz),Image.LANCZOS).save(f'{name}-{sz}.png',optimize=True)
print('ok')
