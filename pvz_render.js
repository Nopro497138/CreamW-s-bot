// pvz_render.js — PvZ renderer using node-canvas + real sprites
"use strict";
const { createCanvas, Image } = require("canvas");
const fs   = require("fs");
const path = require("path");

// ── Canvas dimensions ─────────────────────────────────────────────
const CW = 72, CH = 72, COLS = 9, ROWS = 5;
const SB = 56, TOP = 56, BOT = 48;
const IW = SB + COLS * CW + 10;
const IH = TOP + ROWS * CH + BOT;
const GX = SB, GY = TOP;

// ── Sprite loader (synchronous via Buffer src) ────────────────────
const SPRITES = {};
function loadSprite(key, filename) {
  const p = path.join(__dirname, filename);
  if (!fs.existsSync(p)) { console.warn(`[PVZ_R] Sprite not found: ${p}`); return; }
  const img = new Image();
  img.src   = fs.readFileSync(p);
  SPRITES[key] = img;
}

// Load all sprites once at require-time
loadSprite("bg",          "sprite_bg.png");
loadSprite("zombie",      "sprite_zombie.png");
loadSprite("cone",        "sprite_cone.png");
loadSprite("wallnut",     "sprite_wallnut.png");
loadSprite("peashooter",  "sprite_peashooter.png");
loadSprite("sunflower",   "sprite_sunflower.png");

// ── Sprite draw helper ────────────────────────────────────────────
// Draws a sprite centred at (cx, cy) scaled to fit within (w × h)
function drawSprite(ctx, key, cx, cy, w, h, flipX = false) {
  const img = SPRITES[key];
  if (!img || !img.width) return false;
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width  * scale;
  const dh = img.height * scale;
  const dx = cx - dw / 2;
  const dy = cy - dh / 2;
  ctx.save();
  if (flipX) { ctx.scale(-1, 1); ctx.translate(-2 * (cx), 0); }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

// ── Colour helpers ────────────────────────────────────────────────
const ATMO = {
  day:   { sky:"#57B6FF", ga:"#5EAA2A", gb:"#4A8C1C", ui:"#2E6010", grid:"rgba(0,0,0,0.18)" },
  night: { sky:"#0A0A2E", ga:"#1E3C1E", gb:"#162A16", ui:"#0A2810", grid:"rgba(255,255,255,0.08)" },
  pool:  { sky:"#5ABEDC", ga:"#3C8C3C", gb:"#2C6C2C", ui:"#1C5C46", grid:"rgba(0,0,0,0.18)" },
  fog:   { sky:"#7C8C96", ga:"#3C5A3C", gb:"#2A422A", ui:"#2A3E2A", grid:"rgba(0,0,0,0.15)" },
  roof:  { sky:"#C07832", ga:"#A07040", gb:"#7C5228", ui:"#6A3C18", grid:"rgba(0,0,0,0.20)" },
};

// ── Draw helpers ──────────────────────────────────────────────────
function ell(ctx, cx, cy, rx, ry, fill, stroke, lw = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.restore();
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function rct(ctx, cx, cy, w, h, fill, stroke, lw = 1) {
  const x = cx - w/2, y = cy - h/2;
  if (fill)   { ctx.fillStyle   = fill;   ctx.fillRect(x,y,w,h);   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x,y,w,h); }
}
function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function lin(ctx, x0, y0, x1, y1, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}
function txt(ctx, s, x, y, size, bold, fill, align = "left", base = "top") {
  ctx.font         = `${bold ? "bold" : "normal"} ${size}px sans-serif`;
  ctx.textAlign    = align;
  ctx.textBaseline = base;
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function hpColor(p)  { return p > 0.6 ? "#28C828" : p > 0.3 ? "#DCC820" : "#DC2828"; }
function drawHpBar(ctx, x, y, w, p, h = 6) {
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x-1, y-1, w+2, h+2);
  ctx.fillStyle = "#1A1A1A"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hpColor(p); ctx.fillRect(x, y, Math.round(w * p), h);
}
// Rounded rect utility
function rndRect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ── Canvas plant drawings (for plants WITHOUT sprites) ────────────
const PD = {
  peashooter(ctx, cx, cy, w, h) {
    if (!drawSprite(ctx, "peashooter", cx, cy-4, w*0.9, h*0.9)) {
      rct(ctx,cx,cy+10,10,28,"#14700A"); ell(ctx,cx,cy-4,20,20,"#32B432","#14700A",2);
      rct(ctx,cx+20,cy-4,13,8,"#14700A"); ell(ctx,cx+6,cy-9,5,5,"#0A0A0A");
    }
  },
  sunflower(ctx, cx, cy, w, h) {
    if (!drawSprite(ctx, "sunflower", cx, cy-4, w*0.92, h*0.92)) {
      for (let a=0;a<360;a+=45){const r=a*Math.PI/180;ell(ctx,cx+22*Math.cos(r)|0,(cy-8+20*Math.sin(r))|0,8,6,"#FFD800");}
      ell(ctx,cx,cy-8,13,13,"#C87814"); rct(ctx,cx,cy+14,8,26,"#28A018");
    }
  },
  wallnut(ctx, cx, cy, w, h) {
    if (!drawSprite(ctx, "wallnut", cx, cy, w*0.82, h*0.88)) {
      ell(ctx,cx,cy,24,27,"#B07828","#785018",2);
      for (let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx-14+i*7,cy,11,0.5,2.6);ctx.strokeStyle="#785018";ctx.lineWidth=2;ctx.stroke();}
      ell(ctx,cx-7,cy-5,4,4,"#1E1408"); ell(ctx,cx+7,cy-5,4,4,"#1E1408");
    }
  },
  cherrybomb(ctx, cx, cy) {
    ell(ctx,cx-11,cy+3,16,16,"#DC1E1E","#961010",2); ell(ctx,cx+11,cy+3,16,16,"#DC1E1E","#961010",2);
    lin(ctx,cx-11,cy-11,cx-5,cy-17,"#3C8C1E",3); lin(ctx,cx+11,cy-11,cx+5,cy-17,"#3C8C1E",3);
    ell(ctx,cx-11,cy+1,5,5,"#FF5050"); ell(ctx,cx+11,cy+1,5,5,"#FF5050");
  },
  potatomine(ctx, cx, cy) { ell(ctx,cx,cy+8,20,12,"#A07828","#643C1E",2); rct(ctx,cx,cy-8,6,14,"#643C1E"); ell(ctx,cx,cy-16,4,4,"#C83232"); },
  snowpea(ctx, cx, cy) { rct(ctx,cx,cy+10,9,28,"#32A018"); ell(ctx,cx,cy-4,20,20,"#64C8E6","#3C96B4",2); rct(ctx,cx+20,cy-4,13,8,"#3C96B4"); ell(ctx,cx+5,cy-9,5,5,"#141414"); },
  chomper(ctx, cx, cy) {
    rct(ctx,cx,cy+10,9,26,"#7832A0");
    poly(ctx,[[cx-18,cy-16],[cx+18,cy-16],[cx+18,cy+3],[cx-18,cy+3]],"#C83CDC","#82201E");
    poly(ctx,[[cx-18,cy+3],[cx+18,cy+3],[cx+18,cy+14],[cx-18,cy+14]],"#9628B4","#641478");
    for(let i=0;i<4;i++){const tx=cx-13+i*9;poly(ctx,[[tx,cy-16],[tx+5,cy-16],[tx+2,cy-8]],"#FFFFFF");}
  },
  repeater(ctx, cx, cy) { rct(ctx,cx,cy+10,9,28,"#14700E"); ell(ctx,cx,cy-4,20,20,"#1EA028","#14700E",2); rct(ctx,cx+20,cy-9,13,6,"#14700E"); rct(ctx,cx+20,cy+1,13,6,"#14700E"); ell(ctx,cx+5,cy-9,5,5,"#141414"); },
  puffshroom(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#507890";ctx.beginPath();ctx.arc(cx,cy-14,18,Math.PI,0);ctx.closePath();ctx.fill(); ell(ctx,cx-7,cy-12,4,4,"#FFFFFF"); ell(ctx,cx+7,cy-12,4,4,"#FFFFFF"); ell(ctx,cx,cy-20,3,3,"#FFFFFF"); },
  sunshroom(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#E6BE0A";ctx.beginPath();ctx.arc(cx,cy-14,18,Math.PI,0);ctx.closePath();ctx.fill(); ell(ctx,cx,cy-8,5,5,"#FFF064"); },
  fumeshroom(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#785028";ctx.beginPath();ctx.arc(cx,cy-14,18,Math.PI,0);ctx.closePath();ctx.fill(); [-10,0,10].forEach((dx,i)=>ell(ctx,cx+dx,cy-18-i*3,7,7,"#B4DC64")); },
  scaredy(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#DC5A96";ctx.beginPath();ctx.arc(cx,cy-10,14,Math.PI,0);ctx.closePath();ctx.fill(); ell(ctx,cx-5,cy-2,4,5,"#FFFFFF"); ell(ctx,cx+5,cy-2,4,5,"#FFFFFF"); ell(ctx,cx-5,cy-2,2,2,"#1E1E1E"); ell(ctx,cx+5,cy-2,2,2,"#1E1E1E"); },
  iceshroom(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#8CDCFF";ctx.beginPath();ctx.arc(cx,cy-14,18,Math.PI,0);ctx.closePath();ctx.fill(); for(let a=0;a<360;a+=60){const r=a*Math.PI/180;lin(ctx,cx,cy-10,cx+12*Math.cos(r)|0,(cy-10+12*Math.sin(r))|0,"#C8F0FF",2);} },
  doomshroom(ctx, cx, cy) { rct(ctx,cx,cy+12,11,18,"#E0E0D0","#B0B0A0"); ctx.fillStyle="#3C1450";ctx.beginPath();ctx.arc(cx,cy-12,24,Math.PI,0);ctx.closePath();ctx.fill(); ell(ctx,cx,cy-12,6,6,"#C8C8C8"); },
  squash(ctx, cx, cy) { ctx.save();ctx.beginPath();ctx.roundRect(cx-20,cy-14,40,34,8);ctx.fillStyle="#3CB43C";ctx.fill();ctx.strokeStyle="#1E8214";ctx.lineWidth=2;ctx.stroke();ctx.restore(); for(let x0=cx-16;x0<cx+18;x0+=8)lin(ctx,x0,cy-14,x0,cy+20,"#1E7814",2); ell(ctx,cx-7,cy-4,4,4,"#141414"); ell(ctx,cx+7,cy-4,4,4,"#141414"); },
  threepeater(ctx, cx, cy) { lin(ctx,cx,cy+18,cx,cy-16,"#0A7814",7); lin(ctx,cx-2,cy-7,cx-22,cy-20,"#0A7814",5); lin(ctx,cx-2,cy-7,cx+22,cy-20,"#0A7814",5); [[cx,cy-26],[cx-22,cy-30],[cx+22,cy-30]].forEach(([hx,hy])=>{ell(ctx,hx,hy,12,12,"#14C828","#0A7814",2);rct(ctx,hx+12,hy,9,5,"#0A7814");}); },
  torchwood(ctx, cx, cy) { ell(ctx,cx,cy+6,24,16,"#A05014","#643214",2); for(let i=0;i<3;i++)lin(ctx,cx-16+i*16,cy-4,cx-12+i*16,cy+18,"#783C14",3); [[-7,"#FF5000"],[0,"#FF8C00"],[7,"#FF5000"]].forEach(([dx,fc])=>poly(ctx,[[cx+dx-5,cy-3],[cx+dx+5,cy-3],[cx+dx,cy-22]],fc)); },
  twinsunflower(ctx, cx, cy) { [-12,12].forEach(ox=>{for(let a=0;a<360;a+=45){const r=a*Math.PI/180;ell(ctx,(cx+ox+14*Math.cos(r))|0,(cy-5+12*Math.sin(r))|0,5,4,"#FFD800");}ell(ctx,cx+ox,cy-5,9,9,"#C87814");}); rct(ctx,cx,cy+16,7,20,"#28A018"); },
  tallnut(ctx, cx, cy) { ctx.save();ctx.beginPath();ctx.roundRect(cx-16,cy-28,32,54,7);ctx.fillStyle="#B07828";ctx.fill();ctx.strokeStyle="#785018";ctx.lineWidth=2;ctx.stroke();ctx.restore(); rct(ctx,cx,cy-26,28,9,"#8C6428"); ell(ctx,cx-5,cy-4,4,4,"#1E1408"); ell(ctx,cx+5,cy-4,4,4,"#1E1408"); },
  cactus(ctx, cx, cy) { rct(ctx,cx,cy+3,14,38,"#32A032","#1E7814",2); rct(ctx,cx-20,cy-7,11,5,"#32A032","#1E7814",2); rct(ctx,cx-20,cy-16,5,18,"#32A032","#1E7814",2); rct(ctx,cx+20,cy-3,11,5,"#32A032","#1E7814",2); rct(ctx,cx+20,cy-18,5,22,"#32A032","#1E7814",2); for(let dy=-18;dy<20;dy+=7){lin(ctx,cx-7,cy+dy,cx-12,cy+dy-3,"#C8C832");lin(ctx,cx+7,cy+dy,cx+12,cy+dy-3,"#C8C832");} },
};

// ── Canvas zombie drawings ─────────────────────────────────────────
function zbody(ctx, cx, cy, bc, hc, s=1) {
  const bw=18*s|0, bh=24*s|0;
  rct(ctx,cx,cy+(7*s)|0,bw,bh,"#C0CABA","#606860");
  lin(ctx,cx,cy+(3*s)|0,cx,cy+(18*s)|0,"#90988E",Math.max(1,2*s|0));
  ell(ctx,cx,cy-(11*s)|0,(16*s)|0,(14*s)|0,hc,null,0);
  const ew=Math.max(2,4*s|0);
  ell(ctx,cx-(5*s)|0,cy-(12*s)|0,ew,(3*s+1)|0,"#1E1408"); ell(ctx,cx+(5*s)|0,cy-(12*s)|0,ew,(3*s+1)|0,"#1E1408");
  lin(ctx,cx-bw-(7*s)|0,cy+(2*s)|0,cx-bw,cy+(2*s)|0,hc,Math.max(1,5*s|0));
  lin(ctx,cx+bw+(7*s)|0,cy+(2*s)|0,cx+bw,cy+(2*s)|0,hc,Math.max(1,5*s|0));
  lin(ctx,cx-(7*s)|0,cy+(20*s)|0,cx-(10*s)|0,cy+(32*s)|0,"#504640",Math.max(1,6*s|0));
  lin(ctx,cx+(7*s)|0,cy+(20*s)|0,cx+(12*s)|0,cy+(32*s)|0,"#504640",Math.max(1,6*s|0));
  poly(ctx,[[cx,cy+(2*s)|0],[cx-(3*s)|0,cy+(9*s)|0],[cx,cy+(18*s)|0],[cx+(3*s)|0,cy+(9*s)|0]],"#B41E1E");
}
const ZD = {
  regular(ctx, cx, cy) {
    if (!drawSprite(ctx, "zombie", cx-2, cy-6, CW*0.85, CH*1.1)) {
      zbody(ctx,cx,cy,"#B8C8A8","#C0D2B4");
    }
  },
  cone(ctx, cx, cy) {
    if (!drawSprite(ctx, "cone", cx-2, cy-8, CW*0.80, CH*1.15)) {
      zbody(ctx,cx,cy,"#C0B898","#DC821E");
      poly(ctx,[[cx-13,cy-20],[cx+13,cy-20],[cx,cy-42]],"#E67818","#B44E14");
    }
  },
  bucket(ctx, cx, cy) {
    zbody(ctx,cx,cy,"#B0B0C0","#9A9FAF");
    ctx.save();ctx.beginPath();ctx.roundRect(cx-14,cy-34,28,14,3);ctx.fillStyle="#9A9FAF";ctx.fill();ctx.strokeStyle="#606070";ctx.lineWidth=2;ctx.stroke();ctx.restore();
    lin(ctx,cx-16,cy-34,cx+16,cy-34,"#707282",3);
  },
  flag(ctx, cx, cy)     { ZD.regular(ctx,cx,cy); lin(ctx,cx+11,cy-28,cx+11,cy+5,"#A09480",2); poly(ctx,[[cx+11,cy-28],[cx+27,cy-22],[cx+11,cy-16]],"#DC2828"); },
  polevault(ctx, cx, cy){ zbody(ctx,cx,cy,"#B0B0A0","#C8C8B0"); lin(ctx,cx+7,cy-18,cx+20,cy+28,"#B09458",3); },
  newspaper(ctx, cx, cy){ zbody(ctx,cx,cy,"#C8C3AF","#E6DCC0"); ctx.save();ctx.beginPath();ctx.roundRect(cx-20,cy-5,18,18,2);ctx.fillStyle="#E6DC8C";ctx.fill();ctx.strokeStyle="#A09678";ctx.lineWidth=1;ctx.stroke();ctx.restore(); for(let ly=cy-1;ly<cy+11;ly+=4)lin(ctx,cx-18,ly,cx-4,ly,"#78706E"); },
  football(ctx, cx, cy) { zbody(ctx,cx,cy,"#9C7040","#4C3C24",1.2); ell(ctx,cx,cy-13,20,16,"#4C3C24","#302818",2); lin(ctx,cx-14,cy-13,cx+14,cy-13,"#FFFFFF",2); lin(ctx,cx-9,cy-20,cx+9,cy-20,"#FFFFFF",2); lin(ctx,cx-9,cy-6,cx+9,cy-6,"#FFFFFF",2); },
  dancing(ctx, cx, cy)  { zbody(ctx,cx,cy,"#9848A0","#C060C8"); rct(ctx,cx,cy-2,20,26,"#9848A0","#783080"); for(let i=0,dy=cy-9;dy<cy+9;dy+=8,i++)rct(ctx,cx,dy,20,6,`rgb(200,${100+i*20},200)`); },
  balloon(ctx, cx, cy)  { ZD.regular(ctx,cx,cy); lin(ctx,cx+9,cy-18,cx+9,cy-40,"#C0C0C0"); ell(ctx,cx+9,cy-50,11,14,"#FF5050","#C82828",2); },
  digger(ctx, cx, cy)   { zbody(ctx,cx,cy,"#907860","#60503C"); rct(ctx,cx,cy-26,20,9,"#484030","#342C20"); lin(ctx,cx+14,cy-14,cx+30,cy+7,"#887E68",4); poly(ctx,[[cx+26,cy+3],[cx+34,cy-1],[cx+32,cy+11]],"#B0B0BC"); },
  gargantuar(ctx, cx, cy) { zbody(ctx,cx,cy,"#60563C","#4C4232",1.8); lin(ctx,cx+50,cy-50,cx+50,cy+40,"#785A3C",8); lin(ctx,cx+30,cy-30,cx+72,cy-30,"#785A3C",5); },
  imp(ctx, cx, cy) { ell(ctx,cx,cy-3,14,16,"#B07E60","#604C38"); rct(ctx,cx,cy+11,11,15,"#906A68"); ell(ctx,cx-5,cy-11,3,3,"#1E1408"); ell(ctx,cx+5,cy-11,3,3,"#1E1408"); poly(ctx,[[cx-14,cy-20],[cx-7,cy-16],[cx-10,cy-9]],"#B41E1E"); poly(ctx,[[cx+14,cy-20],[cx+7,cy-16],[cx+10,cy-9]],"#B41E1E"); },
};

// ── Background ─────────────────────────────────────────────────────
function drawBg(ctx, ak) {
  const a = ATMO[ak] || ATMO.day;

  // Use sprite background if available, else gradient
  if (SPRITES.bg && ak === "day") {
    // Tile/stretch the background sprite across the whole canvas
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(SPRITES.bg, GX, GY, COLS * CW, ROWS * CH);
    ctx.restore();
    // Sky
    ctx.fillStyle = a.sky; ctx.fillRect(0, 0, IW, GY);
  } else {
    ctx.fillStyle = a.sky; ctx.fillRect(0, 0, IW, GY);
    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = row % 2 === 0 ? a.ga : a.gb;
      ctx.fillRect(GX, GY + row * CH, COLS * CW, CH);
    }
  }

  // Night stars
  if (ak === "night") [[50,14],[120,7],[200,21],[300,11],[400,17],[560,5],[640,19]].forEach(([sx,sy])=>ell(ctx,sx,sy,2,2,"#FFFFC8"));
  // Roof ledge
  if (ak === "roof") { ctx.fillStyle="#B47846";ctx.fillRect(0,GY-22,IW,22); for(let xi=0;xi<IW;xi+=30){ctx.fillStyle="#9C6030";ctx.fillRect(xi,GY-20,13,20);} }
  // Pool water
  if (ak === "pool") {
    for (const row of [2,3]) {
      const y0=GY+row*CH;
      ctx.fillStyle="rgba(40,120,180,0.78)"; ctx.fillRect(GX,y0,COLS*CW,CH);
      for(let xi=GX+10;xi<GX+COLS*CW;xi+=20){ctx.beginPath();ctx.arc(xi+8,y0+CH/2,7,Math.PI,0);ctx.strokeStyle="rgba(100,185,225,0.8)";ctx.lineWidth=2;ctx.stroke();}
    }
  }
  // Fog
  if (ak === "fog") { ctx.save();ctx.globalAlpha=0.28;ctx.fillStyle="#C0CAD4"; for(let xi=0;xi<IW;xi+=55) for(let yi=GY;yi<GY+ROWS*CH;yi+=46){ctx.beginPath();ctx.ellipse(xi+36,yi+18,36,18,0,0,Math.PI*2);ctx.fill();}ctx.restore(); }

  // Grid lines overlay
  ctx.strokeStyle = a.grid; ctx.lineWidth = 1;
  for (let col=0;col<=COLS;col++){ctx.beginPath();ctx.moveTo(GX+col*CW,GY);ctx.lineTo(GX+col*CW,GY+ROWS*CH);ctx.stroke();}
  for (let row=0;row<=ROWS;row++){ctx.beginPath();ctx.moveTo(GX,GY+row*CH);ctx.lineTo(GX+COLS*CW,GY+row*CH);ctx.stroke();}
}

// ── UI bar ─────────────────────────────────────────────────────────
function drawUI(ctx, state, ak) {
  const a = ATMO[ak] || ATMO.day;
  const wave    = state.wave    || 1;
  const maxW    = state.maxWaves || 5;
  const houseHp = state.houseHp ?? 100;
  const maxHouseHp = state.maxHouseHp ?? 100;
  const houseP  = Math.max(0, houseHp / maxHouseHp);

  // Top bar background
  ctx.fillStyle = a.ui; ctx.fillRect(0, 0, IW, TOP);

  // Sun
  ell(ctx, 20, 26, 18, 18, "#FFD800", "#C8A000", 2);
  txt(ctx, `${state.sun||50}`, 42, 14, 18, true, "#FFFFC8");

  // Wave info + progress bar
  const wLabel = `Wave ${wave} / ${maxW}`;
  txt(ctx, wLabel, IW/2, 8, 16, true, "#FFFFFF", "center");
  const barW = 180, barH = 8, barX = IW/2 - barW/2, barY = 30;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(barX-1, barY-1, barW+2, barH+2);
  ctx.fillStyle = "#1A1A1A";         ctx.fillRect(barX, barY, barW, barH);
  const wPct = maxW > 0 ? Math.min((wave-1)/maxW, 1) : 0;
  ctx.fillStyle = "#FF6420";         ctx.fillRect(barX, barY, Math.round(barW * wPct), barH);
  ctx.strokeStyle = "#FF9050"; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
  // Wave icons
  for (let i=0;i<maxW;i++) { const nx=barX+Math.round(barW*(i+1)/maxW); ctx.fillStyle=i<wave?"#FF9050":"#555"; ctx.fillRect(nx-1,barY,2,barH); }

  // House HP (right side)
  const hpLabel = `House: ${houseHp}`;
  const hpBarW = 110, hpBarX = IW - hpBarW - 8, hpBarY = 22;
  txt(ctx, hpLabel, IW - hpBarW/2 - 8, 7, 13, true, "#FFC8C8", "center");
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(hpBarX-1, hpBarY-1, hpBarW+2, 9);
  ctx.fillStyle = "#1A1A1A";         ctx.fillRect(hpBarX, hpBarY, hpBarW, 7);
  ctx.fillStyle = hpColor(houseP);   ctx.fillRect(hpBarX, hpBarY, Math.round(hpBarW * houseP), 7);
  ctx.strokeStyle="#FFFFFF44"; ctx.lineWidth=1; ctx.strokeRect(hpBarX, hpBarY, hpBarW, 7);

  // Level name (small, top-right)
  const lvls = ["Day","Night","Pool","Fog","Roof"]; const lv = state.level||0;
  txt(ctx, `Lv ${lv+1} – ${lvls[lv]||"?"}`, IW-8, 36, 11, false, "#DCF0FF", "right");

  // Left sidebar
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, GY, SB, ROWS*CH);
  for (let r=0;r<ROWS;r++) {
    const label = (ak==="pool"&&(r===2||r===3))?"~":String(r+1);
    txt(ctx, label, SB/2, GY+r*CH+CH/2-8, 14, true, "#FFFFC8", "center");
  }

  // Bottom bar
  ctx.fillStyle = a.ui; ctx.fillRect(0, GY+ROWS*CH, IW, BOT);
  const sel = state.selectedPlant;
  const msg = sel ? `Selected: ${sel}  ->  press a Lane button to place` : "Select a plant, then press a Lane button";
  txt(ctx, msg, 8, GY+ROWS*CH+10, 12, false, sel?"#FFFFC8":"#B8B8B8");
  txt(ctx, `Tick ${state.tick||0}`, IW-8, GY+ROWS*CH+10, 11, false, "#A0A0A0", "right");
  if (state.shovelMode) txt(ctx, "SHOVEL MODE — pick a lane", IW/2, GY+ROWS*CH+28, 12, true, "#FF9050", "center");
}

// ── Level Select ───────────────────────────────────────────────────
function drawLevelSelect(ctx, state) {
  const grad = ctx.createLinearGradient(0,0,0,IH);
  grad.addColorStop(0,"#5AB5E8"); grad.addColorStop(1,"#A0C8E8");
  ctx.fillStyle = grad; ctx.fillRect(0,0,IW,IH);

  // Clouds
  [[80,52,78,36],[208,36,88,42],[388,62,98,46],[552,40,80,34],[636,72,66,32],[146,96,56,26]].forEach(([cx2,cy2,cw,ch])=>{
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.ellipse(cx2,cy2,cw,ch,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(248,248,255,0.8)"; ctx.beginPath(); ctx.ellipse(cx2-cw*0.38,cy2+4,cw*0.48,ch*0.65,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx2+cw*0.38,cy2+4,cw*0.48,ch*0.65,0,0,Math.PI*2); ctx.fill();
  });

  txt(ctx,"PLANTS  VS  ZOMBIES",IW/2,14,26,true,"#FFFFFF","center");
  txt(ctx,"Select a level — defeat the zombies!",IW/2,50,13,false,"#E0F0FF","center");

  const unlocked = state.unlockedLevels || [0];
  const defs = [[80,190],[195,268],[345,183],[498,268],[616,188]];
  const names = ["Day 1","Night 2","Pool 3","Fog 4","Roof 5"];
  const descs = ["Sunny Meadow","Moonlit Garden","Watery Depths","Misty Cemetery","Final Stand"];
  const aCols = ["#FFD840","#5050C0","#38A0D0","#888888","#D08030"];

  // Dashed path
  ctx.save(); ctx.setLineDash([7,5]); ctx.strokeStyle="rgba(200,200,170,0.65)"; ctx.lineWidth=3;
  for (let i=0;i<defs.length-1;i++){ctx.beginPath();ctx.moveTo(defs[i][0],defs[i][1]);ctx.lineTo(defs[i+1][0],defs[i+1][1]);ctx.stroke();}
  ctx.restore();

  defs.forEach(([x,y],i)=>{
    const lo = !unlocked.includes(i);
    const stars = (state.levelStars||{})[i]||0;

    // Shadow
    ctx.save();ctx.globalAlpha=0.25;ell(ctx,x+3,y+4,44,23,"#000000");ctx.restore();

    // Platform
    rndRect(ctx,x-44,y-22,88,44,12,lo?"#484848":aCols[i],lo?"#2A2A2A":"rgba(255,255,255,0.9)",2);

    if (lo) {
      txt(ctx,"LOCKED",x,y-6,12,true,"#C0C0C0","center","middle");
      txt(ctx,`Level ${i+1}`,x,y+8,11,false,"#909090","center","middle");
    } else {
      txt(ctx,names[i],x,y-12,15,true,"#100800","center","middle");
      txt(ctx,descs[i],x,y+2,10,false,"#302010","center","middle");
      txt(ctx,"*".repeat(stars)+"-".repeat(3-stars),x,y+14,11,false,"#FFC800","center","middle");
    }
  });

  txt(ctx,"Tap a level button below to begin!",IW/2,IH-18,12,false,"#E8F8FF","center");
}

// ── Tutorial overlay ───────────────────────────────────────────────
function drawTutorial(ctx, step) {
  // Spotlight regions [x1,y1,w,h]
  const spots = [
    [0, 0, 140, TOP],                           // 0: sun counter
    [0, GY+ROWS*CH, IW, BOT],                   // 1: bottom plant bar
    [GX+5*CW, GY, COLS*CW - 5*CW + 10, ROWS*CH], // 2: right side (zombie entry)
    [0, GY+ROWS*CH, IW/2, BOT],                 // 3: next turn button area
    [IW/2, GY+ROWS*CH, IW/2, BOT],              // 4: next wave button area
  ];

  // Dim entire canvas
  ctx.fillStyle = "rgba(0,0,0,0.68)"; ctx.fillRect(0,0,IW,IH);

  // Cut spotlight (composite)
  if (step < spots.length) {
    const [sx,sy,sw,sh] = spots[step];
    ctx.save(); ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)"; ctx.fillRect(sx,sy,sw,sh);
    ctx.restore();
    // Gold glow border
    for (const [lw,col] of [[8,"rgba(255,210,40,0.3)"],[4,"rgba(255,210,40,0.7)"],[1.5,"rgba(255,245,150,1)"]]) {
      ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.strokeRect(sx-2,sy-2,sw+4,sh+4);
    }
  }

  // Info box
  const tips = [
    ["☀  Sun is your Currency",  "Sunflowers produce sun automatically.\nCollect sun to buy and place plants on the lawn!"],
    ["Plants — Select & Place",   "Press a plant button in the bar below,\nthen press a Lane button to plant it\nin that row of the lawn."],
    ["Zombies are Coming!",       "Zombies enter from the RIGHT side\nand walk toward your house.\nStop them before they reach the left edge!"],
    ["Next Turn Button",          "Press NEXT TURN to advance time.\nPlants shoot projectiles and zombies\nmove one step forward each press."],
    ["Starting the Next Wave",    "After clearing a wave, press NEXT WAVE\nwhen you are ready to continue.\nPlan your plant layout first!"],
  ];
  if (step < tips.length) {
    const [title, body] = tips[step];
    rndRect(ctx, IW/2-238, 112, 476, 172, 14, "rgba(12,14,28,0.94)", "#FFDA28", 3);
    txt(ctx, title, IW/2, 130, 19, true, "#FFD828", "center");
    body.split("\n").forEach((line,i) => txt(ctx, line, IW/2, 162+i*26, 13, false, "#CCD8FF", "center"));
    txt(ctx, `Step ${step+1} of 5`, IW/2, IH-22, 12, false, "#8090B0", "center");
    // Arrow indicator pointing at spotlight
    if (step < spots.length) {
      const [sx,sy,sw,sh] = spots[step];
      const ax = sx + sw/2, ay = sy < 112 ? sy + sh + 8 : sy - 12;
      ctx.fillStyle="#FFD828"; ctx.beginPath();
      if (sy < 112) { ctx.moveTo(ax-8,ay);ctx.lineTo(ax+8,ay);ctx.lineTo(ax,ay-12);ctx.closePath(); }
      else          { ctx.moveTo(ax-8,ay);ctx.lineTo(ax+8,ay);ctx.lineTo(ax,ay+12);ctx.closePath(); }
      ctx.fill();
    }
  }
}

// ── End screens ────────────────────────────────────────────────────
function drawEnd(ctx, won) {
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0,0,IW,IH);
  if (won) {
    txt(ctx,"YOU WIN!",IW/2,IH/2-60,42,true,"#FFD828","center","middle");
    txt(ctx,"All zombies defeated!",IW/2,IH/2+6,18,false,"#A8FFA8","center","middle");
  } else {
    txt(ctx,"GAME OVER",IW/2,IH/2-60,42,true,"#DC2828","center","middle");
    txt(ctx,"The zombies ate your brains...",IW/2,IH/2+6,16,false,"#FFA8A8","center","middle");
  }
  txt(ctx,"Use the buttons below to continue.",IW/2,IH/2+44,15,false,"#C0C0C0","center","middle");
}

// ── House ──────────────────────────────────────────────────────────
function drawHouse(ctx) {
  const hx = GX - 8, hy = GY + ROWS*CH / 4;
  // Simple cartoon house on left edge
  ctx.fillStyle = "#E8D0A0"; ctx.fillRect(hx-30, hy, 32, 50);
  ctx.fillStyle = "#C84020";
  poly(ctx,[[hx-34,hy],[hx+4,hy],[hx-15,hy-28]],"#C84020","#8C2810",2);
  ctx.fillStyle = "#8CB4DC"; ctx.fillRect(hx-24, hy+24, 14, 26); // door
  ctx.fillStyle = "#C0D8F0"; ctx.fillRect(hx-20, hy+8, 12, 12);  // window
  ctx.strokeStyle="#A09070"; ctx.lineWidth=1.5; ctx.strokeRect(hx-30,hy,32,50);
}

// ── Main render ────────────────────────────────────────────────────
function renderPvz(state) {
  const canvas = createCanvas(IW, IH);
  const ctx    = canvas.getContext("2d");
  const phase  = state.phase     || "playing";
  const ak     = state.atmosphere || "day";

  if (phase === "level_select") {
    drawLevelSelect(ctx, state);
    return canvas.toBuffer("image/png");
  }

  drawBg(ctx, ak);
  drawHouse(ctx);
  drawUI(ctx, state, ak);

  // ── Plants ──────────────────────────────────────────────────────
  (state.grid || []).forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (!cell) return;
      const cx = GX + ci*CW + CW/2;
      const cy = GY + ri*CH + CH/2 - 3;
      const fn = PD[cell.type];
      if (fn) fn(ctx, cx, cy, CW, CH);
      const p = (cell.hp||300) / Math.max(cell.maxHp||300, 1);
      drawHpBar(ctx, cx-20, GY+ri*CH+CH-9, 40, p);
    });
  });

  // ── Zombies ─────────────────────────────────────────────────────
  (state.zombies || []).forEach(z => {
    const zx = (GX + z.x * CW) | 0;
    const zy = (GY + z.row*CH + CH/2 - 4) | 0;
    const fn = ZD[z.type];
    if (fn) fn(ctx, zx, zy);
    const p = (z.hp||100) / Math.max(z.maxHp||100, 1);
    drawHpBar(ctx, zx-20, (GY + z.row*CH + CH - 9)|0, 40, p);
  });

  // ── Projectiles ─────────────────────────────────────────────────
  const PC = { pea:"#50C850", snow:"#96E8FF", fire:"#FF7814", spike:"#C8C850" };
  (state.projectiles || []).forEach(p => {
    const px = (GX + p.x*CW) | 0;
    const py = (GY + p.row*CH + CH/2 - 4) | 0;
    const col = PC[p.type] || "#50C850";
    // Fire peas are bigger
    const r = p.type === "fire" ? 9 : 6;
    ell(ctx, px, py, r, r, col);
    if (p.type === "pea") { ell(ctx, px-2, py-2, 3, 3, "rgba(200,255,200,0.7)"); }
  });

  // ── Overlays ─────────────────────────────────────────────────────
  if (phase === "tutorial")  drawTutorial(ctx, state.tutorialStep || 0);
  else if (phase === "game_over") drawEnd(ctx, false);
  else if (phase === "victory")   drawEnd(ctx, true);

  return canvas.toBuffer("image/png");
}

module.exports = { renderPvz };
