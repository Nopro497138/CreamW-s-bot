// ═══════════════════════════════════════════════════════════════════
// test_bot_1.js — PART 1/2
// Build: cat test_bot_1.js test_bot_2.js > bot.js
// ═══════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const {
  Client, GatewayIntentBits, MessageFlags, AttachmentBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  AuditLogEvent, Events,
} = require("discord.js");
const { renderPvz } = require("./pvz_render.js"); // JS canvas renderer
const fs   = require("fs");
const path = require("path");
const collab = require("./collab.js");

// ── Logger ────────────────────────────────────────────────────────
const LL = { DEBUG:0, INFO:1, WARN:2, ERROR:3 };
const CL = LL[(process.env.LOG_LEVEL||"DEBUG").toUpperCase()] ?? 0;
const EM = { DEBUG:"🔍", INFO:"ℹ️ ", WARN:"⚠️ ", ERROR:"❌" };
function log(lv, area, msg, data) {
  if (LL[lv] < CL) return;
  const line = `[${new Date().toISOString()}] ${EM[lv]||""} [${lv.padEnd(5)}][${area}] ${msg}`;
  data !== undefined
    ? console.log(line, typeof data === "object" ? JSON.stringify(data) : data)
    : console.log(line);
}
const debug = (a,m,d) => log("DEBUG",a,m,d);
const info  = (a,m,d) => log("INFO", a,m,d);
const warn  = (a,m,d) => log("WARN", a,m,d);
const error = (a,m,d) => log("ERROR",a,m,d);
collab.init({ debug, info, warn, error });

// ── Config ────────────────────────────────────────────────────────
const ADMIN_ROLE_ID = "1483176429393940663";
const CFG = {
  token:            process.env.DISCORD_TOKEN,
  clientId:         process.env.CLIENT_ID,
  welcomeChannelId: "1474284438312456252",
  gifPath:          path.join(__dirname, "video.gif"),
  defaultGifUrl:    "-",
  welcomeTitle: "# Welcome, {user}!",
  welcomeBody: [
    "Welcome, {user}!",
    "",
    "Please check out our <#1470989289708847105> first!",
    "If you need help, feel free to reach out to our team at any time.",
    "---",
    "Feel free to introduce yourself, explore the channels, and meet new people!",
    "",
    "We wish you a great time with us! 🎉",
    "",
    "*– Cream Team*",
  ].join("\n"),
  banTitle:  "# You were banned from {server}",
  banBody:   ["Hello **{username}**,","","You have been permanently banned from **{server}**.","---","**Reason:** (Check Dyno's message for details)","**Moderator:** {moderator}","---","To appeal: https://appeal.gg/TVku2Yhtgw"].join("\n"),
  kickTitle: "# You were kicked from {server}",
  kickBody:  ["Hey **{username}**,","","You were kicked from **{server}**.","---","**Reason:** (Check Dyno's message for details)","**Moderator:** {moderator}","---","You may rejoin if a valid invite link is available."].join("\n"),
  muteTitle: "# You were timed out in {server}",
  muteBody:  ["Hey **{username}**,","","You have been timed out in **{server}**.","---","**Reason:** (Check Dyno's message for details)","**Moderator:** {moderator}","**Until:** {until}","---","Please follow the server rules to avoid further action."].join("\n"),
};

function isAdminUser(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles?.cache?.has(ADMIN_ROLE_ID) ?? false;
}

// ── Text helpers ──────────────────────────────────────────────────
function fill(str, data = {}) {
  let o = str;
  for (const [k, v] of Object.entries(data)) o = o.replaceAll(`{${k}}`, v ?? "—");
  return o;
}

function splitChunks(text, limit = 900) {
  if (text.length <= limit) return [text];
  const chunks = []; let cur = "";
  for (const line of text.split("\n")) {
    const candidate = cur ? cur + "\n" + line : line;
    if (candidate.length > limit && cur) { chunks.push(cur.trim()); cur = line; }
    else cur = candidate;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(c => c.length > 0);
}

function buildContainer(title, body, gifUrl, useAttachment = false) {
  const inner = [];
  inner.push({ type: 10, content: (title || "").trim().slice(0, 1800) || " " });
  inner.push({ type: 14, divider: true, spacing: 1 });

  const norm = (body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const secs = norm.split(/\n---\n|\n---$|^---\n|^---$/m);
  let hasBody = false;
  secs.forEach((sec, i) => {
    const t = sec.trim();
    if (t) {
      splitChunks(t, 900).forEach(p => { if (p.trim()) { inner.push({ type: 10, content: p.trim() }); hasBody = true; } });
    }
    if (i < secs.length - 1) inner.push({ type: 14, divider: true, spacing: 1 });
  });
  if (!hasBody) inner.push({ type: 10, content: " " });

  const noGif = !gifUrl || gifUrl.trim() === "-" || gifUrl.trim() === "";
  if (useAttachment || !noGif) {
    inner.push({ type: 14, divider: false, spacing: 2 });
    inner.push({ type: 12, items: [{ media: { url: useAttachment ? "attachment://video.gif" : gifUrl } }] });
  }
  return [{ type: 17, components: inner }];
}

function buildEditor(s) {
  const t = s.title.length > 80  ? s.title.slice(0, 80)  + "…" : s.title;
  const b = s.body.length  > 120 ? s.body.slice(0, 120)  + "…" : s.body;
  return [
    { type: 10, content: "## Message Composer" },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: `**Title**\n${t}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**Body**\n${b}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**GIF URL**\n${s.gifUrl || "(none)"}` },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: "-# Use `---` on its own line for a separator  ·  Set GIF to `-` for none" },
    { type: 1, components: [
      { type: 2, style: 1, label: "Edit Title",   custom_id: "edit_title" },
      { type: 2, style: 1, label: "Edit Body",    custom_id: "edit_body"  },
      { type: 2, style: 1, label: "Edit GIF URL", custom_id: "edit_gif"   },
    ]},
    { type: 1, components: [
      { type: 2, style: 2, label: "Preview", custom_id: "preview_msg"     },
      { type: 2, style: 3, label: "Send",    custom_id: "send_msg"        },
      { type: 2, style: 4, label: "Cancel",  custom_id: "cancel_composer" },
    ]},
  ];
}

const sessions = new Map();

// ── PvZ Data ──────────────────────────────────────────────────────
const PLANTS = {
  peashooter:   {name:"Peashooter",    cost:100,hp:300, emoji:"[P]",shootRate:3,dmg:20,projType:"pea"},
  sunflower:    {name:"Sunflower",     cost:50, hp:300, emoji:"[S]",sunRate:24,sunAmt:25},
  wallnut:      {name:"Wall-nut",      cost:50, hp:4000,emoji:"[W]"},
  cherrybomb:   {name:"Cherry Bomb",   cost:150,hp:300, emoji:"[C]",instant:true,aoe:true,aoeDmg:1800},
  potatomine:   {name:"Potato Mine",   cost:25, hp:300, emoji:"[M]",mine:true,mineDmg:1800,armDelay:15},
  snowpea:      {name:"Snow Pea",      cost:175,hp:300, emoji:"[N]",shootRate:3,dmg:20,projType:"snow",slow:true},
  chomper:      {name:"Chomper",       cost:150,hp:300, emoji:"[X]",chomp:true,rechargeTicks:42},
  repeater:     {name:"Repeater",      cost:200,hp:300, emoji:"[R]",shootRate:3,dmg:20,projType:"pea",doubleShot:true},
  puffshroom:   {name:"Puff-shroom",   cost:0,  hp:300, emoji:"[F]",shootRate:4,dmg:20,projType:"pea",lifetime:120},
  sunshroom:    {name:"Sun-shroom",    cost:25, hp:300, emoji:"[U]",sunRate:24,sunAmt:15},
  fumeshroom:   {name:"Fume-shroom",   cost:75, hp:300, emoji:"[G]",fume:true,fumeDmg:20,fumeRate:3},
  scaredy:      {name:"Scaredy-shroom",cost:25, hp:300, emoji:"[K]",shootRate:3,dmg:20,projType:"pea",hideRange:3},
  iceshroom:    {name:"Ice-shroom",    cost:75, hp:300, emoji:"[I]",instant:true,freeze:true,freezeTicks:30},
  doomshroom:   {name:"Doom-shroom",   cost:125,hp:300, emoji:"[D]",instant:true,globalAoe:true,aoeDmg:1800},
  squash:       {name:"Squash",        cost:50, hp:300, emoji:"[Q]",instant:true,squash:true},
  threepeater:  {name:"Threepeater",   cost:325,hp:300, emoji:"[3]",shootRate:3,dmg:20,projType:"pea",threeRow:true},
  torchwood:    {name:"Torchwood",     cost:175,hp:600, emoji:"[T]",torchwood:true},
  twinsunflower:{name:"Twin Sunflower",cost:150,hp:300, emoji:"[2]",sunRate:24,sunAmt:50},
  tallnut:      {name:"Tall-nut",      cost:125,hp:8000,emoji:"[A]"},
  cactus:       {name:"Cactus",        cost:125,hp:400, emoji:"[V]",shootRate:3,dmg:20,projType:"spike"},
};
const ZOMBIES = {
  regular:{hp:100,speed:0.15,dmg:2},cone:{hp:280,speed:0.15,dmg:2},bucket:{hp:650,speed:0.15,dmg:2},
  flag:{hp:100,speed:0.2,dmg:2},polevault:{hp:100,speed:0.3,dmg:2},newspaper:{hp:150,speed:0.15,dmg:2},
  football:{hp:800,speed:0.2,dmg:4},dancing:{hp:500,speed:0.2,dmg:2},balloon:{hp:100,speed:0.25,dmg:2,air:true},
  digger:{hp:300,speed:0.15,dmg:2,underground:true},gargantuar:{hp:3000,speed:0.08,dmg:20},imp:{hp:50,speed:0.4,dmg:2},
};
const LEVELS = [
  {name:"Day 1 – Sunny Meadows",   atm:"day",  sun:150,maxW:3,unlock:["snowpea","repeater"],
   waves:[[{t:"regular",c:3,r:[0,2,4]}],[{t:"regular",c:3,r:[0,1,3]},{t:"cone",c:1,r:[2]}],[{t:"cone",c:2,r:[1,3]},{t:"regular",c:3,r:[0,2,4]},{t:"flag",c:1,r:[0]}]]},
  {name:"Night 2 – Moonlit Garden",atm:"night",sun:75, maxW:4,unlock:["chomper","fumeshroom"],
   waves:[[{t:"regular",c:4,r:[0,1,2,3]}],[{t:"cone",c:2,r:[0,4]},{t:"regular",c:3,r:[1,2,3]}],[{t:"bucket",c:1,r:[2]},{t:"cone",c:2,r:[0,4]},{t:"regular",c:3,r:[1,3,2]}],[{t:"bucket",c:2,r:[1,3]},{t:"flag",c:1,r:[0]},{t:"regular",c:4,r:[0,2,4,1]}]]},
  {name:"Pool 3 – Watery Depths",  atm:"pool", sun:150,maxW:5,unlock:["iceshroom","squash"],
   waves:[[{t:"regular",c:4,r:[0,1,3,4]}],[{t:"cone",c:3,r:[1,2,3]},{t:"regular",c:2,r:[0,4]}],[{t:"bucket",c:2,r:[0,4]},{t:"balloon",c:2,r:[1,3]},{t:"regular",c:2,r:[2,2]}],[{t:"football",c:1,r:[2]},{t:"cone",c:3,r:[0,2,4]},{t:"regular",c:3,r:[1,3,1]}],[{t:"football",c:2,r:[1,3]},{t:"bucket",c:2,r:[0,4]},{t:"flag",c:1,r:[2]},{t:"regular",c:4,r:[0,1,2,3]}]]},
  {name:"Fog 4 – Misty Cemetery",  atm:"fog",  sun:100,maxW:5,unlock:["doomshroom","threepeater"],
   waves:[[{t:"digger",c:2,r:[1,3]},{t:"regular",c:3,r:[0,2,4]}],[{t:"newspaper",c:3,r:[0,2,4]},{t:"cone",c:2,r:[1,3]}],[{t:"digger",c:2,r:[0,4]},{t:"football",c:1,r:[2]},{t:"bucket",c:2,r:[1,3]}],[{t:"dancing",c:2,r:[1,3]},{t:"bucket",c:2,r:[0,4]},{t:"cone",c:3,r:[0,2,4]}],[{t:"gargantuar",c:1,r:[2]},{t:"football",c:2,r:[1,3]},{t:"flag",c:1,r:[0]},{t:"regular",c:5,r:[0,1,2,3,4]}]]},
  {name:"Roof 5 – Final Stand",    atm:"roof", sun:125,maxW:6,unlock:["torchwood","twinsunflower"],
   waves:[[{t:"football",c:2,r:[1,3]},{t:"regular",c:3,r:[0,2,4]}],[{t:"gargantuar",c:1,r:[2]},{t:"bucket",c:2,r:[0,4]},{t:"cone",c:2,r:[1,3]}],[{t:"dancing",c:2,r:[0,4]},{t:"football",c:2,r:[1,3]},{t:"digger",c:2,r:[0,4]}],[{t:"gargantuar",c:2,r:[1,3]},{t:"football",c:2,r:[0,4]},{t:"bucket",c:3,r:[0,2,4]}],[{t:"imp",c:6,r:[0,1,2,3,4,2]},{t:"gargantuar",c:2,r:[0,4]},{t:"dancing",c:2,r:[1,3]}],[{t:"gargantuar",c:3,r:[0,2,4]},{t:"football",c:2,r:[1,3]},{t:"flag",c:1,r:[2]},{t:"regular",c:5,r:[0,1,2,3,4]}]]},
];
const START_PLANTS = {
  0:["peashooter","sunflower","wallnut"],
  1:["peashooter","sunflower","wallnut","puffshroom","potatomine"],
  2:["peashooter","sunflower","wallnut","snowpea","repeater","potatomine"],
  3:["peashooter","sunflower","wallnut","snowpea","chomper","fumeshroom","iceshroom"],
  4:["peashooter","sunflower","wallnut","snowpea","repeater","threepeater","doomshroom","squash","torchwood"],
};

// ── PvZ Engine ────────────────────────────────────────────────────
const pvzGames = new Map(); let pvzId = 0; const mkId = () => ++pvzId;

function newGame(chId, uid, lv, uPl, uLv, lSt) {
  const LV = LEVELS[lv];
  return { channelId:chId, startedBy:uid, phase:"tutorial", level:lv, atmosphere:LV.atm,
    wave:0, maxWaves:LV.maxW, sun:LV.sun, tick:0,
    grid: Array.from({length:5}, () => Array(9).fill(null)),
    zombies:[], projectiles:[],
    selectedPlant:null, plantPage:0,
    availablePlants: [...(START_PLANTS[lv]||START_PLANTS[0])],
    unlockedPlants:uPl||["peashooter","sunflower","wallnut"],
    unlockedLevels:uLv||[0], levelStars:lSt||{},
    tutorialStep:0, tutorialDone:false, waveQueue:[], waveActive:false, shovelMode:false,
    messageId:null, interactionToken:null, appId:null };
}
function newLvlSel(uid, uPl, uLv, lSt) {
  return { phase:"level_select", startedBy:uid,
    unlockedPlants:uPl||["peashooter","sunflower","wallnut"],
    unlockedLevels:uLv||[0], levelStars:lSt||{},
    messageId:null, interactionToken:null, appId:null, channelId:null };
}

function gameTick(gs) {
  if (gs.phase !== "playing") return;
  gs.tick++;
  if (gs.tick % 10 === 0) gs.sun += 25;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = gs.grid[row][col]; if (!cell) continue;
      const pd = PLANTS[cell.type]; if (!pd) continue;
      if (pd.sunRate   && gs.tick % pd.sunRate === 0) gs.sun += pd.sunAmt;
      if (pd.lifetime  && gs.tick - (cell.plantedAt||0) >= pd.lifetime) { gs.grid[row][col]=null; continue; }
      if (cell.chompCooldown > 0) { cell.chompCooldown--; continue; }
      const rz = gs.zombies.filter(z => z.row===row && !z.dead && !z.underground).sort((a,b)=>a.x-b.x);
      if (!rz.length) continue;
      if (cell.type === "scaredy" && rz[0].x < col + (pd.hideRange||3)) continue;
      if (pd.shootRate && gs.tick % pd.shootRate === 0 && rz[0].x > col) {
        const rows = pd.threeRow ? [row-1,row,row+1].filter(r=>r>=0&&r<5) : [row];
        rows.forEach(r => {
          gs.projectiles.push({id:mkId(),row:r,x:col+1.0,type:pd.projType||"pea",dmg:pd.dmg||20,slow:pd.slow||false});
          if (pd.doubleShot) gs.projectiles.push({id:mkId(),row:r,x:col+0.6,type:pd.projType||"pea",dmg:pd.dmg||20,slow:false});
        });
      }
      if (pd.fume && gs.tick % (pd.fumeRate||3) === 0)
        gs.zombies.filter(z=>z.row===row&&!z.dead).forEach(z=>{z.hp-=pd.fumeDmg||20;if(z.hp<=0)z.dead=true;});
      if (pd.chomp && rz[0].x <= col+1.5 && rz[0].x > col) { rz[0].dead=true; cell.chompCooldown=pd.rechargeTicks||42; }
      if (pd.mine) {
        if (!cell.armed) { if (!cell.armTick) cell.armTick=gs.tick; if (gs.tick-cell.armTick>=(pd.armDelay||15)) cell.armed=true; }
        if (cell.armed && rz[0]?.x <= col+0.5) {
          gs.zombies.filter(z=>z.row===row&&Math.abs(z.x-col)<1.5).forEach(z=>{z.hp-=pd.mineDmg||1800;if(z.hp<=0)z.dead=true;});
          gs.grid[row][col]=null;
        }
      }
    }
  }
  gs.projectiles = gs.projectiles.filter(p => p.x <= 9.5);
  gs.projectiles.forEach(p => {
    p.x += 1.0;
    const c2 = Math.floor(p.x);
    if (c2>=0 && c2<9 && gs.grid[p.row]?.[c2]?.type==="torchwood" && p.type==="pea") { p.type="fire"; p.dmg=(p.dmg||20)*2; }
    gs.zombies.filter(z=>!z.dead&&z.row===p.row&&Math.abs(z.x-p.x)<0.8&&!z.underground).forEach(z=>{z.hp-=p.dmg;if(p.slow)z.slowTicks=10;if(z.hp<=0)z.dead=true;p.hit=true;});
  });
  gs.projectiles = gs.projectiles.filter(p => !p.hit);
  gs.zombies.filter(z=>!z.dead).forEach(z=>{
    const spd = (z.slowTicks>0) ? ZOMBIES[z.type].speed*0.5 : ZOMBIES[z.type].speed;
    if (!z.frozen) z.x -= spd;
    if (z.slowTicks>0) z.slowTicks--;
    if (z.frozenTicks>0) { z.frozenTicks--; if(z.frozenTicks===0) z.frozen=false; }
    const c2 = Math.max(0, Math.floor(z.x));
    const plant = gs.grid[z.row]?.[c2];
    if (plant && z.x <= c2+0.8) { plant.hp -= ZOMBIES[z.type].dmg; z.x=c2+0.7; if(plant.hp<=0) gs.grid[z.row][c2]=null; }
  });
  if (gs.waveQueue.length>0 && gs.tick%8===0) {
    const zd = gs.waveQueue.shift();
    gs.zombies.push({id:mkId(),type:zd.t,row:zd.r,x:8.8,hp:ZOMBIES[zd.t].hp,maxHp:ZOMBIES[zd.t].hp,dead:false,frozen:false,frozenTicks:0,slowTicks:0,underground:zd.t==="digger"});
  }
  gs.zombies.filter(z=>z.underground&&z.x<=1).forEach(z=>{z.underground=false;});
  gs.zombies = gs.zombies.filter(z=>!z.dead);
  if (gs.zombies.some(z=>z.x<=-0.2)) { gs.phase="game_over"; warn("PVZ","Game over"); return; }
  if (gs.waveQueue.length===0 && gs.zombies.length===0) {
    if (gs.wave >= gs.maxWaves) {
      gs.phase="victory"; info("PVZ","Victory",{lv:gs.level});
      LEVELS[gs.level].unlock?.forEach(p=>{if(!gs.unlockedPlants.includes(p))gs.unlockedPlants.push(p);});
      const nl=gs.level+1; if(nl<LEVELS.length&&!gs.unlockedLevels.includes(nl)) gs.unlockedLevels.push(nl);
      if(!gs.levelStars[gs.level]||gs.levelStars[gs.level]<3) gs.levelStars[gs.level]=Math.min(3,(gs.levelStars[gs.level]||0)+1);
    } else { gs.waveActive=false; }
  }
}

function spawnWave(gs) {
  const def = LEVELS[gs.level].waves[gs.wave]; if (!def) return;
  def.forEach(g => { for (let i=0;i<g.c;i++) gs.waveQueue.push({t:g.t,r:g.r[i%g.r.length]}); });
  gs.wave++; gs.waveActive=true; info("PVZ",`Wave ${gs.wave} started`);
}

function placePlant(gs, row) {
  if (!gs.selectedPlant) return "No plant selected.";
  const pd = PLANTS[gs.selectedPlant];
  if (gs.sun < pd.cost) return `Need ${pd.cost} sun (have ${gs.sun}).`;
  for (let col=0; col<9; col++) {
    if (!gs.grid[row][col]) {
      gs.sun -= pd.cost;
      gs.grid[row][col] = {type:gs.selectedPlant,hp:pd.hp,maxHp:pd.hp,plantedAt:gs.tick,armed:false,armTick:null,chompCooldown:0};
      if (pd.instant) {
        if (pd.aoe||pd.globalAoe) { const rng=pd.globalAoe?99:1; gs.zombies.forEach(z=>{if(Math.abs(z.row-row)<=rng&&Math.abs(z.x-col)<=rng+1){z.hp-=pd.aoeDmg;if(z.hp<=0)z.dead=true;}}); gs.grid[row][col]=null; }
        if (pd.freeze)  { gs.zombies.forEach(z=>{z.frozen=true;z.frozenTicks=pd.freezeTicks||30;}); gs.grid[row][col]=null; }
        if (pd.squash)  { const t=gs.zombies.filter(z=>z.row===row&&!z.dead).sort((a,b)=>a.x-b.x)[0]; if(t)t.dead=true; gs.grid[row][col]=null; }
      }
      gs.selectedPlant=null; gs.zombies=gs.zombies.filter(z=>!z.dead); return null;
    }
  }
  return "Lane is full.";
}

function buildPvzUI(gs) {
  if (gs.phase === "level_select") {
    const btns = LEVELS.map((lv,i) => ({
      type:2, style:gs.unlockedLevels.includes(i)?1:2,
      label: gs.unlockedLevels.includes(i) ? `${i+1}. ${lv.name.split("–")[0].trim()}` : `Level ${i+1} (locked)`,
      custom_id:`pvz_level_${i}`, disabled:!gs.unlockedLevels.includes(i),
    }));
    return [
      {type:17,components:[
        {type:10,content:"## Plants vs. Zombies\nSelect a level to begin!"},
        {type:14,divider:true,spacing:1},
        {type:10,content:LEVELS.map((lv,i)=>{const lo=!gs.unlockedLevels.includes(i);const st=gs.levelStars[i]?"*".repeat(gs.levelStars[i]):"-/-/-";return`${lo?"[locked]":"[open]"} Level ${i+1} - ${lv.name} ${lo?"":st}`;}).join("\n")},
      ]},
      {type:1, components:btns},
    ];
  }
  if (gs.phase === "tutorial") {
    const steps = [
      "**Sun is your currency.** Sunflowers produce sun automatically. Collect sun to buy and place plants!",
      "**Selecting & Placing Plants.** Press a plant button below to select it, then press a Lane button to place it.",
      "**Zombies** enter from the right side and walk left. Do not let them reach the left edge!",
      "**Next Turn** advances time. Plants shoot and zombies move each time you press it.",
      "**Between Waves** — plan your defenses before pressing Next Wave to continue.",
    ];
    return [
      {type:17,components:[
        {type:10,content:`## Tutorial — Step ${gs.tutorialStep+1} of 5`},
        {type:14,divider:true,spacing:1},
        {type:10,content:steps[gs.tutorialStep]||steps[0]},
        {type:14,divider:true,spacing:1},
        {type:10,content:"-# The image above highlights the relevant element for this step."},
      ]},
      {type:1,components:[
        {type:2,style:1,label:gs.tutorialStep<4?"Next Step":"Start Game",custom_id:"pvz_tut_next"},
        {type:2,style:2,label:"Skip Tutorial",custom_id:"pvz_tut_skip"},
      ]},
    ];
  }
  const plants=gs.availablePlants, page=gs.plantPage||0, ps=5;
  const pBtns = plants.slice(page*ps,(page+1)*ps).map(pt=>{
    const pd=PLANTS[pt]; const ok=gs.sun>=pd.cost;
    return {type:2,style:gs.selectedPlant===pt?3:(ok?1:2),label:`${pd.name} (${pd.cost})`,custom_id:`pvz_select_${pt}`,disabled:!ok&&gs.selectedPlant!==pt};
  });
  while (pBtns.length < 5) pBtns.push({type:2,style:2,label:`-`,custom_id:`pvz_noop_${pBtns.length}`,disabled:true});
  const lBtns = [0,1,2,3,4].map(r=>({type:2,style:2,label:`Lane ${r+1}`,custom_id:`pvz_lane_${r}`}));
  const btwn = !gs.waveActive && gs.zombies.length===0 && gs.wave<gs.maxWaves;
  const maxP = Math.ceil(plants.length/ps)-1;
  const aBtns = [
    {type:2,style:1,label:"Next Turn",custom_id:"pvz_tick"},
    {type:2,style:gs.shovelMode?4:2,label:"Shovel",custom_id:"pvz_shovel"},
    btwn ? {type:2,style:3,label:"Next Wave",custom_id:"pvz_nextwave"}
         : {type:2,style:2,label:`Sun: ${gs.sun}`,custom_id:"pvz_suninfo",disabled:true},
    maxP>0 ? {type:2,style:2,label:`Plants ${page+1}/${maxP+1}`,custom_id:"pvz_plantpage"}
           : {type:2,style:2,label:`Sun: ${gs.sun}`,custom_id:"pvz_sun2",disabled:true},
    {type:2,style:4,label:"Quit",custom_id:"pvz_quit"},
  ];
  let inf = `**Wave ${gs.wave}/${gs.maxWaves}** · Sun: ${gs.sun} · ${gs.zombies.length} zombie(s)`;
  if (btwn)              inf += "\n**Wave cleared!** Start the next wave when ready.";
  if (gs.shovelMode)     inf += "\n**Shovel mode** — press a Lane to remove the rightmost plant.";
  if (gs.selectedPlant)  inf += `\n**${PLANTS[gs.selectedPlant].name}** selected — press a Lane to place.`;
  const comps = [{type:17,components:[{type:12,items:[{media:{url:"attachment://game.png"}}]},{type:14,divider:true,spacing:1},{type:10,content:inf}]}];
  if (gs.phase==="playing") { comps.push({type:1,components:pBtns}); comps.push({type:1,components:lBtns}); comps.push({type:1,components:aBtns}); }
  if (gs.phase==="game_over") comps.push({type:1,components:[{type:2,style:1,label:"Restart Level",custom_id:"pvz_restart"},{type:2,style:2,label:"Level Select",custom_id:"pvz_lvlselect"}]});
  if (gs.phase==="victory") { const hn=gs.level+1<LEVELS.length; comps.push({type:1,components:[hn?{type:2,style:3,label:"Next Level",custom_id:"pvz_nextlevel"}:{type:2,style:1,label:"All Levels Done!",custom_id:"pvz_noop_win",disabled:true},{type:2,style:2,label:"Level Select",custom_id:"pvz_lvlselect"}]}); }
  return comps;
}

async function updateGame(gs, interaction, isNew=false) {
  info("PVZ_M", `Update (new=${isNew})`, {phase:gs.phase});
  const buf = renderPvz(gs); // synchronous JS canvas call
  const att = new AttachmentBuilder(buf, {name:"game.png"});
  const comps = buildPvzUI(gs);
  if (isNew) {
    const msg = await interaction.reply({files:[att],components:comps,flags:MessageFlags.IsComponentsV2,fetchReply:true});
    gs.messageId=msg.id; gs.interactionToken=interaction.token; gs.appId=interaction.applicationId;
  } else {
    await interaction.update({files:[att],components:comps,flags:MessageFlags.IsComponentsV2});
  }
}
async function sendLvlSel(interaction, gs) {
  const buf = renderPvz(gs);
  const att = new AttachmentBuilder(buf, {name:"game.png"});
  const msg = await interaction.reply({files:[att],components:buildPvzUI(gs),flags:MessageFlags.IsComponentsV2,fetchReply:true});
  gs.messageId=msg.id; gs.channelId=interaction.channelId; gs.interactionToken=interaction.token; gs.appId=interaction.applicationId;
  pvzGames.set(interaction.channelId, gs);
  info("PVZ_M","Level select sent",msg.id);
}
// ── END OF PART 1 ── append test_bot_2.js directly below ──────────
// ═══════════════════════════════════════════════════════════════════
// test_bot_2.js — PART 2/2
// Build: cat test_bot_1.js test_bot_2.js > bot.js
// ═══════════════════════════════════════════════════════════════════

// ── Discord Client ────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildBans],
});

// ── Register Commands ─────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  info("BOT", `Logged in as ${c.user.tag}`);
  info("BOT", "App ID", c.user.id);
  info("BOT", "pvz_render.js found?", fs.existsSync(path.join(__dirname, "pvz_render.js")));
  info("BOT", "collab.js found?",     fs.existsSync(path.join(__dirname, "collab.js")));
  info("BOT", "video.gif found?",     fs.existsSync(CFG.gifPath));

  const adminPerm = PermissionFlagsBits.Administrator;
  const commands = [
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Compose and send a custom message (admin only)")
      .setDefaultMemberPermissions(adminPerm).toJSON(),
    new SlashCommandBuilder()
      .setName("test")
      .setDescription("DM yourself a preview of a message type (admin only)")
      .setDefaultMemberPermissions(adminPerm)
      .addStringOption(o => o.setName("type").setDescription("Message type").setRequired(true)
        .addChoices(
          {name:"Welcome",value:"welcome"},
          {name:"Ban",    value:"ban"},
          {name:"Kick",   value:"kick"},
          {name:"Mute",   value:"mute"},
        )).toJSON(),
    new SlashCommandBuilder()
      .setName("pvz")
      .setDescription("Start a Plants vs. Zombies game (everyone can see it)")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("collab")
      .setDescription("Create a collaboration project (or manage yours)")
      .toJSON(),
  ];

  const rest  = new REST({version:"10"}).setToken(CFG.token);
  const appId = CFG.clientId || c.user.id;
  info("BOT", "Registering commands for app", appId);
  try {
    await rest.put(Routes.applicationCommands(appId), {body: commands});
    info("BOT", "Commands registered: /send /test /pvz /collab");
  } catch (e) { error("BOT", "Failed to register commands", e.message); }
});

// ── Interaction Handler ───────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  debug("INT", "Received", {type:interaction.type, id:interaction.customId||interaction.commandName, user:interaction.user?.tag});

  // ── /send ─────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
    if (!isAdminUser(interaction.member)) {
      await interaction.reply({components:[{type:10,content:"❌  You need the admin role to use this command."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
      return;
    }
    info("CMD", "/send", interaction.user.tag);
    const s = {title:"# Your Title Here", body:"Write your message here.\n---\nUse --- on its own line for a separator.", gifUrl:"-", channelId:interaction.channelId};
    sessions.set(interaction.user.id, s);
    await interaction.reply({components:buildEditor(s), flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
    return;
  }

  // ── /test ─────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "test") {
    if (!isAdminUser(interaction.member)) {
      await interaction.reply({components:[{type:10,content:"❌  You need the admin role to use this command."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
      return;
    }
    const type = interaction.options.getString("type");
    info("CMD", "/test", {user:interaction.user.tag, type});
    const u = interaction.user, g = interaction.guild;
    const ph = {user:`<@${u.id}>`,username:u.username,server:g?.name??"Server",moderator:`<@${u.id}>`,reason:"This is a test message.",until:new Date(Date.now()+3_600_000).toUTCString()};
    let components, files = [];
    if      (type==="welcome") { files=[new AttachmentBuilder(CFG.gifPath,{name:"video.gif"})]; components=buildContainer(fill(CFG.welcomeTitle,ph),fill(CFG.welcomeBody,ph),null,true); }
    else if (type==="ban")  components=buildContainer(fill(CFG.banTitle,ph), fill(CFG.banBody,ph),  null);
    else if (type==="kick") components=buildContainer(fill(CFG.kickTitle,ph),fill(CFG.kickBody,ph), null);
    else if (type==="mute") components=buildContainer(fill(CFG.muteTitle,ph),fill(CFG.muteBody,ph), null);
    try {
      await u.send({files, components, flags:MessageFlags.IsComponentsV2});
      info("CMD", "Test DM sent", u.tag);
      await interaction.reply({components:[{type:10,content:`✅  Test **${type}** message sent to your DMs!`}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
    } catch (e) {
      warn("CMD", "DM failed", {user:u.tag, err:e.message});
      await interaction.reply({components:[{type:10,content:"❌  Could not send DM. Please enable DMs from server members."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
    }
    return;
  }

  // ── /pvz ──────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "pvz") {
    info("CMD", "/pvz", {user:interaction.user.tag, channel:interaction.channelId});
    const ex = pvzGames.get(interaction.channelId);
    if (ex && ex.phase !== "game_over" && ex.phase !== "victory") {
      await interaction.reply({components:[{type:10,content:"❌  A game is already running in this channel. Finish it or press **Quit**."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
      return;
    }
    const gs = newLvlSel(interaction.user.id, ex?.unlockedPlants, ex?.unlockedLevels, ex?.levelStars);
    gs.channelId = interaction.channelId;
    pvzGames.set(interaction.channelId, gs);
    try { await sendLvlSel(interaction, gs); }
    catch (e) {
      error("PVZ", "Failed to start game", e.message);
      await interaction.reply({components:[{type:10,content:`❌  Failed to start game: \`${e.message}\``}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
    }
    return;
  }

  // ── /collab ───────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "collab") {
    info("CMD", "/collab", interaction.user.tag);
    await collab.handleCommand(interaction);
    return;
  }

  // ── Buttons ───────────────────────────────────────────────────
  if (interaction.isButton()) {
    const cid = interaction.customId;
    debug("BTN", cid, interaction.user.tag);

    // Collab buttons
    if (collab.isCollabButton(cid)) { await collab.handleButton(interaction); return; }

    // /send composer buttons
    if (["edit_title","edit_body","edit_gif","preview_msg","send_msg","cancel_composer"].includes(cid)) {
      const s = sessions.get(interaction.user.id);
      if (!s) {
        warn("COMP", "No session", interaction.user.tag);
        await interaction.reply({components:[{type:10,content:"❌  Session expired. Please run `/send` again."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
        return;
      }

      if (cid === "edit_title") {
        await interaction.showModal(
          new ModalBuilder().setCustomId("modal_title").setTitle("Edit Title")
            .addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("input")
                .setLabel("Title (markdown, e.g. # My Title)")
                .setStyle(TextInputStyle.Short).setValue(s.title).setRequired(true)
            ))
        );
        return;
      }

      if (cid === "edit_body") {
        await interaction.showModal(
          new ModalBuilder().setCustomId("modal_body").setTitle("Edit Body")
            .addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("input")
                .setLabel("Body (use --- on its own line for divider)")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(s.body.slice(0,4000)).setRequired(true).setMaxLength(4000)
            ))
        );
        return;
      }

      if (cid === "edit_gif") {
        await interaction.showModal(
          new ModalBuilder().setCustomId("modal_gif").setTitle("Edit GIF URL")
            .addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("input")
                .setLabel("GIF URL (type - for no GIF)")
                .setStyle(TextInputStyle.Short).setValue(s.gifUrl||"-").setRequired(true)
            ))
        );
        return;
      }

      if (cid === "preview_msg") {
        info("COMP", "Preview", interaction.user.tag);
        await interaction.reply({
          components: [{type:10,content:"-# Preview — only visible to you"},{type:14,divider:true,spacing:1},...buildContainer(s.title,s.body,s.gifUrl)],
          flags: MessageFlags.IsComponentsV2|MessageFlags.Ephemeral,
        });
        return;
      }

      if (cid === "send_msg") {
        const ch = interaction.guild.channels.cache.get(s.channelId);
        if (!ch) { await interaction.reply({components:[{type:10,content:"❌  Target channel not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        info("COMP", "Sending", {ch:s.channelId, user:interaction.user.tag});

        const norm = (s.body||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        const LIMIT = 3000;

        if (s.title.length + norm.length > LIMIT) {
          // Split into two messages
          let splitIdx = norm.lastIndexOf("\n", Math.floor(norm.length/2));
          if (splitIdx < 0) splitIdx = Math.floor(norm.length/2);
          const p1 = norm.slice(0, splitIdx).trim();
          const p2 = norm.slice(splitIdx).trim();
          warn("COMP", "Message too long — splitting into 2", {total:s.title.length+norm.length});
          await ch.send({components:buildContainer(s.title, p1, null),           flags:MessageFlags.IsComponentsV2});
          await ch.send({components:buildContainer("*(continued)*", p2, s.gifUrl), flags:MessageFlags.IsComponentsV2});
          sessions.delete(interaction.user.id);
          await interaction.update({components:[{type:10,content:"✅  Message was too long and was sent as **2 separate messages**."}],flags:MessageFlags.IsComponentsV2});
        } else {
          await ch.send({components:buildContainer(s.title,s.body,s.gifUrl), flags:MessageFlags.IsComponentsV2});
          sessions.delete(interaction.user.id);
          await interaction.update({components:[{type:10,content:"✅  Message sent successfully!"}],flags:MessageFlags.IsComponentsV2});
        }
        return;
      }

      if (cid === "cancel_composer") {
        info("COMP", "Cancelled", interaction.user.tag);
        sessions.delete(interaction.user.id);
        await interaction.update({components:[{type:10,content:"Composer cancelled."}],flags:MessageFlags.IsComponentsV2});
        return;
      }
    }

    // PvZ buttons
    if (cid.startsWith("pvz_")) {
      const gs = pvzGames.get(interaction.channelId);
      if (!gs) {
        await interaction.reply({components:[{type:10,content:"❌  No active game. Run `/pvz` to start."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
        return;
      }

      if (cid.startsWith("pvz_level_")) {
        const li = parseInt(cid.replace("pvz_level_",""),10);
        if (!gs.unlockedLevels.includes(li)) { await interaction.reply({components:[{type:10,content:"❌  This level is locked."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        info("PVZ","Starting level",{level:li,user:interaction.user.tag});
        const ng = newGame(interaction.channelId, interaction.user.id, li, gs.unlockedPlants, gs.unlockedLevels, gs.levelStars);
        pvzGames.set(interaction.channelId, ng);
        try { await updateGame(ng, interaction, true); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_tut_next") {
        if (gs.tutorialStep < 4) { gs.tutorialStep++; debug("PVZ","Tut step",gs.tutorialStep); }
        else { gs.phase="playing"; gs.tutorialDone=true; spawnWave(gs); info("PVZ","Tutorial complete"); }
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_tut_skip") {
        gs.phase="playing"; gs.tutorialDone=true; spawnWave(gs);
        info("PVZ","Tutorial skipped",interaction.user.tag);
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid.startsWith("pvz_select_")) {
        const pt = cid.replace("pvz_select_","");
        if (gs.selectedPlant === pt) { gs.selectedPlant=null; }
        else {
          const pd = PLANTS[pt];
          if (gs.sun < pd.cost) { await interaction.reply({components:[{type:10,content:`❌  Not enough sun. Need **${pd.cost}**, have **${gs.sun}**.`}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
          gs.selectedPlant=pt; gs.shovelMode=false;
          info("PVZ","Plant selected",{pt,user:interaction.user.tag});
        }
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid.startsWith("pvz_lane_")) {
        const row = parseInt(cid.replace("pvz_lane_",""),10);
        info("PVZ","Lane",{row,shovel:gs.shovelMode,plant:gs.selectedPlant,user:interaction.user.tag});
        if (gs.shovelMode) {
          let removed = false;
          for (let col=8; col>=0; col--) { if (gs.grid[row][col]) { gs.grid[row][col]=null; gs.shovelMode=false; removed=true; break; } }
          if (!removed) { await interaction.reply({components:[{type:10,content:"⛏️  No plant in that lane."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        } else {
          if (!gs.selectedPlant) { await interaction.reply({components:[{type:10,content:"❌  Select a plant first."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
          const err = placePlant(gs, row);
          if (err) { await interaction.reply({components:[{type:10,content:`❌  ${err}`}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        }
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_tick") {
        debug("PVZ","Next turn",{tick:gs.tick,user:interaction.user.tag});
        for (let i=0; i<3; i++) gameTick(gs);
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_shovel") {
        gs.shovelMode=!gs.shovelMode; gs.selectedPlant=null;
        info("PVZ","Shovel toggled",{active:gs.shovelMode,user:interaction.user.tag});
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_nextwave") {
        if (gs.waveActive||gs.zombies.length>0) { await interaction.reply({components:[{type:10,content:"❌  Finish the current wave first."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        info("PVZ","Next wave",{wave:gs.wave+1,user:interaction.user.tag});
        spawnWave(gs);
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_plantpage") {
        const maxP = Math.ceil(gs.availablePlants.length/5)-1;
        gs.plantPage = ((gs.plantPage||0)+1)%(maxP+1);
        try { await updateGame(gs, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_restart") {
        info("PVZ","Restart",{level:gs.level,user:interaction.user.tag});
        const ng = newGame(interaction.channelId, interaction.user.id, gs.level, gs.unlockedPlants, gs.unlockedLevels, gs.levelStars);
        ng.phase="playing"; ng.tutorialDone=true; spawnWave(ng);
        pvzGames.set(interaction.channelId, ng);
        try { await updateGame(ng, interaction); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_lvlselect") {
        info("PVZ","Level select",interaction.user.tag);
        const ls = newLvlSel(interaction.user.id, gs.unlockedPlants, gs.unlockedLevels, gs.levelStars);
        ls.channelId = interaction.channelId;
        pvzGames.set(interaction.channelId, ls);
        try {
          const buf = renderPvz(ls);
          const att = new AttachmentBuilder(buf,{name:"game.png"});
          await interaction.update({files:[att],components:buildPvzUI(ls),flags:MessageFlags.IsComponentsV2});
        } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_nextlevel") {
        const ni = gs.level+1;
        if (ni >= LEVELS.length) { await interaction.reply({components:[{type:10,content:"🏆  All levels completed!"}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return; }
        info("PVZ","Next level",{level:ni,user:interaction.user.tag});
        const ng = newGame(interaction.channelId, interaction.user.id, ni, gs.unlockedPlants, gs.unlockedLevels, gs.levelStars);
        pvzGames.set(interaction.channelId, ng);
        try { await updateGame(ng, interaction, true); } catch (e) { error("PVZ","Render error",e.message); }
        return;
      }
      if (cid === "pvz_quit") {
        info("PVZ","Quit",interaction.user.tag);
        pvzGames.delete(interaction.channelId);
        await interaction.update({files:[],components:[{type:17,components:[{type:10,content:"## Game Ended\nRun `/pvz` again whenever you want to play!"}]}],flags:MessageFlags.IsComponentsV2});
        return;
      }
      if (cid.startsWith("pvz_noop")||cid==="pvz_suninfo"||cid==="pvz_sun2") { await interaction.deferUpdate(); return; }
    }
  }

  // ── Modal Submissions ─────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const cid = interaction.customId;
    debug("MOD", cid, interaction.user.tag);

    if (collab.isCollabModal(cid)) { await collab.handleModal(interaction); return; }

    // /send modals
    const s = sessions.get(interaction.user.id);
    if (!s) {
      warn("COMP","No session for modal",interaction.user.tag);
      await interaction.reply({components:[{type:10,content:"❌  Session expired. Please run `/send` again."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
      return;
    }
    const val = interaction.fields.getTextInputValue("input");
    if (cid==="modal_title") { s.title=val;  info("COMP","Title updated",{len:val.length}); }
    if (cid==="modal_body")  { s.body=val;   info("COMP","Body updated", {len:val.length}); }
    if (cid==="modal_gif")   { s.gifUrl=val; info("COMP","GIF updated",  val); }
    sessions.set(interaction.user.id, s);
    await interaction.deferUpdate();
    await interaction.editReply({components:buildEditor(s), flags:MessageFlags.IsComponentsV2});
  }
});

// ── Moderation DMs ────────────────────────────────────────────────
client.on("guildBanAdd", async (ban) => {
  const {user, guild} = ban;
  info("MOD","Ban",{user:user.tag,guild:guild.name});
  let mod="Server moderation", reason="No reason provided";
  try {
    const logs  = await guild.fetchAuditLogs({type:AuditLogEvent.MemberBanAdd,limit:1});
    const entry = logs.entries.first();
    if (entry && entry.targetId===user.id) { mod=`<@${entry.executorId}>`; reason=entry.reason??reason; }
    debug("MOD","Audit resolved",{mod,reason});
  } catch (e) { warn("MOD","Audit logs unavailable",e.message); }
  const d = {user:`<@${user.id}>`,username:user.username,server:guild.name,moderator:mod,reason};
  try {
    await user.send({components:buildContainer(fill(CFG.banTitle,d),fill(CFG.banBody,d),null),flags:MessageFlags.IsComponentsV2});
    info("MOD","Ban DM sent",user.tag);
  } catch (e) { warn("MOD","Could not DM banned user",{user:user.tag,err:e.message}); }
});

client.on("guildMemberUpdate", async (old, nw) => {
  const oldT = old.communicationDisabledUntilTimestamp ?? null;
  const newT = nw.communicationDisabledUntilTimestamp  ?? null;
  if (oldT || !newT) return;
  info("MOD","Timeout applied",nw.user.tag);
  let mod="Server moderation", reason="No reason provided";
  try {
    const logs  = await nw.guild.fetchAuditLogs({limit:5});
    const entry = logs.entries.find(e=>e.targetId===nw.id);
    if (entry) { mod=`<@${entry.executorId}>`; reason=entry.reason??reason; }
  } catch (e) { warn("MOD","Audit logs unavailable",e.message); }
  const until = new Date(newT).toUTCString();
  const d = {user:`<@${nw.id}>`,username:nw.user.username,server:nw.guild.name,moderator:mod,reason,until};
  try {
    await nw.send({components:buildContainer(fill(CFG.muteTitle,d),fill(CFG.muteBody,d),null),flags:MessageFlags.IsComponentsV2});
    info("MOD","Mute DM sent",nw.user.tag);
  } catch (e) { warn("MOD","Could not DM muted user",{user:nw.user.tag,err:e.message}); }
});

client.on("guildMemberRemove", async (member) => {
  try {
    const logs  = await member.guild.fetchAuditLogs({type:AuditLogEvent.MemberKick,limit:5});
    const entry = logs.entries.find(e=>e.targetId===member.id && Date.now()-e.createdTimestamp<10_000);
    if (!entry) return;
    info("MOD","Kick",member.user.tag);
    const d = {user:`<@${member.id}>`,username:member.user.username,server:member.guild.name,moderator:`<@${entry.executorId}>`,reason:entry.reason??"No reason provided"};
    try {
      await member.send({components:buildContainer(fill(CFG.kickTitle,d),fill(CFG.kickBody,d),null),flags:MessageFlags.IsComponentsV2});
      info("MOD","Kick DM sent",member.user.tag);
    } catch (e) { warn("MOD","Could not DM kicked user",{user:member.user.tag,err:e.message}); }
  } catch (e) { warn("MOD","Kick audit logs unavailable",e.message); }
});

// ── Welcome Message ───────────────────────────────────────────────
client.on("guildMemberAdd", async (member) => {
  info("WELCOME","Member joined",{user:member.user.tag,guild:member.guild.name});
  const channel = member.guild.channels.cache.get(CFG.welcomeChannelId);
  if (!channel) { error("WELCOME","Channel not found",CFG.welcomeChannelId); return; }
  const data = {user:`<@${member.id}>`,username:member.user.username,server:member.guild.name};
  const att = new AttachmentBuilder(CFG.gifPath, {name:"video.gif"});
  try {
    await channel.send({
      files:[att],
      components:buildContainer(fill(CFG.welcomeTitle,data),fill(CFG.welcomeBody,data),null,true),
      flags:MessageFlags.IsComponentsV2,
    });
    info("WELCOME","Sent",member.user.tag);
  } catch (e) { error("WELCOME","Failed to send welcome message",e.message); }
});

// ── Start ─────────────────────────────────────────────────────────
if (!CFG.token) { error("BOT","DISCORD_TOKEN is not set."); process.exit(1); }

process.on("unhandledRejection", e => error("PROC","Unhandled rejection", e?.message||String(e)));
process.on("uncaughtException",  e => error("PROC","Uncaught exception",  e?.message||String(e)));

info("BOT","Starting...");
client.login(CFG.token).catch(e => { error("BOT","Login failed",e.message); process.exit(1); });
