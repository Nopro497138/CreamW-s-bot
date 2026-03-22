// pvz_render.js — PvZ game renderer using node-canvas (no Python required)
"use strict";
const { createCanvas } = require("canvas");

const CW = 70, CH = 70, COLS = 9, ROWS = 5;
const SB = 52, TOP = 52, BOT = 44;
const IW = SB + COLS * CW + 12;
const IH = TOP + ROWS * CH + BOT;
const GX = SB, GY = TOP;

// ── Color helpers ─────────────────────────────────────────────────────────
const c = (r, g, b, a = 1) => `rgba(${r},${g},${b},${a})`;
const hex = h => h; // pass through CSS hex strings

const ATMO = {
  day:   { sky:"#57B6FF", ga:"#6AAA32", gb:"#50901E", ui:"#3C7814" },
  night: { sky:"#0F0F32", ga:"#234123", gb:"#163016", ui:"#143214" },
  pool:  { sky:"#64BEE6", ga:"#448C44", gb:"#306C30", ui:"#286450" },
  fog:   { sky:"#828C9B", ga:"#465F46", gb:"#344A34", ui:"#3C503C" },
  roof:  { sky:"#C88246", ga:"#AA7850", gb:"#8A623A", ui:"#825028" },
};

// ── Draw primitives ───────────────────────────────────────────────────────
function ell(ctx, cx, cy, rx, ry, fill, stroke, lw = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.restore();
  if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function rct(ctx, cx, cy, w, h, fill, stroke, lw = 1) {
  const x = cx - w / 2, y = cy - h / 2;
  if (fill)   { ctx.fillStyle = fill;     ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); }
}
function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function lin(ctx, x0, y0, x1, y1, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}
function txt(ctx, s, x, y, size, bold, fill, align = "left", baseline = "top") {
  ctx.font = `${bold ? "bold" : "normal"} ${size}px sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillStyle = "#000"; ctx.lineWidth = 2; ctx.strokeStyle = "#000";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function hpColor(p) { return p > 0.6 ? "#3CC83C" : p > 0.3 ? "#DCC81E" : "#DC3232"; }
function drawHp(ctx, x, y, w, p) {
  ctx.fillStyle = "#3C3C3C"; ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = hpColor(p); ctx.fillRect(x, y, w * p, 5);
}

// ── Plant drawing ─────────────────────────────────────────────────────────
const PD = {
  peashooter(ctx, cx, cy) {
    rct(ctx,cx,cy+12,10,30,"#146E14");
    ell(ctx,cx,cy-4,22,22,"#32B432","#146E14",2); rct(ctx,cx+22,cy-4,14,8,"#146E14"); ell(ctx,cx+6,cy-10,5,5,"#141414");
  },
  sunflower(ctx, cx, cy) {
    for (let a = 0; a < 360; a += 45) { const r = a*Math.PI/180; ell(ctx,cx+24*Math.cos(r)|0,(cy-8+22*Math.sin(r))|0,9,6,"#FFDC00"); }
    ell(ctx,cx,cy-8,14,14,"#C88214"); rct(ctx,cx,cy+16,8,28,"#32A01E");
  },
  wallnut(ctx, cx, cy) {
    ell(ctx,cx,cy,26,28,"#B4823C","#785014",2);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx-16+i*7,cy,12,0.5,2.6); ctx.strokeStyle="#785014"; ctx.lineWidth=2; ctx.stroke(); }
    ell(ctx,cx-8,cy-6,4,4,"#1E1408"); ell(ctx,cx+8,cy-6,4,4,"#1E1408");
  },
  cherrybomb(ctx, cx, cy) {
    ell(ctx,cx-12,cy+4,18,18,"#DC1E1E","#961010",2); ell(ctx,cx+12,cy+4,18,18,"#DC1E1E","#961010",2);
    lin(ctx,cx-12,cy-12,cx-6,cy-18,"#3C8C1E",3); lin(ctx,cx+12,cy-12,cx+6,cy-18,"#3C8C1E",3);
    ell(ctx,cx-12,cy+2,5,5,"#FF5050"); ell(ctx,cx+12,cy+2,5,5,"#FF5050");
  },
  potatomine(ctx, cx, cy) {
    ell(ctx,cx,cy+10,22,14,"#A07828","#643C1E",2); rct(ctx,cx,cy-10,6,16,"#643C1E"); ell(ctx,cx,cy-18,4,4,"#C83232");
  },
  snowpea(ctx, cx, cy) {
    rct(ctx,cx,cy+12,10,30,"#32A01E");
    ell(ctx,cx,cy-4,22,22,"#64C8E6","#3C96B4",2); rct(ctx,cx+22,cy-4,14,8,"#3C96B4"); ell(ctx,cx+6,cy-10,5,5,"#141414");
  },
  chomper(ctx, cx, cy) {
    rct(ctx,cx,cy+12,10,28,"#7832A0");
    poly(ctx,[[cx-20,cy-18],[cx+20,cy-18],[cx+20,cy+4],[cx-20,cy+4]],"#C83CDC","#82201E");
    poly(ctx,[[cx-20,cy+4],[cx+20,cy+4],[cx+20,cy+16],[cx-20,cy+16]],"#9628B4","#641478");
    for (let i = 0; i < 4; i++) poly(ctx,[[cx-15+i*10,cy-18],[cx-9+i*10,cy-18],[cx-12+i*10,cy-8]],"#FFFFFF");
    for (let i = 0; i < 3; i++) poly(ctx,[[cx-10+i*10,cy+4],[cx-4+i*10,cy+4],[cx-7+i*10,cy+14]],"#FFFFFF");
  },
  repeater(ctx, cx, cy) {
    rct(ctx,cx,cy+12,10,30,"#146E1E");
    ell(ctx,cx,cy-4,22,22,"#1EA028","#146E1E",2);
    rct(ctx,cx+22,cy-9,14,6,"#146E1E"); rct(ctx,cx+22,cy+1,14,6,"#146E1E"); ell(ctx,cx+6,cy-10,5,5,"#141414");
  },
  puffshroom(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#50789A"; ctx.beginPath(); ctx.arc(cx,cy-16,20,Math.PI,0); ctx.closePath(); ctx.fill();
    ell(ctx,cx-8,cy-14,5,5,"#FFFFFF"); ell(ctx,cx+8,cy-14,5,5,"#FFFFFF"); ell(ctx,cx,cy-22,4,4,"#FFFFFF");
  },
  sunshroom(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#E6BE0A"; ctx.beginPath(); ctx.arc(cx,cy-16,20,Math.PI,0); ctx.closePath(); ctx.fill();
    ell(ctx,cx,cy-8,6,6,"#FFF064");
  },
  fumeshroom(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#785028"; ctx.beginPath(); ctx.arc(cx,cy-16,20,Math.PI,0); ctx.closePath(); ctx.fill();
    [-12,0,12].forEach((dx,i) => ell(ctx,cx+dx,cy-20-i*4,8,8,"#B4DC64"));
  },
  scaredy(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#DC5A96"; ctx.beginPath(); ctx.arc(cx,cy-12,16,Math.PI,0); ctx.closePath(); ctx.fill();
    ell(ctx,cx-6,cy-2,5,6,"#FFFFFF"); ell(ctx,cx+6,cy-2,5,6,"#FFFFFF");
    ell(ctx,cx-6,cy-2,2,3,"#1E1E1E"); ell(ctx,cx+6,cy-2,2,3,"#1E1E1E");
  },
  iceshroom(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#8CDCFF"; ctx.beginPath(); ctx.arc(cx,cy-16,20,Math.PI,0); ctx.closePath(); ctx.fill();
    for (let a = 0; a < 360; a += 60) { const r=a*Math.PI/180; lin(ctx,cx,cy-10,cx+14*Math.cos(r)|0,(cy-10+14*Math.sin(r))|0,"#C8F0FF",2); }
  },
  doomshroom(ctx, cx, cy) {
    rct(ctx,cx,cy+14,12,20,"#E6E6DC","#B4B4AA");
    ctx.fillStyle="#3C1450"; ctx.beginPath(); ctx.arc(cx,cy-14,26,Math.PI,0); ctx.closePath(); ctx.fill();
    ell(ctx,cx,cy-14,7,7,"#C8C8C8");
  },
  squash(ctx, cx, cy) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx-22,cy-16,44,38,10); ctx.fillStyle="#3CB43C"; ctx.fill(); ctx.strokeStyle="#1E8214"; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    for (let x0 = cx-18; x0 < cx+20; x0 += 8) lin(ctx,x0,cy-16,x0,cy+22,"#1E7814",2);
    ell(ctx,cx-8,cy-4,5,5,"#141414"); ell(ctx,cx+8,cy-4,5,5,"#141414");
  },
  threepeater(ctx, cx, cy) {
    lin(ctx,cx,cy+20,cx,cy-18,"#0A7814",8); lin(ctx,cx-2,cy-8,cx-24,cy-22,"#0A7814",6); lin(ctx,cx-2,cy-8,cx+24,cy-22,"#0A7814",6);
    [[cx,cy-28],[cx-24,cy-32],[cx+24,cy-32]].forEach(([hx,hy]) => { ell(ctx,hx,hy,14,14,"#14C828","#0A7814",2); rct(ctx,hx+14,hy,10,6,"#0A7814"); });
  },
  torchwood(ctx, cx, cy) {
    ell(ctx,cx,cy+8,26,18,"#A05014","#643214",2);
    for (let i = 0; i < 3; i++) lin(ctx,cx-18+i*18,cy-4,cx-14+i*18,cy+20,"#783C14",3);
    [[-8,"#FF5000"],[0,"#FF8C00"],[8,"#FF5000"]].forEach(([dx,fc]) => poly(ctx,[[cx+dx-6,cy-4],[cx+dx+6,cy-4],[cx+dx,cy-24]],fc));
  },
  twinsunflower(ctx, cx, cy) {
    [-14,14].forEach(ox => {
      for (let a = 0; a < 360; a += 45) { const r=a*Math.PI/180; ell(ctx,(cx+ox+16*Math.cos(r))|0,(cy-6+14*Math.sin(r))|0,6,4,"#FFDC00"); }
      ell(ctx,cx+ox,cy-6,10,10,"#C88214");
    });
    rct(ctx,cx,cy+18,8,22,"#32A01E");
  },
  tallnut(ctx, cx, cy) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx-18,cy-30,36,58,8); ctx.fillStyle="#B4823C"; ctx.fill(); ctx.strokeStyle="#785014"; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    rct(ctx,cx,cy-28,30,10,"#8C6428");
    ell(ctx,cx-6,cy-4,4,4,"#1E1408"); ell(ctx,cx+6,cy-4,4,4,"#1E1408");
  },
  cactus(ctx, cx, cy) {
    rct(ctx,cx,cy+4,16,40,"#32A032","#1E7814",2);
    rct(ctx,cx-22,cy-8,12,6,"#32A032","#1E7814",2); rct(ctx,cx-22,cy-18,6,20,"#32A032","#1E7814",2);
    rct(ctx,cx+22,cy-4,12,6,"#32A032","#1E7814",2); rct(ctx,cx+22,cy-20,6,24,"#32A032","#1E7814",2);
    for (let dy = -20; dy < 22; dy += 7) { lin(ctx,cx-8,cy+dy,cx-14,cy+dy-3,"#C8C832"); lin(ctx,cx+8,cy+dy,cx+14,cy+dy-3,"#C8C832"); }
  },
};

// ── Zombie drawing ────────────────────────────────────────────────────────
function zbody(ctx, cx, cy, bodyC, headC, s = 1) {
  const bw = 20*s|0, bh = 26*s|0;
  rct(ctx,cx,cy+(8*s)|0,bw,bh,"#C8D2C8","#646E64");
  lin(ctx,cx,cy+(4*s)|0,cx,cy+(20*s)|0,"#969E96",Math.max(1,2*s|0));
  ell(ctx,cx,cy-(12*s)|0,(18*s)|0,(16*s)|0,headC,`#${Math.max(0,(parseInt(headC.slice(1,3),16)-30)).toString(16).padStart(2,"0").repeat(3)}`,Math.max(1,2*s|0));
  [[cx-6*s|0,cy-14*s|0],[cx+6*s|0,cy-14*s|0]].forEach(([ex,ey]) => ell(ctx,ex,ey,Math.max(2,4*s|0),Math.max(1,3*s|0),"#1E1408"));
  lin(ctx,cx-bw-(8*s)|0,cy+(2*s)|0,cx-bw,cy+(2*s)|0,headC,Math.max(1,6*s|0));
  lin(ctx,cx+bw+(8*s)|0,cy+(2*s)|0,cx+bw,cy+(2*s)|0,headC,Math.max(1,6*s|0));
  lin(ctx,cx-(8*s)|0,cy+(22*s)|0,cx-(12*s)|0,cy+(34*s)|0,"#504640",Math.max(1,7*s|0));
  lin(ctx,cx+(8*s)|0,cy+(22*s)|0,cx+(14*s)|0,cy+(34*s)|0,"#504640",Math.max(1,7*s|0));
  poly(ctx,[[cx,cy+(2*s)|0],[cx-(4*s)|0,cy+(10*s)|0],[cx,cy+(20*s)|0],[cx+(4*s)|0,cy+(10*s)|0]],"#B41E1E");
}
const ZD = {
  regular(ctx,cx,cy)  { zbody(ctx,cx,cy,"#BEC8AA","#C8D7B9"); },
  cone(ctx,cx,cy)     { zbody(ctx,cx,cy,"#C8BEA0","#DC821E"); poly(ctx,[[cx-14,cy-22],[cx+14,cy-22],[cx,cy-44]],"#E6781E","#B45014"); },
  bucket(ctx,cx,cy)   {
    zbody(ctx,cx,cy,"#B9B9C8","#A0A5AF");
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx-16,cy-36,32,16,4); ctx.fillStyle="#A0A5AF"; ctx.fill(); ctx.strokeStyle="#646569"; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    lin(ctx,cx-18,cy-36,cx+18,cy-36,"#787B87",3);
  },
  flag(ctx,cx,cy)     { ZD.regular(ctx,cx,cy); lin(ctx,cx+12,cy-30,cx+12,cy+6,"#A09682",2); poly(ctx,[[cx+12,cy-30],[cx+28,cy-24],[cx+12,cy-18]],"#DC2828"); },
  polevault(ctx,cx,cy){ zbody(ctx,cx,cy,"#B4B4A0","#C8C8B4"); lin(ctx,cx+8,cy-20,cx+22,cy+30,"#B49664",3); },
  newspaper(ctx,cx,cy){
    zbody(ctx,cx,cy,"#C8C3AF","#E6DCBe");
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx-22,cy-6,20,20,2); ctx.fillStyle="#E6DC8C"; ctx.fill(); ctx.strokeStyle="#A09678"; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
    for (let ly = cy-2; ly < cy+12; ly += 4) lin(ctx,cx-20,ly,cx-4,ly,"#78706E");
  },
  football(ctx,cx,cy) {
    zbody(ctx,cx,cy,"#A07846","#504028",1.2);
    ell(ctx,cx,cy-14,22,18,"#504028","#322818",2);
    lin(ctx,cx-16,cy-14,cx+16,cy-14,"#FFFFFF",2); lin(ctx,cx-10,cy-22,cx+10,cy-22,"#FFFFFF",2); lin(ctx,cx-10,cy-6,cx+10,cy-6,"#FFFFFF",2);
  },
  dancing(ctx,cx,cy)  {
    zbody(ctx,cx,cy,"#A050A0","#C864C8"); rct(ctx,cx,cy-2,22,28,"#A050A0","#783282");
    for (let i = 0, dy = cy-10; dy < cy+10; dy += 8, i++) rct(ctx,cx,dy,22,6,`rgb(200,${100+i*20},200)`);
  },
  balloon(ctx,cx,cy)  {
    ZD.regular(ctx,cx,cy); lin(ctx,cx+10,cy-20,cx+10,cy-42,"#C8C8C8");
    ell(ctx,cx+10,cy-52,12,16,"#FF5050","#C82828",2);
  },
  digger(ctx,cx,cy)   {
    zbody(ctx,cx,cy,"#96826E","#64503C"); rct(ctx,cx,cy-28,22,10,"#504640","#3C3228");
    lin(ctx,cx+16,cy-16,cx+32,cy+8,"#8C826E",4); poly(ctx,[[cx+28,cy+4],[cx+36,cy],[cx+34,cy+12]],"#B4B4BE");
  },
  gargantuar(ctx,cx,cy) {
    zbody(ctx,cx,cy,"#645A46","#504637",1.8);
    lin(ctx,cx+54,cy-54,cx+54,cy+43,"#785A3C",8); lin(ctx,cx+32,cy-32,cx+75,cy-32,"#785A3C",5);
  },
  imp(ctx,cx,cy) {
    ell(ctx,cx,cy-4,16,18,"#B48264","#645040"); rct(ctx,cx,cy+12,12,16,"#96706E");
    ell(ctx,cx-6,cy-12,3,3,"#1E1408"); ell(ctx,cx+6,cy-12,3,3,"#1E1408");
    poly(ctx,[[cx-16,cy-22],[cx-8,cy-18],[cx-12,cy-10]],"#B41E1E"); poly(ctx,[[cx+16,cy-22],[cx+8,cy-18],[cx+12,cy-10]],"#B41E1E");
  },
};

// ── Background ────────────────────────────────────────────────────────────
function drawBg(ctx, ak) {
  const a = ATMO[ak] || ATMO.day;
  ctx.fillStyle = a.sky; ctx.fillRect(0, 0, IW, GY);
  if (ak === "night") {
    [[50,15],[120,8],[200,22],[300,12],[400,18],[560,6],[640,20]].forEach(([sx,sy]) => ell(ctx,sx,sy,2,2,"#FFFFC8"));
  }
  if (ak === "roof") {
    ctx.fillStyle = "#B47846"; ctx.fillRect(0, GY-24, IW, 24);
    for (let xi = 0; xi < IW; xi += 30) { ctx.fillStyle = "#A06437"; ctx.fillRect(xi, GY-22, 14, 22); }
  }
  for (let row = 0; row < ROWS; row++) {
    ctx.fillStyle = row % 2 === 0 ? a.ga : a.gb;
    ctx.fillRect(GX, GY + row*CH, COLS*CW, CH);
  }
  if (ak === "pool") {
    for (const row of [2,3]) {
      const y0 = GY + row*CH;
      ctx.fillStyle = "#3C82B4"; ctx.fillRect(GX, y0, COLS*CW, CH);
      for (let xi = GX+10; xi < GX+COLS*CW; xi += 20) {
        ctx.beginPath(); ctx.arc(xi+8, y0+CH/2, 8, Math.PI, 0); ctx.strokeStyle = "#64B4DC"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }
  if (ak === "fog") {
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#C8D2DC";
    for (let xi = 0; xi < IW; xi += 60) for (let yi = GY; yi < GY+ROWS*CH; yi += 50) { ctx.beginPath(); ctx.ellipse(xi+40,yi+20,40,20,0,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }
  // Grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (let col = 0; col <= COLS; col++) { ctx.beginPath(); ctx.moveTo(GX+col*CW,GY); ctx.lineTo(GX+col*CW,GY+ROWS*CH); ctx.stroke(); }
  for (let row = 0; row <= ROWS; row++) { ctx.beginPath(); ctx.moveTo(GX,GY+row*CH); ctx.lineTo(GX+COLS*CW,GY+row*CH); ctx.stroke(); }
}

function drawUI(ctx, state, ak) {
  const a = ATMO[ak] || ATMO.day;
  ctx.fillStyle = a.ui; ctx.fillRect(0, 0, IW, TOP);
  txt(ctx, `Sun: ${state.sun||50}`, 8, 8, 20, true, "#FFFFC8");
  txt(ctx, `Wave ${state.wave||1}/${state.maxWaves||5}`, IW/2, 8, 20, true, "#FFFFFF", "center");
  const lvls = ["Day","Night","Pool","Fog","Roof"]; const lv = state.level||0;
  txt(ctx, `Level ${lv+1} - ${lvls[lv]||"?"}`, IW-8, 12, 13, false, "#DCF0FF", "right");
  // Sidebar labels
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, GY, SB, ROWS*CH);
  for (let r = 0; r < ROWS; r++) {
    const label = (ak === "pool" && (r===2||r===3)) ? "~" : String(r+1);
    txt(ctx, label, 6, GY + r*CH + CH/2 - 8, 13, false, "#FFFFC8");
  }
  // Bottom bar
  ctx.fillStyle = a.ui; ctx.fillRect(0, GY+ROWS*CH, IW, BOT);
  const sel = state.selectedPlant;
  txt(ctx, sel ? `Selected: ${sel}  ->  pick a Lane button` : "Select a plant, then press a Lane button", 8, GY+ROWS*CH+8, 13, false, sel ? "#FFFFC8" : "#C8C8C8");
  txt(ctx, `Tick ${state.tick||0}`, IW-8, GY+ROWS*CH+8, 12, false, "#B4B4B4", "right");
}

// ── Level select ──────────────────────────────────────────────────────────
function drawLevelSelect(ctx, state) {
  const grad = ctx.createLinearGradient(0,0,0,IH);
  grad.addColorStop(0,"#5ABBE6"); grad.addColorStop(1,"#A0C8E6");
  ctx.fillStyle = grad; ctx.fillRect(0,0,IW,IH);
  // Clouds
  [[80,55,80,38],[210,38,90,44],[390,65,100,48],[555,42,82,36],[638,75,68,33],[148,98,58,28]].forEach(([cx2,cy2,cw,ch]) => {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath(); ctx.ellipse(cx2,cy2,cw,ch,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx2-cw*0.4,cy2+4,cw*0.5,ch*0.7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx2+cw*0.4,cy2+4,cw*0.5,ch*0.7,0,0,Math.PI*2); ctx.fill();
  });
  txt(ctx, "SELECT LEVEL", IW/2, 18, 28, true, "#FFFFFF", "center");
  txt(ctx, "Choose a level to begin!", IW/2, 54, 13, false, "#E6F5FF", "center");
  const unlocked = state.unlockedLevels || [0];
  const defs = [[80,195],[195,272],[345,188],[498,272],[616,192]];
  const names = ["Day 1","Night 2","Pool 3","Fog 4","Roof 5"];
  const descs = ["Sunny Meadow","Moonlit Garden","Watery Depths","Misty Cemetery","Final Stand"];
  const aCols = ["#FFDC50","#5050BE","#3CA0D2","#8C8C8C","#D28232"];
  // Path
  ctx.save(); ctx.setLineDash([8,6]); ctx.strokeStyle = "rgba(200,200,170,0.7)"; ctx.lineWidth = 3;
  for (let i = 0; i < defs.length-1; i++) { ctx.beginPath(); ctx.moveTo(defs[i][0],defs[i][1]); ctx.lineTo(defs[i+1][0],defs[i+1][1]); ctx.stroke(); }
  ctx.restore();
  defs.forEach(([x,y], i) => {
    const lo = !unlocked.includes(i);
    // Shadow
    ell(ctx,x+3,y+3,44,24,"rgba(0,0,0,0.3)");
    ell(ctx,x,y,44,24,lo?"#505050":aCols[i],lo?"#3C3C3C":"#FFFFFF",2);
    if (lo) {
      txt(ctx,"LOCKED",x,y-6,12,true,"#C8C8C8","center","middle");
      txt(ctx,`Level ${i+1}`,x,y+8,11,false,"#A0A0A0","center","middle");
    } else {
      const stars = (state.levelStars||{})[i] || 0;
      txt(ctx,names[i],x,y-12,14,true,"#140A00","center","middle");
      txt(ctx,descs[i],x,y+2,10,false,"#281400","center","middle");
      txt(ctx,"*".repeat(stars)+"-".repeat(3-stars),x,y+14,11,false,"#FFC800","center","middle");
    }
  });
}

// ── Tutorial ──────────────────────────────────────────────────────────────
function drawTutorial(ctx, step) {
  // Spotlight regions [x1,y1,x2,y2]
  const spots = [
    [2,2,150,TOP-2],
    [0,GY+ROWS*CH,IW,IH],
    [GX+5*CW,GY,IW-2,GY+ROWS*CH],
    [2,GY+ROWS*CH,IW/2-4,IH],
    [IW/2+4,GY+ROWS*CH,IW-2,IH],
  ];
  // Dim overlay with spotlight cut-out
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0,0,IW,IH);
  if (step < spots.length) {
    const [x1,y1,x2,y2] = spots[step];
    ctx.clearRect(x1,y1,x2-x1,y2-y1);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    // Redraw dim except spotlight
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(x1,y1,x2-x1,y2-y1);
    ctx.globalCompositeOperation = "source-over";
    // Gold border
    ctx.strokeStyle = "#FFDC32"; ctx.lineWidth = 3;
    ctx.strokeRect(x1-2,y1-2,x2-x1+4,y2-y1+4);
  }
  ctx.restore();
  // Info box
  const tips = [
    ["Sun is your currency", "Sunflowers produce sun automatically.\nCollect sun to buy and place plants!"],
    ["Selecting & Placing Plants", "Press a plant button in the panel below,\nthen press a Lane button to place it."],
    ["The Zombie Threat", "Zombies enter from the right.\nThey walk left — stop them before\nthey reach your home!"],
    ["Next Turn Button", "Press Next Turn to advance time.\nPlants shoot and zombies move\none step each press."],
    ["Next Wave", "Once a wave is cleared, press\nNext Wave when you are ready.\nPlan your defense first!"],
  ];
  if (step < tips.length) {
    const [title, body] = tips[step];
    ctx.save();
    ctx.fillStyle = "rgba(20,22,36,0.92)";
    ctx.beginPath(); ctx.roundRect(IW/2-240,118,480,175,14); ctx.fill();
    ctx.strokeStyle = "#FFDC32"; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    txt(ctx, title, IW/2, 136, 18, true, "#FFDC32", "center");
    body.split("\n").forEach((line,i) => txt(ctx,line,IW/2,168+i*24,13,false,"#D2DCFF","center"));
    txt(ctx, `Step ${step+1} of 5`, IW/2, IH-24, 12, false, "#969CB4", "center");
  }
}

function drawEnd(ctx, won) {
  ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0,0,IW,IH);
  txt(ctx, won?"YOU WIN!":"GAME OVER", IW/2, IH/2-55, 38, true, won?"#FFDC32":"#DC3232", "center","middle");
  txt(ctx, won?"All zombies defeated!":"The zombies ate your brains...", IW/2, IH/2+8, 16, false, won?"#B4FFB4":"#FFAAB4","center","middle");
  txt(ctx, "Use the buttons below to continue.", IW/2, IH/2+42, 15, false, "#C8C8C8","center","middle");
}

// ── Main render ───────────────────────────────────────────────────────────
function renderPvz(state) {
  const canvas = createCanvas(IW, IH);
  const ctx    = canvas.getContext("2d");
  const phase  = state.phase || "playing";
  const ak     = state.atmosphere || "day";

  if (phase === "level_select") {
    drawLevelSelect(ctx, state);
    return canvas.toBuffer("image/png");
  }

  drawBg(ctx, ak);
  drawUI(ctx, state, ak);

  // Plants
  (state.grid || []).forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (!cell) return;
      const cx = GX + ci*CW + CW/2;
      const cy = GY + ri*CH + CH/2 - 4;
      const fn = PD[cell.type];
      if (fn) fn(ctx, cx, cy);
      drawHp(ctx, cx-22, GY+ri*CH+CH-10, 44, (cell.hp||300)/Math.max(cell.maxHp||300,1));
    });
  });

  // Zombies
  (state.zombies || []).forEach(z => {
    const zx = (GX + z.x*CW)|0;
    const zy = (GY + z.row*CH + CH/2 - 4)|0;
    const fn = ZD[z.type];
    if (fn) fn(ctx, zx, zy);
    drawHp(ctx, zx-22, (GY + z.row*CH + CH - 10)|0, 44, (z.hp||100)/Math.max(z.maxHp||100,1));
  });

  // Projectiles
  const PC = { pea:"#50C850", snow:"#96E6FF", fire:"#FF7814", spike:"#C8C850" };
  (state.projectiles || []).forEach(p => {
    const px = (GX + p.x*CW)|0;
    const py = (GY + p.row*CH + CH/2 - 4)|0;
    ell(ctx, px, py, 6, 6, PC[p.type] || "#50C850");
  });

  if (phase === "tutorial") drawTutorial(ctx, state.tutorialStep||0);
  else if (phase === "game_over") drawEnd(ctx, false);
  else if (phase === "victory")   drawEnd(ctx, true);

  return canvas.toBuffer("image/png");
}

module.exports = { renderPvz };
