#!/usr/bin/env python3
"""
PvZ Discord Bot – Game Image Renderer
Input : JSON game state on stdin
Output: PNG saved to path given as argv[1]
"""
import sys, json, math, os
from PIL import Image, ImageDraw, ImageFont

# ── Dimensions ──────────────────────────────────────────────────────────────
CW, CH     = 70, 70
COLS, ROWS = 9, 5
SB         = 52
TOP        = 52
BOT        = 44
IW         = SB + COLS*CW + 12
IH         = TOP + ROWS*CH + BOT
GX, GY     = SB, TOP

# ── Atmospheres ─────────────────────────────────────────────────────────────
ATMO = {
    "day":   dict(sky=(87,182,255),  ga=(106,170,50),  gb=(80,140,30),  ui=(60,120,20)),
    "night": dict(sky=(15,15,50),    ga=(35,65,35),    gb=(22,48,22),   ui=(20,50,20)),
    "pool":  dict(sky=(100,190,230), ga=(68,140,68),   gb=(48,108,48),  ui=(40,100,80)),
    "fog":   dict(sky=(130,140,155), ga=(70,95,70),    gb=(52,74,52),   ui=(60,80,60)),
    "roof":  dict(sky=(200,130,70),  ga=(170,120,80),  gb=(138,98,58),  ui=(130,80,40)),
}

# ── Font loader ──────────────────────────────────────────────────────────────
def font(size=13, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf".format("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans-{}.ttf".format("Bold" if bold else "Regular"),
        "/usr/share/fonts/truetype/freefont/FreeSans{}.ttf".format("Bold" if bold else ""),
    ]
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

# ── Drawing helpers ──────────────────────────────────────────────────────────
def hp_color(pct):
    if pct > 0.6: return (60,200,60)
    if pct > 0.3: return (220,200,30)
    return (220,50,50)

def draw_hp(draw, x, y, w, pct, h=5):
    draw.rectangle([x,y,x+w,y+h], fill=(60,60,60))
    draw.rectangle([x,y,x+int(w*pct),y+h], fill=hp_color(pct))

def ellipse(draw, cx, cy, rx, ry, fill, outline=None, ow=1):
    draw.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=fill, outline=outline, width=ow)

def rect(draw, cx, cy, w, h, fill, outline=None, ow=1):
    draw.rectangle([cx-w//2, cy-h//2, cx+w//2, cy+h//2], fill=fill, outline=outline, width=ow)

def poly(draw, points, fill, outline=None, ow=1):
    draw.polygon(points, fill=fill, outline=outline, width=ow)

def txt(draw, text, x, y, fnt, fill=(255,255,255), anchor="lt"):
    for dx,dy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
        draw.text((x+dx,y+dy), text, font=fnt, fill=(0,0,0), anchor=anchor)
    draw.text((x,y), text, font=fnt, fill=fill, anchor=anchor)

# ── Plant drawing ─────────────────────────────────────────────────────────────
def draw_peashooter(draw, cx, cy):
    rect(draw, cx, cy+12, 10, 30, (20,110,20))
    ellipse(draw, cx, cy-4, 22, 22, (50,180,50), (20,110,20), 2)
    rect(draw, cx+22, cy-4, 14, 8, (20,110,20))
    ellipse(draw, cx+6, cy-10, 5, 5, (20,20,20))

def draw_sunflower(draw, cx, cy):
    for a in range(0, 360, 45):
        r = math.radians(a)
        px, py = int(cx+24*math.cos(r)), int(cy-8+22*math.sin(r))
        ellipse(draw, px, py, 9, 6, (255,220,0))
    ellipse(draw, cx, cy-8, 14, 14, (200,130,30))
    rect(draw, cx, cy+16, 8, 28, (50,160,30))
    ellipse(draw, cx+8, cy+6, 8, 5, (50,160,30))

def draw_wallnut(draw, cx, cy):
    ellipse(draw, cx, cy, 26, 28, (180,130,60), (120,80,30), 2)
    for i in range(3):
        draw.arc([cx-22+i*7, cy-22, cx-10+i*7, cy+22], start=30, end=150, fill=(120,80,30), width=2)
    ellipse(draw, cx-8, cy-6, 4, 4, (30,20,10))
    ellipse(draw, cx+8, cy-6, 4, 4, (30,20,10))
    draw.arc([cx-8,cy+2,cx+8,cy+12], start=0, end=180, fill=(30,20,10), width=2)

def draw_cherrybomb(draw, cx, cy):
    ellipse(draw, cx-12, cy+4, 18, 18, (220,30,30), (150,10,10), 2)
    ellipse(draw, cx+12, cy+4, 18, 18, (220,30,30), (150,10,10), 2)
    draw.line([cx-12,cy-12,cx-6,cy-18], fill=(60,140,30), width=3)
    draw.line([cx+12,cy-12,cx+6,cy-18], fill=(60,140,30), width=3)
    draw.arc([cx-10,cy-22,cx+10,cy-12], 0, 180, fill=(60,140,30), width=3)
    ellipse(draw, cx-12, cy+2, 5, 5, (255,80,80))
    ellipse(draw, cx+12, cy+2, 5, 5, (255,80,80))

def draw_potatomine(draw, cx, cy):
    ellipse(draw, cx, cy+10, 22, 14, (160,120,60), (100,70,30), 2)
    rect(draw, cx, cy-10, 6, 16, (100,70,30))
    ellipse(draw, cx, cy-18, 4, 4, (200,50,50))
    ellipse(draw, cx-8, cy+8, 4, 4, (30,20,10))
    ellipse(draw, cx+8, cy+8, 4, 4, (30,20,10))

def draw_snowpea(draw, cx, cy):
    rect(draw, cx, cy+12, 10, 30, (50,160,50))
    ellipse(draw, cx, cy-4, 22, 22, (100,200,230), (60,150,180), 2)
    rect(draw, cx+22, cy-4, 14, 8, (60,150,180))
    ellipse(draw, cx+6, cy-10, 5, 5, (20,20,20))
    for a in [0, 60, 120]:
        r = math.radians(a)
        draw.line([int(cx+18+5*math.cos(r)), int(cy-4+5*math.sin(r)),
                   int(cx+18-5*math.cos(r)), int(cy-4-5*math.sin(r))],
                  fill=(200,240,255), width=1)

def draw_chomper(draw, cx, cy):
    rect(draw, cx, cy+12, 10, 28, (120,50,160))
    poly(draw, [(cx-20,cy-18),(cx+20,cy-18),(cx+20,cy+4),(cx-20,cy+4)],
         fill=(200,60,220), outline=(130,30,150))
    poly(draw, [(cx-20,cy+4),(cx+20,cy+4),(cx+20,cy+16),(cx-20,cy+16)],
         fill=(150,40,180), outline=(100,20,120))
    for i in range(4):
        tx = cx-15+i*10
        poly(draw, [(tx,cy-18),(tx+6,cy-18),(tx+3,cy-8)], fill=(255,255,255))
    for i in range(3):
        tx = cx-10+i*10
        poly(draw, [(tx,cy+4),(tx+6,cy+4),(tx+3,cy+14)], fill=(255,255,255))
    ellipse(draw, cx-10, cy-24, 7, 7, (255,255,255))
    ellipse(draw, cx+10, cy-24, 7, 7, (255,255,255))
    ellipse(draw, cx-10, cy-24, 3, 3, (30,30,30))
    ellipse(draw, cx+10, cy-24, 3, 3, (30,30,30))

def draw_repeater(draw, cx, cy):
    rect(draw, cx, cy+12, 10, 30, (20,110,30))
    ellipse(draw, cx, cy-4, 22, 22, (30,160,40), (20,110,30), 2)
    rect(draw, cx+22, cy-9, 14, 6, (20,110,30))
    rect(draw, cx+22, cy+1, 14, 6, (20,110,30))
    ellipse(draw, cx+6, cy-10, 5, 5, (20,20,20))

def draw_mushroom_base(draw, cx, cy, cap_col, stem_col=(230,230,220), cap_rx=20, cap_ry=16):
    rect(draw, cx, cy+14, 12, 20, stem_col, (180,180,170))
    oc = (max(0,cap_col[0]-40), max(0,cap_col[1]-40), max(0,cap_col[2]-40))
    draw.chord([cx-cap_rx, cy-cap_ry*2, cx+cap_rx, cy+2], 180, 360, fill=cap_col, outline=oc)

def draw_puffshroom(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (80,120,210))
    for dx,dy,r in [(-8,-14,5),(8,-14,5),(0,-20,4)]:
        ellipse(draw, cx+dx, cy+dy, r, r, (255,255,255))

def draw_sunshroom(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (230,190,10))
    ellipse(draw, cx, cy-8, 6, 6, (255,240,100))

def draw_fumeshroom(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (120,80,40))
    for i,dx in enumerate([-12,0,12]):
        ellipse(draw, cx+dx, cy-20-i*4, 8, 8, (180,220,100))

def draw_scaredy(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (220,90,150), cap_rx=16, cap_ry=24)
    ellipse(draw, cx-6, cy-2, 5, 6, (255,255,255))
    ellipse(draw, cx+6, cy-2, 5, 6, (255,255,255))
    ellipse(draw, cx-6, cy-2, 2, 3, (30,30,30))
    ellipse(draw, cx+6, cy-2, 2, 3, (30,30,30))
    draw.arc([cx-8,cy+8,cx+8,cy+18], 0, 180, fill=(30,20,10), width=2)

def draw_iceshroom(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (140,220,255))
    for a in range(0, 360, 60):
        r = math.radians(a)
        draw.line([cx, cy-10, int(cx+14*math.cos(r)), int(cy-10+14*math.sin(r))],
                  fill=(200,240,255), width=2)

def draw_doomshroom(draw, cx, cy):
    draw_mushroom_base(draw, cx, cy, (60,20,80), cap_rx=26, cap_ry=20)
    ellipse(draw, cx, cy-14, 7, 7, (200,200,200))
    ellipse(draw, cx-4, cy-16, 3, 3, (30,20,30))
    ellipse(draw, cx+4, cy-16, 3, 3, (30,20,30))
    draw.line([cx-5,cy-10,cx+5,cy-10], fill=(30,20,30), width=2)

def draw_squash(draw, cx, cy):
    draw.rounded_rectangle([cx-22,cy-16,cx+22,cy+22], radius=10,
                            fill=(60,180,60), outline=(30,130,30), width=2)
    for x0 in range(cx-18, cx+20, 8):
        draw.line([x0,cy-16,x0,cy+22], fill=(30,120,30), width=2)
    ellipse(draw, cx-8, cy-4, 5, 5, (20,20,20))
    ellipse(draw, cx+8, cy-4, 5, 5, (20,20,20))
    draw.arc([cx-8,cy+6,cx+8,cy+16], 0, 180, fill=(20,20,20), width=2)

def draw_threepeater(draw, cx, cy):
    dc = (10,120,20)
    draw.line([cx,cy+20,cx,cy-18], fill=dc, width=8)
    draw.line([cx-2,cy-8,cx-24,cy-22], fill=dc, width=6)
    draw.line([cx-2,cy-8,cx+24,cy-22], fill=dc, width=6)
    for hx,hy in [(cx,cy-28),(cx-24,cy-32),(cx+24,cy-32)]:
        ellipse(draw, hx, hy, 14, 14, (20,200,40), dc, 2)
        rect(draw, hx+14, hy, 10, 6, dc)

def draw_torchwood(draw, cx, cy):
    ellipse(draw, cx, cy+8, 26, 18, (160,80,30), (100,50,15), 2)
    for i in range(3):
        draw.line([cx-18+i*18,cy-4,cx-14+i*18,cy+20], fill=(120,60,20), width=3)
    for dx,col in [(-8,(255,80,0)),(0,(255,140,0)),(8,(255,80,0))]:
        poly(draw, [(cx+dx-6,cy-4),(cx+dx+6,cy-4),(cx+dx,cy-24)], fill=col)

def draw_twinsunflower(draw, cx, cy):
    for ox in [-14,14]:
        for a in range(0, 360, 45):
            r = math.radians(a)
            px,py = int(cx+ox+16*math.cos(r)), int(cy-6+14*math.sin(r))
            ellipse(draw, px, py, 6, 4, (255,220,0))
        ellipse(draw, cx+ox, cy-6, 10, 10, (200,130,30))
    rect(draw, cx, cy+18, 8, 22, (50,160,30))

def draw_tallnut(draw, cx, cy):
    draw.rounded_rectangle([cx-18,cy-30,cx+18,cy+28], radius=8,
                            fill=(180,130,60), outline=(120,80,30), width=2)
    rect(draw, cx, cy-28, 30, 10, (140,100,40))
    for i in range(3):
        draw.arc([cx-14+i*6,cy-22,cx-6+i*6,cy+20], 30, 150, fill=(120,80,30), width=2)
    ellipse(draw, cx-6, cy-4, 4, 4, (30,20,10))
    ellipse(draw, cx+6, cy-4, 4, 4, (30,20,10))
    draw.arc([cx-6,cy+6,cx+6,cy+16], 0, 180, fill=(30,20,10), width=2)

def draw_cactus(draw, cx, cy):
    dc = (30,120,30)
    rect(draw, cx, cy+4, 16, 40, (50,160,50), dc, 2)
    rect(draw, cx-22, cy-8, 12, 6, (50,160,50), dc, 2)
    rect(draw, cx-22, cy-18, 6, 20, (50,160,50), dc, 2)
    rect(draw, cx+22, cy-4, 12, 6, (50,160,50), dc, 2)
    rect(draw, cx+22, cy-20, 6, 24, (50,160,50), dc, 2)
    for dy in range(-20, 22, 7):
        draw.line([cx-8,cy+dy,cx-14,cy+dy-3], fill=(200,200,50), width=1)
        draw.line([cx+8,cy+dy,cx+14,cy+dy-3], fill=(200,200,50), width=1)

PLANT_DRAW = {
    "peashooter": draw_peashooter, "sunflower": draw_sunflower,
    "wallnut": draw_wallnut,       "cherrybomb": draw_cherrybomb,
    "potatomine": draw_potatomine, "snowpea": draw_snowpea,
    "chomper": draw_chomper,       "repeater": draw_repeater,
    "puffshroom": draw_puffshroom, "sunshroom": draw_sunshroom,
    "fumeshroom": draw_fumeshroom, "scaredy": draw_scaredy,
    "iceshroom": draw_iceshroom,   "doomshroom": draw_doomshroom,
    "squash": draw_squash,         "threepeater": draw_threepeater,
    "torchwood": draw_torchwood,   "twinsunflower": draw_twinsunflower,
    "tallnut": draw_tallnut,       "cactus": draw_cactus,
}

# ── Zombie drawing ────────────────────────────────────────────────────────────
def draw_zombie_body(draw, cx, cy, col, hcol, scale=1.0):
    s = scale
    bw, bh = int(20*s), int(26*s)
    hw = int(18*s)
    rect(draw, cx, cy+int(8*s), bw, bh, (200,210,200), (100,110,100))
    draw.line([cx, cy+int(4*s), cx, cy+int(20*s)], fill=(150,160,150), width=int(2*s))
    ellipse(draw, cx, cy-int(12*s), hw, int(16*s), hcol,
            (max(0,col[0]-30), max(0,col[1]-30), max(0,col[2]-30)), max(1,int(1.5*s)))
    ew = int(4*s)
    ellipse(draw, cx-int(6*s), cy-int(14*s), ew, int(3*s), (30,20,10))
    ellipse(draw, cx+int(6*s), cy-int(14*s), ew, int(3*s), (30,20,10))
    draw.line([cx-bw-int(8*s), cy+int(2*s), cx-bw, cy+int(2*s)], fill=hcol, width=int(6*s))
    draw.line([cx+bw+int(8*s), cy+int(2*s), cx+bw, cy+int(2*s)], fill=hcol, width=int(6*s))
    draw.line([cx-int(8*s), cy+int(22*s), cx-int(12*s), cy+int(34*s)], fill=(80,70,60), width=int(7*s))
    draw.line([cx+int(8*s), cy+int(22*s), cx+int(14*s), cy+int(34*s)], fill=(80,70,60), width=int(7*s))
    poly(draw, [(cx, cy+int(2*s)), (cx-int(4*s),cy+int(10*s)),
                (cx, cy+int(20*s)), (cx+int(4*s),cy+int(10*s))], fill=(180,30,30))

def draw_regular_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (190,200,170), (200,215,185))

def draw_cone_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (200,190,160), (220,130,30))
    poly(draw, [(cx-14,cy-22),(cx+14,cy-22),(cx,cy-44)],
         fill=(230,120,20), outline=(180,80,10))

def draw_bucket_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (185,185,200), (160,165,175))
    draw.rounded_rectangle([cx-16,cy-36,cx+16,cy-20], radius=4,
                            fill=(160,165,175), outline=(100,105,115), width=2)
    draw.line([cx-18,cy-36,cx+18,cy-36], fill=(120,125,135), width=3)

def draw_flag_zombie(draw, cx, cy):
    draw_regular_zombie(draw, cx, cy)
    draw.line([cx+12,cy-30,cx+12,cy+6], fill=(160,150,130), width=2)
    poly(draw, [(cx+12,cy-30),(cx+28,cy-24),(cx+12,cy-18)], fill=(220,40,40))

def draw_polevault_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (180,180,160), (200,200,180))
    draw.line([cx+8,cy-20,cx+22,cy+30], fill=(180,150,100), width=3)

def draw_newspaper_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (200,195,175), (230,220,190))
    draw.rounded_rectangle([cx-22,cy-6,cx-2,cy+14], radius=2,
                            fill=(230,220,180), outline=(160,150,120), width=1)
    for ly in range(cy-2, cy+12, 4):
        draw.line([cx-20,ly,cx-4,ly], fill=(120,110,90), width=1)

def draw_football_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (160,120,70), (80,60,40), scale=1.2)
    ellipse(draw, cx, cy-14, 22, 18, (80,60,40), (50,40,20), 2)
    draw.line([cx-16,cy-14,cx+16,cy-14], fill=(255,255,255), width=2)
    draw.line([cx-10,cy-22,cx+10,cy-22], fill=(255,255,255), width=2)
    draw.line([cx-10,cy-6, cx+10,cy-6],  fill=(255,255,255), width=2)

def draw_dancing_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (160,80,160), (200,100,200))
    rect(draw, cx, cy-2, 22, 28, (160,80,160), (120,50,130))
    for i,dy in enumerate(range(cy-10, cy+10, 8)):
        rect(draw, cx, dy, 22, 6, (200,100+i*20,200))

def draw_balloon_zombie(draw, cx, cy):
    draw_regular_zombie(draw, cx, cy)
    draw.line([cx+10,cy-20,cx+10,cy-42], fill=(200,200,200), width=1)
    ellipse(draw, cx+10, cy-52, 12, 16, (255,80,80), (200,40,40), 2)
    ellipse(draw, cx+6, cy-58, 4, 4, (255,150,150))

def draw_digger_zombie(draw, cx, cy):
    draw_zombie_body(draw, cx, cy, (150,130,110), (100,80,60))
    rect(draw, cx, cy-28, 22, 10, (80,70,60), (60,50,40))
    draw.line([cx+16,cy-16,cx+32,cy+8], fill=(140,130,110), width=4)
    poly(draw, [(cx+28,cy+4),(cx+36,cy),(cx+34,cy+12)], fill=(180,180,190))

def draw_gargantuar(draw, cx, cy):
    s = 1.8
    draw_zombie_body(draw, cx, cy, (100,90,70), (80,70,55), scale=s)
    draw.line([cx+int(30*s),cy-int(30*s),cx+int(30*s),cy+int(24*s)], fill=(120,90,60), width=8)
    draw.line([cx+int(18*s),cy-int(18*s),cx+int(42*s),cy-int(18*s)], fill=(120,90,60), width=5)

def draw_imp(draw, cx, cy):
    ellipse(draw, cx, cy-4, 16, 18, (180,130,100), (100,70,50))
    rect(draw, cx, cy+12, 12, 16, (150,110,90))
    ellipse(draw, cx-6, cy-12, 3, 3, (30,20,10))
    ellipse(draw, cx+6, cy-12, 3, 3, (30,20,10))
    poly(draw, [(cx-16,cy-22),(cx-8,cy-18),(cx-12,cy-10)], fill=(180,30,30))
    poly(draw, [(cx+16,cy-22),(cx+8,cy-18),(cx+12,cy-10)], fill=(180,30,30))

ZOMBIE_DRAW = {
    "regular": draw_regular_zombie, "cone": draw_cone_zombie,
    "bucket": draw_bucket_zombie,   "flag": draw_flag_zombie,
    "polevault": draw_polevault_zombie, "newspaper": draw_newspaper_zombie,
    "football": draw_football_zombie,   "dancing": draw_dancing_zombie,
    "balloon": draw_balloon_zombie,     "digger": draw_digger_zombie,
    "gargantuar": draw_gargantuar,      "imp": draw_imp,
}

# ── Background ────────────────────────────────────────────────────────────────
def draw_background(img, draw, atmo_key):
    a = ATMO.get(atmo_key, ATMO["day"])
    img.paste(a["sky"], [0, 0, IW, GY])
    if atmo_key == "night":
        for sx,sy in [(50,15),(120,8),(200,22),(300,12),(400,18),(560,6),(640,20)]:
            ellipse(draw, sx, sy, 2, 2, (255,255,220))
    if atmo_key == "roof":
        rect(draw, IW//2, GY-10, IW, 24, (180,120,70))
        for xi in range(0, IW, 30):
            draw.rectangle([xi,GY-22,xi+14,GY], fill=(160,100,55))
    for row in range(ROWS):
        col = a["ga"] if row%2==0 else a["gb"]
        y0 = GY + row*CH
        draw.rectangle([GX, y0, GX+COLS*CW, y0+CH], fill=col)
    if atmo_key == "pool":
        for row in [2,3]:
            y0 = GY + row*CH
            draw.rectangle([GX, y0, GX+COLS*CW, y0+CH], fill=(60,130,180))
            for xi in range(GX+10, GX+COLS*CW, 20):
                draw.arc([xi,y0+CH//2-4,xi+16,y0+CH//2+4], 0, 180, fill=(100,180,220), width=2)
    if atmo_key == "fog":
        fog = Image.new("RGBA", (IW, IH), (0,0,0,0))
        fd = ImageDraw.Draw(fog)
        for xi in range(0, IW, 60):
            for yi in range(GY, GY+ROWS*CH, 50):
                fd.ellipse([xi,yi,xi+80,yi+40], fill=(200,210,220,80))
        img.paste(fog, mask=fog)
    for c in range(COLS+1):
        x = GX + c*CW
        draw.line([x,GY,x,GY+ROWS*CH], fill=(0,0,0,60), width=1)
    for r in range(ROWS+1):
        y = GY + r*CH
        draw.line([GX,y,GX+COLS*CW,y], fill=(0,0,0,60), width=1)

def draw_ui(draw, state, atmo_key):
    a = ATMO.get(atmo_key, ATMO["day"])
    draw.rectangle([0,0,IW,TOP], fill=a["ui"])
    f_big = font(20, bold=True); f_sm = font(13)
    txt(draw, f"Sun: {state.get('sun',50)}", 8, 6, f_big, (255,240,100))
    wave = state.get("wave",1); mw = state.get("maxWaves",5)
    txt(draw, f"Wave {wave}/{mw}", IW//2, 6, f_big, (255,255,255), anchor="mt")
    lvl_names = ["Day","Night","Pool","Fog","Roof"]
    lvl = state.get("level",0)
    lvl_name = lvl_names[lvl] if lvl < len(lvl_names) else "?"
    txt(draw, f"Level {lvl+1} - {lvl_name}", IW-8, 6, f_sm, (220,240,255), anchor="rt")
    draw.rectangle([0,GY,SB,GY+ROWS*CH], fill=(0,0,0,80))
    for r in range(ROWS):
        cy = GY + r*CH + CH//2
        label = "~" if (atmo_key=="pool" and r in [2,3]) else str(r+1)
        txt(draw, label, 6, cy-10, font(13), (255,255,200))
    sel = state.get("selectedPlant")
    draw.rectangle([0,GY+ROWS*CH,IW,IH], fill=a["ui"])
    if sel:
        txt(draw, f"Selected: {sel}  -> click a Lane button to place",
            8, GY+ROWS*CH+8, font(13), (255,255,200))
    else:
        txt(draw, "Select a plant then press a Lane button to place it.",
            8, GY+ROWS*CH+8, font(13), (200,200,200))
    txt(draw, f"Tick {state.get('tick',0)}", IW-8, GY+ROWS*CH+8, font(12), (180,180,180), anchor="rt")

def draw_level_select(draw, state):
    for y in range(IH):
        t = y/IH
        r = int(135+t*40); g = int(206-t*60); b = int(235-t*80)
        draw.line([0,y,IW,y], fill=(r,g,b))
    clouds = [(80,60,80,40),(220,40,90,45),(400,70,100,50),
              (560,45,80,38),(640,80,70,35),(150,100,60,30)]
    for cx,cy,cw,ch in clouds:
        ellipse(draw, cx, cy, cw, ch, (255,255,255))
        ellipse(draw, cx-int(cw*0.4), cy+4, int(cw*0.5), int(ch*0.7), (245,245,255))
        ellipse(draw, cx+int(cw*0.4), cy+4, int(cw*0.5), int(ch*0.7), (245,245,255))
    f_title = font(28, bold=True); f_lv = font(16, bold=True); f_sm = font(13)
    txt(draw, "SELECT YOUR LEVEL", IW//2, 20, f_title, (255,255,255), anchor="mt")
    unlocked = state.get("unlockedLevels", [0])
    lvl_defs = [
        dict(name="Day 1",   x=80,  y=200),
        dict(name="Night 2", x=200, y=280),
        dict(name="Pool 3",  x=350, y=200),
        dict(name="Fog 4",   x=500, y=280),
        dict(name="Roof 5",  x=620, y=200),
    ]
    atmo_cols = [(255,220,80),(100,100,200),(80,180,220),(160,160,160),(220,140,60)]
    for i,ld in enumerate(lvl_defs):
        locked = i not in unlocked
        ac = atmo_cols[i]
        bc = (100,100,100) if locked else ac
        if i < len(lvl_defs)-1:
            nd = lvl_defs[i+1]
            draw.line([ld["x"],ld["y"],nd["x"],nd["y"]], fill=(200,200,180), width=3)
        draw.ellipse([ld["x"]-40,ld["y"]-20,ld["x"]+40,ld["y"]+20],
                     fill=bc, outline=(50,50,50) if locked else (255,255,255), width=2)
        if locked:
            txt(draw, "LOCKED", ld["x"], ld["y"]-8, font(14,True), (180,180,180), anchor="mt")
        else:
            stars = state.get("levelStars",{}).get(str(i),0)
            star_str = "*"*stars + "-"*(3-stars) if stars<=3 else "***"
            txt(draw, ld["name"], ld["x"], ld["y"]-14, f_lv, (30,20,10), anchor="mt")
            txt(draw, star_str,   ld["x"], ld["y"]+2,  font(12), (30,20,10), anchor="mt")
    txt(draw, "Choose a level to begin!", IW//2, IH-25, f_sm, (255,255,255), anchor="mt")

def draw_tutorial_overlay(draw, step):
    draw.rectangle([0,0,IW,IH], fill=(0,0,0,160))
    tips = [
        ("Sun is your currency", "Sunflowers produce it.\nCollect enough to buy plants!"),
        ("Planting",             "Select a plant below,\nthen click a Lane button\nto plant it in that row."),
        ("Zombies!",             "Zombies walk from right\nto left. Don't let them\nreach the left edge!"),
        ("Taking Turns",         "Press Next Turn to\nadvance time. Plants shoot\nand zombies move."),
        ("Shop tip",             "Between waves you can\nstart the next wave.\nPlan your plants wisely!"),
    ]
    if step < len(tips):
        label, desc = tips[step]
        f_h = font(22, bold=True); f_d = font(15)
        draw.rounded_rectangle([IW//2-240, 130, IW//2+240, 290],
                                radius=16, fill=(40,40,60,230), outline=(255,220,80), width=3)
        txt(draw, label, IW//2, 148, f_h, (255,220,80), anchor="mt")
        for i,line in enumerate(desc.split("\n")):
            txt(draw, line, IW//2, 182+i*24, f_d, (220,230,255), anchor="mt")
        txt(draw, f"Step {step+1} / {len(tips)}", IW//2, IH-30, font(13), (200,200,200), anchor="mt")

def draw_endscreen(draw, won):
    draw.rectangle([0,0,IW,IH], fill=(0,0,0,180))
    f_big = font(36, bold=True); f_sm = font(16)
    if won:
        txt(draw, "YOU WIN!", IW//2, IH//2-50, f_big, (255,220,50), anchor="mt")
        txt(draw, "The zombies have been defeated!", IW//2, IH//2+10, f_sm, (200,255,200), anchor="mt")
    else:
        txt(draw, "GAME OVER", IW//2, IH//2-50, f_big, (220,50,50), anchor="mt")
        txt(draw, "The zombies ate your brains...", IW//2, IH//2+10, f_sm, (255,180,180), anchor="mt")
    txt(draw, "Use the buttons below to continue.", IW//2, IH//2+45, f_sm, (200,200,200), anchor="mt")

# ── Main render ───────────────────────────────────────────────────────────────
def render(state, out_path):
    img  = Image.new("RGBA", (IW, IH), (0,0,0,255))
    draw = ImageDraw.Draw(img, "RGBA")
    phase    = state.get("phase","playing")
    atmo_key = state.get("atmosphere","day")

    if phase == "level_select":
        draw_level_select(draw, state)
        img.convert("RGB").save(out_path, "PNG")
        return

    draw_background(img, draw, atmo_key)
    draw_ui(draw, state, atmo_key)

    # Plants
    grid = state.get("grid", [])
    for row_i, row in enumerate(grid):
        for col_i, cell in enumerate(row):
            if not cell: continue
            cx = GX + col_i*CW + CW//2
            cy = GY + row_i*CH + CH//2 - 4
            ptype = cell.get("type","peashooter")
            if ptype in PLANT_DRAW:
                PLANT_DRAW[ptype](draw, cx, cy)
            hp_pct = cell.get("hp",300)/max(cell.get("maxHp",300),1)
            draw_hp(draw, cx-22, GY+row_i*CH+CH-10, 44, hp_pct)

    # Zombies
    for z in state.get("zombies",[]):
        zx = GX + z["x"]*CW
        zy = GY + z["row"]*CH + CH//2 - 4
        ztype = z.get("type","regular")
        if ztype in ZOMBIE_DRAW:
            ZOMBIE_DRAW[ztype](draw, int(zx), int(zy))
        hp_pct = z.get("hp",100)/max(z.get("maxHp",100),1)
        draw_hp(draw, int(zx)-22, int(GY+z["row"]*CH+CH-10), 44, hp_pct)

    # Projectiles
    proj_cols = {"pea":(80,200,80),"snow":(150,230,255),"fire":(255,120,20),"spike":(200,200,80)}
    for p in state.get("projectiles",[]):
        px = int(GX + p["x"]*CW)
        py = int(GY + p["row"]*CH + CH//2 - 4)
        col = proj_cols.get(p.get("type","pea"),(80,200,80))
        ellipse(draw, px, py, 6, 6, col)

    # Overlays
    if phase == "tutorial":
        draw_tutorial_overlay(draw, state.get("tutorialStep",0))
    elif phase == "game_over":
        draw_endscreen(draw, False)
    elif phase == "victory":
        draw_endscreen(draw, True)

    img.convert("RGB").save(out_path, "PNG")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: pvz_render.py <output.png>", file=sys.stderr)
        sys.exit(1)
    data = json.loads(sys.stdin.read())
    render(data, sys.argv[1])
