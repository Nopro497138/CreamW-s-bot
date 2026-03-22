#!/usr/bin/env python3
# pvz_render.py — Plants vs Zombies renderer
# ALL draw calls use ONLY keyword arguments — no positional args after keywords
import sys, json, math, os
from PIL import Image, ImageDraw, ImageFont

CW, CH = 70, 70
COLS, ROWS = 9, 5
SB, TOP, BOT = 52, 52, 44
IW = SB + COLS * CW + 12
IH = TOP + ROWS * CH + BOT
GX, GY = SB, TOP

ATMO = {
    "day":   {"sky":(87,182,255),  "ga":(106,170,50), "gb":(80,140,30),  "ui":(60,120,20)},
    "night": {"sky":(15,15,50),    "ga":(35,65,35),   "gb":(22,48,22),   "ui":(20,50,20)},
    "pool":  {"sky":(100,190,230), "ga":(68,140,68),  "gb":(48,108,48),  "ui":(40,100,80)},
    "fog":   {"sky":(130,140,155), "ga":(70,95,70),   "gb":(52,74,52),   "ui":(60,80,60)},
    "roof":  {"sky":(200,130,70),  "ga":(170,120,80), "gb":(138,98,58),  "ui":(130,80,40)},
}

def fnt(size=13, bold=False):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf".format("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans-{}.ttf".format("Bold" if bold else "Regular"),
        "/usr/share/fonts/truetype/freefont/FreeSans{}.ttf".format("Bold" if bold else ""),
    ]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def hpc(p):
    return (60,200,60) if p>0.6 else (220,200,30) if p>0.3 else (220,50,50)

def hp(d, x, y, w, p, h=5):
    d.rectangle(xy=[x,y,x+w,y+h], fill=(60,60,60))
    d.rectangle(xy=[x,y,x+int(w*p),y+h], fill=hpc(p))

# Safe draw wrappers — ONLY keyword args
def ell(d, cx, cy, rx, ry, fc, oc=None, lw=1):
    d.ellipse(xy=[cx-rx,cy-ry,cx+rx,cy+ry], fill=fc, outline=oc, width=lw)

def rct(d, cx, cy, w, h, fc, oc=None, lw=1):
    d.rectangle(xy=[cx-w//2,cy-h//2,cx+w//2,cy+h//2], fill=fc, outline=oc, width=lw)

def pol(d, pts, fc, oc=None, lw=1):
    d.polygon(xy=pts, fill=fc, outline=oc, width=lw)

def lin(d, x0, y0, x1, y1, fc, lw=1):
    d.line(xy=[x0,y0,x1,y1], fill=fc, width=lw)

def txt(d, s, x, y, f, fc=(255,255,255), a="lt"):
    for dx,dy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
        d.text(xy=(x+dx,y+dy), text=s, font=f, fill=(0,0,0), anchor=a)
    d.text(xy=(x,y), text=s, font=f, fill=fc, anchor=a)

# ── PLANTS ────────────────────────────────────────────────────────────────
def pp(d,cx,cy): # peashooter
    rct(d,cx,cy+12,10,30,(20,110,20))
    ell(d,cx,cy-4,22,22,(50,180,50),(20,110,20),2)
    rct(d,cx+22,cy-4,14,8,(20,110,20))
    ell(d,cx+6,cy-10,5,5,(20,20,20))

def ps(d,cx,cy): # sunflower
    for a in range(0,360,45):
        r=math.radians(a)
        ell(d,int(cx+24*math.cos(r)),int(cy-8+22*math.sin(r)),9,6,(255,220,0))
    ell(d,cx,cy-8,14,14,(200,130,30))
    rct(d,cx,cy+16,8,28,(50,160,30))

def pw(d,cx,cy): # wallnut
    ell(d,cx,cy,26,28,(180,130,60),(120,80,30),2)
    for i in range(3):
        d.arc(xy=[cx-22+i*7,cy-22,cx-10+i*7,cy+22],start=30,end=150,fill=(120,80,30),width=2)
    ell(d,cx-8,cy-6,4,4,(30,20,10))
    ell(d,cx+8,cy-6,4,4,(30,20,10))
    d.arc(xy=[cx-8,cy+2,cx+8,cy+12],start=0,end=180,fill=(30,20,10),width=2)

def pcb(d,cx,cy): # cherrybomb
    ell(d,cx-12,cy+4,18,18,(220,30,30),(150,10,10),2)
    ell(d,cx+12,cy+4,18,18,(220,30,30),(150,10,10),2)
    lin(d,cx-12,cy-12,cx-6,cy-18,(60,140,30),3)
    lin(d,cx+12,cy-12,cx+6,cy-18,(60,140,30),3)
    ell(d,cx-12,cy+2,5,5,(255,80,80))
    ell(d,cx+12,cy+2,5,5,(255,80,80))

def ppm(d,cx,cy): # potatomine
    ell(d,cx,cy+10,22,14,(160,120,60),(100,70,30),2)
    rct(d,cx,cy-10,6,16,(100,70,30))
    ell(d,cx,cy-18,4,4,(200,50,50))

def psp(d,cx,cy): # snowpea
    rct(d,cx,cy+12,10,30,(50,160,50))
    ell(d,cx,cy-4,22,22,(100,200,230),(60,150,180),2)
    rct(d,cx+22,cy-4,14,8,(60,150,180))
    ell(d,cx+6,cy-10,5,5,(20,20,20))

def pch(d,cx,cy): # chomper
    rct(d,cx,cy+12,10,28,(120,50,160))
    pol(d,[(cx-20,cy-18),(cx+20,cy-18),(cx+20,cy+4),(cx-20,cy+4)],(200,60,220),(130,30,150))
    pol(d,[(cx-20,cy+4),(cx+20,cy+4),(cx+20,cy+16),(cx-20,cy+16)],(150,40,180),(100,20,120))
    for i in range(4):
        t=cx-15+i*10; pol(d,[(t,cy-18),(t+6,cy-18),(t+3,cy-8)],(255,255,255))
    for i in range(3):
        t=cx-10+i*10; pol(d,[(t,cy+4),(t+6,cy+4),(t+3,cy+14)],(255,255,255))
    ell(d,cx-10,cy-24,7,7,(255,255,255)); ell(d,cx+10,cy-24,7,7,(255,255,255))
    ell(d,cx-10,cy-24,3,3,(30,30,30));   ell(d,cx+10,cy-24,3,3,(30,30,30))

def pr(d,cx,cy): # repeater
    rct(d,cx,cy+12,10,30,(20,110,30))
    ell(d,cx,cy-4,22,22,(30,160,40),(20,110,30),2)
    rct(d,cx+22,cy-9,14,6,(20,110,30)); rct(d,cx+22,cy+1,14,6,(20,110,30))
    ell(d,cx+6,cy-10,5,5,(20,20,20))

def shb(d,cx,cy,cap,stem=(230,230,220),crx=20,cry=16):
    rct(d,cx,cy+14,12,20,stem,(180,180,170))
    oc=(max(0,cap[0]-40),max(0,cap[1]-40),max(0,cap[2]-40))
    d.chord(xy=[cx-crx,cy-cry*2,cx+crx,cy+2],start=180,end=360,fill=cap,outline=oc)

def ppf(d,cx,cy): shb(d,cx,cy,(80,120,210)); [ell(d,cx+x,cy+y,r,r,(255,255,255)) for x,y,r in [(-8,-14,5),(8,-14,5),(0,-20,4)]]
def pss(d,cx,cy): shb(d,cx,cy,(230,190,10)); ell(d,cx,cy-8,6,6,(255,240,100))
def pfm(d,cx,cy): shb(d,cx,cy,(120,80,40)); [ell(d,cx+x,cy-20-i*4,8,8,(180,220,100)) for i,x in enumerate([-12,0,12])]
def psc(d,cx,cy):
    shb(d,cx,cy,(220,90,150),crx=16,cry=24)
    ell(d,cx-6,cy-2,5,6,(255,255,255)); ell(d,cx+6,cy-2,5,6,(255,255,255))
    ell(d,cx-6,cy-2,2,3,(30,30,30));   ell(d,cx+6,cy-2,2,3,(30,30,30))
def pic(d,cx,cy):
    shb(d,cx,cy,(140,220,255))
    for a in range(0,360,60):
        r=math.radians(a); lin(d,cx,cy-10,int(cx+14*math.cos(r)),int(cy-10+14*math.sin(r)),(200,240,255),2)
def pds(d,cx,cy):
    shb(d,cx,cy,(60,20,80),crx=26,cry=20)
    ell(d,cx,cy-14,7,7,(200,200,200)); ell(d,cx-4,cy-16,3,3,(30,20,30)); ell(d,cx+4,cy-16,3,3,(30,20,30))
    lin(d,cx-5,cy-10,cx+5,cy-10,(30,20,30),2)
def psq(d,cx,cy):
    d.rounded_rectangle(xy=[cx-22,cy-16,cx+22,cy+22],radius=10,fill=(60,180,60),outline=(30,130,30),width=2)
    for x in range(cx-18,cx+20,8): lin(d,x,cy-16,x,cy+22,(30,120,30),2)
    ell(d,cx-8,cy-4,5,5,(20,20,20)); ell(d,cx+8,cy-4,5,5,(20,20,20))
def ptp(d,cx,cy):
    dc=(10,120,20); lin(d,cx,cy+20,cx,cy-18,dc,8); lin(d,cx-2,cy-8,cx-24,cy-22,dc,6); lin(d,cx-2,cy-8,cx+24,cy-22,dc,6)
    for hx,hy in [(cx,cy-28),(cx-24,cy-32),(cx+24,cy-32)]:
        ell(d,hx,hy,14,14,(20,200,40),dc,2); rct(d,hx+14,hy,10,6,dc)
def ptw(d,cx,cy):
    ell(d,cx,cy+8,26,18,(160,80,30),(100,50,15),2)
    for i in range(3): lin(d,cx-18+i*18,cy-4,cx-14+i*18,cy+20,(120,60,20),3)
    for dx,c in [(-8,(255,80,0)),(0,(255,140,0)),(8,(255,80,0))]: pol(d,[(cx+dx-6,cy-4),(cx+dx+6,cy-4),(cx+dx,cy-24)],c)
def pts(d,cx,cy):
    for ox in [-14,14]:
        for a in range(0,360,45): r=math.radians(a); ell(d,int(cx+ox+16*math.cos(r)),int(cy-6+14*math.sin(r)),6,4,(255,220,0))
        ell(d,cx+ox,cy-6,10,10,(200,130,30))
    rct(d,cx,cy+18,8,22,(50,160,30))
def ptn(d,cx,cy):
    d.rounded_rectangle(xy=[cx-18,cy-30,cx+18,cy+28],radius=8,fill=(180,130,60),outline=(120,80,30),width=2)
    rct(d,cx,cy-28,30,10,(140,100,40))
    for i in range(3): d.arc(xy=[cx-14+i*6,cy-22,cx-6+i*6,cy+20],start=30,end=150,fill=(120,80,30),width=2)
    ell(d,cx-6,cy-4,4,4,(30,20,10)); ell(d,cx+6,cy-4,4,4,(30,20,10))
def pca(d,cx,cy):
    dc=(30,120,30)
    rct(d,cx,cy+4,16,40,(50,160,50),dc,2); rct(d,cx-22,cy-8,12,6,(50,160,50),dc,2); rct(d,cx-22,cy-18,6,20,(50,160,50),dc,2)
    rct(d,cx+22,cy-4,12,6,(50,160,50),dc,2); rct(d,cx+22,cy-20,6,24,(50,160,50),dc,2)
    for y in range(-20,22,7): lin(d,cx-8,cy+y,cx-14,cy+y-3,(200,200,50)); lin(d,cx+8,cy+y,cx+14,cy+y-3,(200,200,50))

PDRAW={"peashooter":pp,"sunflower":ps,"wallnut":pw,"cherrybomb":pcb,"potatomine":ppm,
       "snowpea":psp,"chomper":pch,"repeater":pr,"puffshroom":ppf,"sunshroom":pss,
       "fumeshroom":pfm,"scaredy":psc,"iceshroom":pic,"doomshroom":pds,"squash":psq,
       "threepeater":ptp,"torchwood":ptw,"twinsunflower":pts,"tallnut":ptn,"cactus":pca}

# ── ZOMBIES ───────────────────────────────────────────────────────────────
def zbdy(d,cx,cy,col,hcol,s=1.0):
    bw,bh=int(20*s),int(26*s)
    rct(d,cx,cy+int(8*s),bw,bh,(200,210,200),(100,110,100))
    lin(d,cx,cy+int(4*s),cx,cy+int(20*s),(150,160,150),max(1,int(2*s)))
    oc=(max(0,col[0]-30),max(0,col[1]-30),max(0,col[2]-30))
    ell(d,cx,cy-int(12*s),int(18*s),int(16*s),hcol,oc,max(1,int(2*s)))
    ew=max(1,int(4*s)); es=max(1,int(3*s))
    ell(d,cx-int(6*s),cy-int(14*s),ew,es,(30,20,10)); ell(d,cx+int(6*s),cy-int(14*s),ew,es,(30,20,10))
    lin(d,cx-bw-int(8*s),cy+int(2*s),cx-bw,cy+int(2*s),hcol,max(1,int(6*s)))
    lin(d,cx+bw+int(8*s),cy+int(2*s),cx+bw,cy+int(2*s),hcol,max(1,int(6*s)))
    lin(d,cx-int(8*s),cy+int(22*s),cx-int(12*s),cy+int(34*s),(80,70,60),max(1,int(7*s)))
    lin(d,cx+int(8*s),cy+int(22*s),cx+int(14*s),cy+int(34*s),(80,70,60),max(1,int(7*s)))
    pol(d,[(cx,cy+int(2*s)),(cx-int(4*s),cy+int(10*s)),(cx,cy+int(20*s)),(cx+int(4*s),cy+int(10*s))],(180,30,30))

def zr(d,cx,cy): zbdy(d,cx,cy,(190,200,170),(200,215,185))
def zco(d,cx,cy):
    zbdy(d,cx,cy,(200,190,160),(220,130,30))
    pol(d,[(cx-14,cy-22),(cx+14,cy-22),(cx,cy-44)],(230,120,20),(180,80,10))
def zbu(d,cx,cy):
    zbdy(d,cx,cy,(185,185,200),(160,165,175))
    d.rounded_rectangle(xy=[cx-16,cy-36,cx+16,cy-20],radius=4,fill=(160,165,175),outline=(100,105,115),width=2)
    lin(d,cx-18,cy-36,cx+18,cy-36,(120,125,135),3)
def zfl(d,cx,cy):
    zr(d,cx,cy); lin(d,cx+12,cy-30,cx+12,cy+6,(160,150,130),2)
    pol(d,[(cx+12,cy-30),(cx+28,cy-24),(cx+12,cy-18)],(220,40,40))
def zpv(d,cx,cy): zbdy(d,cx,cy,(180,180,160),(200,200,180)); lin(d,cx+8,cy-20,cx+22,cy+30,(180,150,100),3)
def znp(d,cx,cy):
    zbdy(d,cx,cy,(200,195,175),(230,220,190))
    d.rounded_rectangle(xy=[cx-22,cy-6,cx-2,cy+14],radius=2,fill=(230,220,180),outline=(160,150,120),width=1)
    for y in range(cy-2,cy+12,4): lin(d,cx-20,y,cx-4,y,(120,110,90))
def zfb(d,cx,cy):
    zbdy(d,cx,cy,(160,120,70),(80,60,40),s=1.2)
    ell(d,cx,cy-14,22,18,(80,60,40),(50,40,20),2)
    lin(d,cx-16,cy-14,cx+16,cy-14,(255,255,255),2); lin(d,cx-10,cy-22,cx+10,cy-22,(255,255,255),2); lin(d,cx-10,cy-6,cx+10,cy-6,(255,255,255),2)
def zda(d,cx,cy):
    zbdy(d,cx,cy,(160,80,160),(200,100,200)); rct(d,cx,cy-2,22,28,(160,80,160),(120,50,130))
    for i,y in enumerate(range(cy-10,cy+10,8)): rct(d,cx,y,22,6,(200,100+i*20,200))
def zba(d,cx,cy):
    zr(d,cx,cy); lin(d,cx+10,cy-20,cx+10,cy-42,(200,200,200))
    ell(d,cx+10,cy-52,12,16,(255,80,80),(200,40,40),2)
def zdi(d,cx,cy):
    zbdy(d,cx,cy,(150,130,110),(100,80,60)); rct(d,cx,cy-28,22,10,(80,70,60),(60,50,40))
    lin(d,cx+16,cy-16,cx+32,cy+8,(140,130,110),4); pol(d,[(cx+28,cy+4),(cx+36,cy),(cx+34,cy+12)],(180,180,190))
def zga(d,cx,cy):
    zbdy(d,cx,cy,(100,90,70),(80,70,55),s=1.8)
    lin(d,cx+54,cy-54,cx+54,cy+43,(120,90,60),8); lin(d,cx+32,cy-32,cx+75,cy-32,(120,90,60),5)
def zi(d,cx,cy):
    ell(d,cx,cy-4,16,18,(180,130,100),(100,70,50)); rct(d,cx,cy+12,12,16,(150,110,90))
    ell(d,cx-6,cy-12,3,3,(30,20,10)); ell(d,cx+6,cy-12,3,3,(30,20,10))
    pol(d,[(cx-16,cy-22),(cx-8,cy-18),(cx-12,cy-10)],(180,30,30))
    pol(d,[(cx+16,cy-22),(cx+8,cy-18),(cx+12,cy-10)],(180,30,30))

ZDRAW={"regular":zr,"cone":zco,"bucket":zbu,"flag":zfl,"polevault":zpv,"newspaper":znp,
       "football":zfb,"dancing":zda,"balloon":zba,"digger":zdi,"gargantuar":zga,"imp":zi}

# ── BACKGROUND ────────────────────────────────────────────────────────────
def bg(img,d,ak):
    a=ATMO.get(ak,ATMO["day"])
    img.paste(a["sky"],[0,0,IW,GY])
    if ak=="night":
        for sx,sy in [(50,15),(120,8),(200,22),(300,12),(400,18),(560,6),(640,20)]: ell(d,sx,sy,2,2,(255,255,220))
    if ak=="roof":
        rct(d,IW//2,GY-10,IW,24,(180,120,70))
        for xi in range(0,IW,30): d.rectangle(xy=[xi,GY-22,xi+14,GY],fill=(160,100,55))
    for row in range(ROWS):
        c=a["ga"] if row%2==0 else a["gb"]
        y0=GY+row*CH; d.rectangle(xy=[GX,y0,GX+COLS*CW,y0+CH],fill=c)
    if ak=="pool":
        for row in [2,3]:
            y0=GY+row*CH; d.rectangle(xy=[GX,y0,GX+COLS*CW,y0+CH],fill=(60,130,180))
            for xi in range(GX+10,GX+COLS*CW,20):
                d.arc(xy=[xi,y0+CH//2-4,xi+16,y0+CH//2+4],start=0,end=180,fill=(100,180,220),width=2)
    if ak=="fog":
        fog=Image.new("RGBA",(IW,IH),(0,0,0,0)); fd=ImageDraw.Draw(fog)
        for xi in range(0,IW,60):
            for yi in range(GY,GY+ROWS*CH,50): fd.ellipse(xy=[xi,yi,xi+80,yi+40],fill=(200,210,220,80))
        img.paste(fog,mask=fog)
    for c2 in range(COLS+1): x=GX+c2*CW; d.line(xy=[x,GY,x,GY+ROWS*CH],fill=(0,0,0,60),width=1)
    for r2 in range(ROWS+1): y=GY+r2*CH; d.line(xy=[GX,y,GX+COLS*CW,y],fill=(0,0,0,60),width=1)

def ui(d,state,ak):
    a=ATMO.get(ak,ATMO["day"]); d.rectangle(xy=[0,0,IW,TOP],fill=a["ui"])
    txt(d,f"Sun: {state.get('sun',50)}",8,6,fnt(20,True),(255,240,100))
    txt(d,f"Wave {state.get('wave',1)}/{state.get('maxWaves',5)}",IW//2,6,fnt(20,True),(255,255,255),"mt")
    lvls=["Day","Night","Pool","Fog","Roof"]; lv=state.get("level",0)
    txt(d,f"Level {lv+1}-{lvls[lv] if lv<len(lvls) else '?'}",IW-8,6,fnt(13),(220,240,255),"rt")
    d.rectangle(xy=[0,GY,SB,GY+ROWS*CH],fill=(0,0,0,80))
    for r in range(ROWS):
        cy=GY+r*CH+CH//2
        txt(d,"~" if (ak=="pool" and r in [2,3]) else str(r+1),6,cy-10,fnt(13),(255,255,200))
    sel=state.get("selectedPlant"); d.rectangle(xy=[0,GY+ROWS*CH,IW,IH],fill=a["ui"])
    txt(d,f"Selected: {sel}  -> pick Lane" if sel else "Select plant then pick Lane",8,GY+ROWS*CH+8,fnt(13),(255,255,200) if sel else (200,200,200))
    txt(d,f"Tick {state.get('tick',0)}",IW-8,GY+ROWS*CH+8,fnt(12),(180,180,180),"rt")

def lvlsel(d,state):
    for y in range(IH):
        t=y/IH; d.line(xy=[0,y,IW,y],fill=(int(135+t*40),int(206-t*60),int(235-t*80)))
    for cx2,cy2,cw,ch in [(80,60,80,40),(220,40,90,45),(400,70,100,50),(560,45,80,38),(640,80,70,35),(150,100,60,30)]:
        ell(d,cx2,cy2,cw,ch,(255,255,255)); ell(d,cx2-int(cw*.4),cy2+4,int(cw*.5),int(ch*.7),(245,245,255)); ell(d,cx2+int(cw*.4),cy2+4,int(cw*.5),int(ch*.7),(245,245,255))
    txt(d,"SELECT YOUR LEVEL",IW//2,20,fnt(28,True),(255,255,255),"mt")
    unlocked=state.get("unlockedLevels",[0])
    dfs=[(80,200),(200,280),(350,200),(500,280),(620,200)]; nms=["Day 1","Night 2","Pool 3","Fog 4","Roof 5"]
    cols=[(255,220,80),(100,100,200),(80,180,220),(160,160,160),(220,140,60)]
    for i,(x,y) in enumerate(dfs):
        if i<len(dfs)-1: nx,ny=dfs[i+1]; d.line(xy=[x,y,nx,ny],fill=(200,200,180),width=3)
        lo=i not in unlocked; bc=(100,100,100) if lo else cols[i]
        d.ellipse(xy=[x-40,y-20,x+40,y+20],fill=bc,outline=(50,50,50) if lo else (255,255,255),width=2)
        if lo: txt(d,"LOCKED",x,y-8,fnt(14,True),(180,180,180),"mt")
        else:
            st=state.get("levelStars",{}).get(str(i),0)
            txt(d,nms[i],x,y-14,fnt(16,True),(30,20,10),"mt"); txt(d,"*"*st+"-"*(3-st),x,y+2,fnt(12),(30,20,10),"mt")
    txt(d,"Choose a level!",IW//2,IH-25,fnt(13),(255,255,255),"mt")

def tut(d,step):
    d.rectangle(xy=[0,0,IW,IH],fill=(0,0,0,160))
    tips=[("Sun = Currency","Sunflowers produce sun.\nCollect it to buy plants!"),("Planting","Select plant below,\nthen click Lane button."),("Zombies walk left","Stop them before they\nreach the left edge!"),("Next Turn","Plants shoot & zombies\nmove each press."),("Between Waves","Start next wave when ready.\nPlan wisely!")]
    if step<len(tips):
        lb,ds=tips[step]
        d.rounded_rectangle(xy=[IW//2-240,130,IW//2+240,290],radius=16,fill=(40,40,60,230),outline=(255,220,80),width=3)
        txt(d,lb,IW//2,148,fnt(22,True),(255,220,80),"mt")
        for i,line in enumerate(ds.split("\n")): txt(d,line,IW//2,182+i*24,fnt(15),(220,230,255),"mt")
        txt(d,f"Step {step+1}/5",IW//2,IH-30,fnt(13),(200,200,200),"mt")

def end(d,won):
    d.rectangle(xy=[0,0,IW,IH],fill=(0,0,0,180))
    if won:
        txt(d,"YOU WIN!",IW//2,IH//2-50,fnt(36,True),(255,220,50),"mt")
        txt(d,"Zombies defeated!",IW//2,IH//2+10,fnt(16),(200,255,200),"mt")
    else:
        txt(d,"GAME OVER",IW//2,IH//2-50,fnt(36,True),(220,50,50),"mt")
        txt(d,"They ate your brains...",IW//2,IH//2+10,fnt(16),(255,180,180),"mt")
    txt(d,"Use buttons to continue.",IW//2,IH//2+45,fnt(16),(200,200,200),"mt")

def render(state,out):
    img=Image.new("RGBA",(IW,IH),(0,0,0,255)); d=ImageDraw.Draw(img,"RGBA")
    phase=state.get("phase","playing"); ak=state.get("atmosphere","day")
    if phase=="level_select": lvlsel(d,state); img.convert("RGB").save(out,"PNG"); return
    bg(img,d,ak); ui(d,state,ak)
    for ri,row in enumerate(state.get("grid",[])):
        for ci,cell in enumerate(row):
            if not cell: continue
            cx=GX+ci*CW+CW//2; cy=GY+ri*CH+CH//2-4
            fn=PDRAW.get(cell.get("type",""))
            if fn: fn(d,cx,cy)
            hp(d,cx-22,GY+ri*CH+CH-10,44,cell.get("hp",300)/max(cell.get("maxHp",300),1))
    for z in state.get("zombies",[]):
        zx=int(GX+z["x"]*CW); zy=int(GY+z["row"]*CH+CH//2-4)
        fn=ZDRAW.get(z.get("type",""))
        if fn: fn(d,zx,zy)
        hp(d,zx-22,int(GY+z["row"]*CH+CH-10),44,z.get("hp",100)/max(z.get("maxHp",100),1))
    pc={"pea":(80,200,80),"snow":(150,230,255),"fire":(255,120,20),"spike":(200,200,80)}
    for p in state.get("projectiles",[]):
        ell(d,int(GX+p["x"]*CW),int(GY+p["row"]*CH+CH//2-4),6,6,pc.get(p.get("type","pea"),(80,200,80)))
    if phase=="tutorial": tut(d,state.get("tutorialStep",0))
    elif phase=="game_over": end(d,False)
    elif phase=="victory": end(d,True)
    img.convert("RGB").save(out,"PNG")

if __name__=="__main__":
    if len(sys.argv)<2: print("Usage: pvz_render.py <out.png>",file=sys.stderr); sys.exit(1)
    render(json.loads(sys.stdin.read()),sys.argv[1])
