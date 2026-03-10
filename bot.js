// ════════════════════════════════════════════════════════════════════════
//  bot.js  ·  PART 1 OF 2
//  Paste bot_part2.js directly after this file to get the complete bot.
// ════════════════════════════════════════════════════════════════════════
require("dotenv").config();
const {
  Client, GatewayIntentBits, MessageFlags, AttachmentBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  AuditLogEvent, Events,
} = require("discord.js");
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION  ← edit only this block
// ═══════════════════════════════════════════════════════════════════════
const CONFIG = {
  token:    process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  welcomeChannelId: "1474284438312456252",
  gifPath:          path.join(__dirname, "video.gif"),
  defaultGifUrl:    "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/video.gif",
  moderatorRoleId:  "1470984903465238578",

  welcomeTitle: "# Welcome, {user}!",
  welcomeBody: [
    "Welcome, {user}!",
    "",
    "Welcome to the server, please look at our <#1470989289708847105> first, to ensure you have the best experience!",
    "If you have any questions or need help, feel free to reach out to our team at any time.",
    "---",
    "Feel free to say hi to people, explore the channels,",
    "and meet new people! ♥️",
    "",
    "We wish you a lot of fun and a great time with us! 🎉",
    "",
    "*– Cream Team*",
  ].join("\n"),

  banTitle:  "# 🔨 You were banned from {server}",
  banBody: [
    "Hello **{username}**,",
    "",
    "You have been permanently banned from **{server}**.",
    "---",
    "**Reason:** (Look at Dyno's message to see the reason)",
    "**Moderator:** {moderator}",
    "---",
    "If you believe this is a mistake, please appeal here: https://appeal.gg/TVku2Yhtgw",
  ].join("\n"),

  kickTitle: "# 👢 You were kicked from {server}",
  kickBody: [
    "Hey **{username}**,",
    "",
    "You were kicked from **{server}**.",
    "---",
    "**Reason:** (Look at Dyno's message to see the reason)",
    "**Moderator:** {moderator}",
    "---",
    "You may rejoin the server if the link is still active.",
  ].join("\n"),

  muteTitle: "# 🔇 You were timed out in {server}",
  muteBody: [
    "Hey **{username}**,",
    "",
    "You have been timed out (muted) in **{server}**.",
    "---",
    "**Reason:** (Look at Dyno's message to see the reason)",
    "**Moderator:** {moderator}",
    "**Until:** {until}",
    "---",
    "Please follow the server rules to avoid further action.",
  ].join("\n"),
};

// ═══════════════════════════════════════════════════════════════════════
//  PVZ GAME DATA
// ═══════════════════════════════════════════════════════════════════════
const PVZ_PLANTS = {
  peashooter:    { name:"Peashooter",      cost:100, hp:300,  emoji:"🌱", shootRate:3,  dmg:20,  projType:"pea",   desc:"Shoots peas at zombies" },
  sunflower:     { name:"Sunflower",       cost:50,  hp:300,  emoji:"🌻", sunRate:24,   sunAmt:25, desc:"Produces sun over time" },
  wallnut:       { name:"Wall-nut",        cost:50,  hp:4000, emoji:"🥜", desc:"Blocks zombies with high HP" },
  cherrybomb:    { name:"Cherry Bomb",     cost:150, hp:300,  emoji:"🍒", instant:true, aoe:true, aoeDmg:1800, desc:"Explodes in 3×3 area" },
  potatomine:    { name:"Potato Mine",     cost:25,  hp:300,  emoji:"🥔", mine:true, mineDmg:1800, armDelay:15, desc:"Arms then detonates on contact" },
  snowpea:       { name:"Snow Pea",        cost:175, hp:300,  emoji:"❄️", shootRate:3,  dmg:20, projType:"snow", slow:true, desc:"Slows zombies with cold" },
  chomper:       { name:"Chomper",         cost:150, hp:300,  emoji:"👾", chomp:true, chompDmg:9999, rechargeTicks:42, desc:"Chews one zombie whole" },
  repeater:      { name:"Repeater",        cost:200, hp:300,  emoji:"🌿", shootRate:3, dmg:20, projType:"pea", doubleShot:true, desc:"Shoots two peas" },
  puffshroom:    { name:"Puff-shroom",     cost:0,   hp:300,  emoji:"🍄", shootRate:4, dmg:20, projType:"pea", lifetime:120, desc:"Free but temporary" },
  sunshroom:     { name:"Sun-shroom",      cost:25,  hp:300,  emoji:"☀️", sunRate:24,  sunAmt:15, growTicks:360, desc:"Grows into better sunflower" },
  fumeshroom:    { name:"Fume-shroom",     cost:75,  hp:300,  emoji:"💨", fume:true, fumeDmg:20, fumeRate:3, desc:"Fumes hit all zombies in row" },
  scaredy:       { name:"Scaredy-shroom",  cost:25,  hp:300,  emoji:"😱", shootRate:3, dmg:20, projType:"pea", hideRange:3, desc:"Hides when zombies get close" },
  iceshroom:     { name:"Ice-shroom",      cost:75,  hp:300,  emoji:"🧊", instant:true, freeze:true, freezeTicks:30, desc:"Freezes all zombies briefly" },
  doomshroom:    { name:"Doom-shroom",     cost:125, hp:300,  emoji:"💀", instant:true, globalAoe:true, aoeDmg:1800, desc:"Massive AoE explosion" },
  squash:        { name:"Squash",          cost:50,  hp:300,  emoji:"🟩", instant:true, squash:true, squashDmg:9999, desc:"Jumps and crushes a zombie" },
  threepeater:   { name:"Threepeater",     cost:325, hp:300,  emoji:"🌾", shootRate:3, dmg:20, projType:"pea", threeRow:true, desc:"Shoots into three lanes" },
  torchwood:     { name:"Torchwood",       cost:175, hp:600,  emoji:"🔥", torchwood:true, desc:"Turns peas into fireballs" },
  twinsunflower: { name:"Twin Sunflower",  cost:150, hp:300,  emoji:"🌼", sunRate:24,  sunAmt:50, desc:"Produces double sun" },
  tallnut:       { name:"Tall-nut",        cost:125, hp:8000, emoji:"🧱", desc:"Very tall, blocks vaulters" },
  cactus:        { name:"Cactus",          cost:125, hp:400,  emoji:"🌵", shootRate:3, dmg:20, projType:"spike", desc:"Attacks ground and air zombies" },
};

const PVZ_ZOMBIES = {
  regular:    { name:"Zombie",        hp:100,  speed:0.15, dmg:2, emoji:"🧟" },
  cone:       { name:"Conehead",       hp:280,  speed:0.15, dmg:2, emoji:"🧢" },
  bucket:     { name:"Buckethead",     hp:650,  speed:0.15, dmg:2, emoji:"🪣" },
  flag:       { name:"Flag Zombie",    hp:100,  speed:0.2,  dmg:2, emoji:"🚩" },
  polevault:  { name:"Pole Vaulting",  hp:100,  speed:0.3,  dmg:2, emoji:"🏌️" },
  newspaper:  { name:"Newspaper",      hp:150,  speed:0.15, dmg:2, emoji:"📰" },
  football:   { name:"Football",       hp:800,  speed:0.2,  dmg:4, emoji:"🏈" },
  dancing:    { name:"Dancing",        hp:500,  speed:0.2,  dmg:2, emoji:"🕺" },
  balloon:    { name:"Balloon",        hp:100,  speed:0.25, dmg:2, emoji:"🎈", air:true },
  digger:     { name:"Digger",         hp:300,  speed:0.15, dmg:2, emoji:"⛏️", underground:true },
  gargantuar: { name:"Gargantuar",     hp:3000, speed:0.08, dmg:20,emoji:"💪" },
  imp:        { name:"Imp",            hp:50,   speed:0.4,  dmg:2, emoji:"👹" },
};

// Levels: each defines atmosphere, wave definitions, starting sun, and which plants unlock on completion
const PVZ_LEVELS = [
  {
    name: "Day 1 – Sunny Meadows", atmosphere: "day",   startSun: 150, maxWaves: 3,
    unlockOnWin: ["snowpea","repeater"],
    waves: [
      [{ type:"regular",count:3,rows:[0,2,4] }],
      [{ type:"regular",count:3,rows:[0,1,3] },{ type:"cone",count:1,rows:[2] }],
      [{ type:"cone",count:2,rows:[1,3] },{ type:"regular",count:3,rows:[0,2,4] },{ type:"flag",count:1,rows:[0] }],
    ],
  },
  {
    name: "Night 2 – Moonlit Garden", atmosphere: "night", startSun: 75, maxWaves: 4,
    unlockOnWin: ["chomper","fumeshroom"],
    waves: [
      [{ type:"regular",count:4,rows:[0,1,2,3] }],
      [{ type:"cone",count:2,rows:[0,4] },{ type:"regular",count:3,rows:[1,2,3] }],
      [{ type:"bucket",count:1,rows:[2] },{ type:"cone",count:2,rows:[0,4] },{ type:"regular",count:3,rows:[1,3,2] }],
      [{ type:"bucket",count:2,rows:[1,3] },{ type:"flag",count:1,rows:[0] },{ type:"regular",count:4,rows:[0,2,4,1] }],
    ],
  },
  {
    name: "Pool 3 – Watery Depths", atmosphere: "pool", startSun: 150, maxWaves: 5,
    unlockOnWin: ["iceshroom","squash"],
    waves: [
      [{ type:"regular",count:4,rows:[0,1,3,4] }],
      [{ type:"cone",count:3,rows:[1,2,3] },{ type:"regular",count:2,rows:[0,4] }],
      [{ type:"bucket",count:2,rows:[0,4] },{ type:"balloon",count:2,rows:[1,3] },{ type:"regular",count:2,rows:[2,2] }],
      [{ type:"football",count:1,rows:[2] },{ type:"cone",count:3,rows:[0,2,4] },{ type:"regular",count:3,rows:[1,3,1] }],
      [{ type:"football",count:2,rows:[1,3] },{ type:"bucket",count:2,rows:[0,4] },{ type:"flag",count:1,rows:[2] },{ type:"regular",count:4,rows:[0,1,2,3] }],
    ],
  },
  {
    name: "Fog 4 – Misty Cemetery", atmosphere: "fog", startSun: 100, maxWaves: 5,
    unlockOnWin: ["doomshroom","threepeater"],
    waves: [
      [{ type:"digger",count:2,rows:[1,3] },{ type:"regular",count:3,rows:[0,2,4] }],
      [{ type:"newspaper",count:3,rows:[0,2,4] },{ type:"cone",count:2,rows:[1,3] }],
      [{ type:"digger",count:2,rows:[0,4] },{ type:"football",count:1,rows:[2] },{ type:"bucket",count:2,rows:[1,3] }],
      [{ type:"dancing",count:2,rows:[1,3] },{ type:"bucket",count:2,rows:[0,4] },{ type:"cone",count:3,rows:[0,2,4] }],
      [{ type:"gargantuar",count:1,rows:[2] },{ type:"football",count:2,rows:[1,3] },{ type:"flag",count:1,rows:[0] },{ type:"regular",count:5,rows:[0,1,2,3,4] }],
    ],
  },
  {
    name: "Roof 5 – Final Stand", atmosphere: "roof", startSun: 125, maxWaves: 6,
    unlockOnWin: ["torchwood","twinsunflower"],
    waves: [
      [{ type:"football",count:2,rows:[1,3] },{ type:"regular",count:3,rows:[0,2,4] }],
      [{ type:"gargantuar",count:1,rows:[2] },{ type:"bucket",count:2,rows:[0,4] },{ type:"cone",count:2,rows:[1,3] }],
      [{ type:"dancing",count:2,rows:[0,4] },{ type:"football",count:2,rows:[1,3] },{ type:"digger",count:2,rows:[0,4] }],
      [{ type:"gargantuar",count:2,rows:[1,3] },{ type:"football",count:2,rows:[0,4] },{ type:"bucket",count:3,rows:[0,2,4] }],
      [{ type:"imp",count:6,rows:[0,1,2,3,4,2] },{ type:"gargantuar",count:2,rows:[0,4] },{ type:"dancing",count:2,rows:[1,3] }],
      [{ type:"gargantuar",count:3,rows:[0,2,4] },{ type:"football",count:2,rows:[1,3] },{ type:"flag",count:1,rows:[2] },{ type:"regular",count:5,rows:[0,1,2,3,4] }],
    ],
  },
];

// Starting plant loadout per level
const PVZ_START_PLANTS = {
  0: ["peashooter","sunflower","wallnut"],
  1: ["peashooter","sunflower","wallnut","puffshroom","potatomine"],
  2: ["peashooter","sunflower","wallnut","snowpea","repeater","potatomine"],
  3: ["peashooter","sunflower","wallnut","snowpea","chomper","fumeshroom","iceshroom"],
  4: ["peashooter","sunflower","wallnut","snowpea","repeater","threepeater","doomshroom","squash","torchwood"],
};

// ═══════════════════════════════════════════════════════════════════════
//  GENERAL HELPERS
// ═══════════════════════════════════════════════════════════════════════
function fill(str, data = {}) {
  let out = str;
  for (const [k, v] of Object.entries(data)) out = out.replaceAll(`{${k}}`, v ?? "—");
  return out;
}

function buildContainer(title, body, gifUrl, useAttachment = false) {
  const inner = [];
  const safeTitle = (title || "").trim() || "​";
  inner.push({ type: 10, content: safeTitle });
  inner.push({ type: 14, divider: true, spacing: 1 });

  // Normalize line endings, then split on --- lines
  const normalizedBody = (body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalizedBody.split(/\n---\n|\n---$|^---\n/m);
  chunks.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed.length > 0) inner.push({ type: 10, content: trimmed });
    if (i < chunks.length - 1) inner.push({ type: 14, divider: true, spacing: 1 });
  });

  const hasBody = inner.some((c, i) => i > 1 && c.type === 10);
  if (!hasBody) inner.push({ type: 10, content: "​" });

  const skipGif = !gifUrl || gifUrl.trim() === "-" || gifUrl.trim() === "";
  if (!skipGif || useAttachment) {
    inner.push({ type: 14, divider: false, spacing: 2 });
    inner.push({ type: 12, items: [{ media: { url: useAttachment ? "attachment://video.gif" : gifUrl } }] });
  }
  return [{ type: 17, components: inner }];
}

function buildEditor(session) {
  const t = session.title.length > 80  ? session.title.slice(0, 80)  + "…" : session.title;
  const b = session.body.length  > 120 ? session.body.slice(0, 120)  + "…" : session.body;
  return [
    { type: 10, content: "## 📝  Message Composer" },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: `**Title**\n${t}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**Body**\n${b}` },
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `**GIF URL**\n${session.gifUrl || "(none)"}` },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: "-# 💡 Use `---` on its own line for a separator. Set GIF URL to `-` for no GIF." },
    { type: 1, components: [
      { type: 2, style: 1, label: "✏️ Title",   custom_id: "edit_title" },
      { type: 2, style: 1, label: "✏️ Body",    custom_id: "edit_body"  },
      { type: 2, style: 1, label: "✏️ GIF URL", custom_id: "edit_gif"   },
    ]},
    { type: 1, components: [
      { type: 2, style: 2, label: "👁 Preview", custom_id: "preview_msg"     },
      { type: 2, style: 3, label: "✅ Send",    custom_id: "send_msg"        },
      { type: 2, style: 4, label: "✖ Cancel",  custom_id: "cancel_composer" },
    ]},
  ];
}

const sessions = new Map(); // userId → composer session

// ═══════════════════════════════════════════════════════════════════════
//  PVZ GAME ENGINE
// ═══════════════════════════════════════════════════════════════════════
const pvzGames = new Map(); // channelId → gameState
let pvzIdCounter = 0;

function mkId() { return ++pvzIdCounter; }

function newGame(channelId, userId, levelIdx, unlockedPlants, unlockedLevels, levelStars) {
  const lvl = PVZ_LEVELS[levelIdx];
  return {
    channelId, startedBy: userId,
    phase: "tutorial",      // tutorial → playing → game_over/victory
    level: levelIdx,
    atmosphere: lvl.atmosphere,
    wave: 0, maxWaves: lvl.maxWaves,
    sun: lvl.startSun,
    tick: 0,
    grid: Array.from({ length: 5 }, () => Array(9).fill(null)),
    zombies: [], projectiles: [],
    selectedPlant: null,
    availablePlants: [...(PVZ_START_PLANTS[levelIdx] || PVZ_START_PLANTS[0])],
    plantPage: 0,
    unlockedPlants: unlockedPlants || ["peashooter","sunflower","wallnut"],
    unlockedLevels: unlockedLevels || [0],
    levelStars:     levelStars || {},
    tutorialStep: 0, tutorialDone: false,
    waveQueue: [],
    waveActive: false,
    messageId: null,
    interactionToken: null,
    appId: null,
    shovelMode: false,
  };
}

function newLevelSelectState(userId, unlockedPlants, unlockedLevels, levelStars) {
  return {
    phase: "level_select",
    startedBy: userId,
    unlockedPlants: unlockedPlants || ["peashooter","sunflower","wallnut"],
    unlockedLevels: unlockedLevels || [0],
    levelStars:     levelStars || {},
    messageId: null, interactionToken: null, appId: null,
    channelId: null,
  };
}

// Render game image via Python/Pillow, returns Buffer
async function renderPvz(state) {
  const tmpPath = path.join(os.tmpdir(), `pvz_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  return new Promise((resolve, reject) => {
    const py = spawn("python3", [path.join(__dirname, "pvz_render.py"), tmpPath]);
    let stderr = "";
    py.stderr.on("data", d => { stderr += d.toString(); });
    py.stdin.write(JSON.stringify(state));
    py.stdin.end();
    py.on("close", code => {
      if (code !== 0) { reject(new Error(`pvz_render.py exited ${code}: ${stderr}`)); return; }
      try {
        const buf = fs.readFileSync(tmpPath);
        fs.unlink(tmpPath, () => {});
        resolve(buf);
      } catch (e) { reject(e); }
    });
    py.on("error", reject);
  });
}

// ── Game tick (one turn of the game) ──────────────────────────────────
function gameTick(gs) {
  if (gs.phase !== "playing") return;
  gs.tick++;

  // 1. Ambient sun every 10 ticks
  if (gs.tick % 10 === 0) gs.sun += 25;

  // 2. Plant actions
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = gs.grid[row][col];
      if (!cell) continue;
      const pd = PVZ_PLANTS[cell.type];
      if (!pd) continue;

      // Sun production
      if (pd.sunRate && gs.tick % pd.sunRate === 0) {
        let amt = pd.sunAmt;
        if (cell.type === "sunshroom" && gs.tick - (cell.plantedAt||0) > (pd.growTicks||360)) amt = 50;
        gs.sun += amt;
      }

      // Puff-shroom lifetime
      if (pd.lifetime && gs.tick - (cell.plantedAt||0) >= pd.lifetime) {
        gs.grid[row][col] = null; continue;
      }

      // Chomper recharge
      if (cell.chompCooldown > 0) { cell.chompCooldown--; continue; }

      // Get zombies in row (sorted by distance, closest first)
      const rowZombies = gs.zombies
        .filter(z => z.row === row && !z.dead && !z.underground)
        .sort((a, b) => a.x - b.x);

      if (rowZombies.length === 0) continue;
      const nearestX = rowZombies[0].x;

      // Scaredy-shroom hides when zombie within range
      if (cell.type === "scaredy" && nearestX < col + (pd.hideRange||3)) continue;

      // Shooting plants
      if (pd.shootRate && gs.tick % pd.shootRate === 0) {
        if (nearestX > col) { // zombie is to the right of plant (hasn't reached it yet)
          const rows = pd.threeRow
            ? [row-1, row, row+1].filter(r => r>=0 && r<5)
            : [row];
          rows.forEach(r => {
            gs.projectiles.push({ id: mkId(), row: r, x: col + 1.0, type: pd.projType||"pea", dmg: pd.dmg||20, slow: pd.slow||false });
            if (pd.doubleShot) gs.projectiles.push({ id: mkId(), row: r, x: col + 0.6, type: pd.projType||"pea", dmg: pd.dmg||20, slow: pd.slow||false });
          });
        }
      }

      // Fume-shroom
      if (pd.fume && gs.tick % (pd.fumeRate||3) === 0) {
        gs.zombies.filter(z => z.row === row && !z.dead).forEach(z => {
          z.hp -= pd.fumeDmg||20;
          if (z.hp <= 0) z.dead = true;
        });
      }

      // Chomper
      if (pd.chomp && nearestX <= col + 1.5 && nearestX > col) {
        rowZombies[0].dead = true;
        cell.chompCooldown = pd.rechargeTicks||42;
      }

      // Potato mine (arms after delay)
      if (pd.mine) {
        if (!cell.armed) {
          if (!cell.armTick) cell.armTick = gs.tick;
          if (gs.tick - cell.armTick >= (pd.armDelay||15)) cell.armed = true;
        }
        if (cell.armed && nearestX <= col + 0.5) {
          const splash = gs.zombies.filter(z => z.row === row && Math.abs(z.x - col) < 1.5);
          splash.forEach(z => { z.hp -= pd.mineDmg||1800; if(z.hp<=0) z.dead=true; });
          gs.grid[row][col] = null;
        }
      }
    }
  }

  // 3. Move projectiles, check hits, check torchwood
  gs.projectiles = gs.projectiles.filter(p => p.x <= 9.5);
  gs.projectiles.forEach(p => {
    p.x += 1.0;
    // Torchwood upgrade
    const col = Math.floor(p.x);
    if (col >= 0 && col < 9) {
      const cell = gs.grid[p.row]?.[col];
      if (cell?.type === "torchwood" && p.type === "pea") { p.type = "fire"; p.dmg = (p.dmg||20)*2; }
    }
    // Hit zombies
    gs.zombies.filter(z => !z.dead && z.row === p.row && Math.abs(z.x - p.x) < 0.8 && !z.underground).forEach(z => {
      z.hp -= p.dmg;
      if (p.slow) z.slowTicks = 10;
      if (z.hp <= 0) z.dead = true;
      p.hit = true;
    });
  });
  gs.projectiles = gs.projectiles.filter(p => !p.hit);

  // 4. Move zombies
  gs.zombies.filter(z => !z.dead).forEach(z => {
    const spd = (z.slowTicks > 0) ? PVZ_ZOMBIES[z.type].speed * 0.5 : PVZ_ZOMBIES[z.type].speed;
    if (!z.frozen) z.x -= spd;
    if (z.slowTicks > 0) z.slowTicks--;
    if (z.frozenTicks > 0) { z.frozenTicks--; if(z.frozenTicks===0) z.frozen=false; }

    // Zombie attacks plant in its cell
    const col = Math.max(0, Math.floor(z.x));
    const plant = gs.grid[z.row]?.[col];
    if (plant && z.x <= col + 0.8) {
      plant.hp -= PVZ_ZOMBIES[z.type].dmg;
      z.x = col + 0.7; // stall
      if (plant.hp <= 0) gs.grid[z.row][col] = null;
    }
  });

  // 5. Spawn next zombie from waveQueue
  if (gs.waveQueue.length > 0 && gs.tick % 8 === 0) {
    const zDef = gs.waveQueue.shift();
    gs.zombies.push({
      id: mkId(), type: zDef.type, row: zDef.row,
      x: 8.8, hp: PVZ_ZOMBIES[zDef.type].hp,
      maxHp: PVZ_ZOMBIES[zDef.type].hp,
      dead: false, frozen: false, frozenTicks: 0, slowTicks: 0,
      underground: zDef.type === "digger",
    });
  }

  // 6. Digger zombies surface when past col 0
  gs.zombies.filter(z => z.underground && z.x <= 1).forEach(z => { z.underground = false; });

  // 7. Remove dead zombies
  gs.zombies = gs.zombies.filter(z => !z.dead);

  // 8. Check win/lose
  if (gs.zombies.some(z => z.x <= -0.2)) {
    gs.phase = "game_over"; return;
  }
  if (gs.waveQueue.length === 0 && gs.zombies.length === 0) {
    if (gs.wave >= gs.maxWaves) {
      gs.phase = "victory";
      const levelDef = PVZ_LEVELS[gs.level];
      if (levelDef.unlockOnWin) {
        levelDef.unlockOnWin.forEach(p => {
          if (!gs.unlockedPlants.includes(p)) gs.unlockedPlants.push(p);
        });
      }
      const nextLevel = gs.level + 1;
      if (nextLevel < PVZ_LEVELS.length && !gs.unlockedLevels.includes(nextLevel)) {
        gs.unlockedLevels.push(nextLevel);
      }
      if (!gs.levelStars[gs.level] || gs.levelStars[gs.level] < 3) {
        gs.levelStars[gs.level] = Math.min(3, (gs.levelStars[gs.level]||0)+1);
      }
    } else {
      gs.waveActive = false; // between waves — player can shop
    }
  }
}

function spawnWave(gs) {
  const waveDef = PVZ_LEVELS[gs.level].waves[gs.wave];
  if (!waveDef) return;
  waveDef.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      gs.waveQueue.push({ type: group.type, row: group.rows[i % group.rows.length] });
    }
  });
  gs.wave++;
  gs.waveActive = true;
}

// ── Build Discord components for each game phase ───────────────────────
function buildPvzComponents(gs) {
  const phase = gs.phase;

  if (phase === "level_select") {
    const lvlBtns = PVZ_LEVELS.map((l, i) => ({
      type: 2,
      style: gs.unlockedLevels.includes(i) ? 1 : 2,
      label: gs.unlockedLevels.includes(i) ? `${i+1}. ${l.name.split("–")[0].trim()}` : `🔒 Level ${i+1}`,
      custom_id: `pvz_level_${i}`,
      disabled: !gs.unlockedLevels.includes(i),
    }));
    return [
      { type: 17, components: [
        { type: 10, content: "## 🌻  Plants vs. Zombies\nSelect a level to begin!" },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: PVZ_LEVELS.map((l,i) => {
          const locked = !gs.unlockedLevels.includes(i);
          const stars  = gs.levelStars[i] ? "⭐".repeat(gs.levelStars[i]) : "☆☆☆";
          return `${locked?"🔒":"🌱"} **Level ${i+1}** – ${l.name}  ${locked?"*(locked)*":`[${stars}] – ${l.maxWaves} waves`}`;
        }).join("\n") },
      ]},
      { type: 1, components: lvlBtns.slice(0,5) },
    ];
  }

  if (phase === "tutorial") {
    const steps = [
      "**☀️ Sun** is your currency. Sunflowers make more of it. Collect sun to buy plants!",
      "**🌱 Select a plant** from the row below, then press a **Lane** button to place it.",
      "**🧟 Zombies** walk from right to left. Don't let them reach the left edge!",
      "**⚡ Next Turn** advances the game: plants shoot and zombies move each tick.",
      "**🏪 Shop** appears between waves — use it to unlock new plants with your sun!",
    ];
    return [
      { type: 17, components: [
        { type: 10, content: `## 📖  Tutorial  (Step ${gs.tutorialStep+1}/5)` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: steps[gs.tutorialStep] || steps[0] },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: "-# Use the buttons below to navigate." },
      ]},
      { type: 1, components: [
        { type: 2, style: 1, label: gs.tutorialStep < 4 ? "Next ▶" : "Start Game! 🌻", custom_id: "pvz_tut_next" },
        { type: 2, style: 2, label: "Skip Tutorial",  custom_id: "pvz_tut_skip" },
      ]},
    ];
  }

  if (phase === "playing" || phase === "game_over" || phase === "victory") {
    const plants = gs.availablePlants;
    const page   = gs.plantPage || 0;
    const pageSize = 5;
    const pageItems = plants.slice(page * pageSize, (page+1) * pageSize);
    const plantBtns = pageItems.map(pt => {
      const pd = PVZ_PLANTS[pt];
      const canAfford = gs.sun >= pd.cost;
      return {
        type: 2,
        style: gs.selectedPlant === pt ? 3 : (canAfford ? 1 : 2),
        label: `${pd.emoji} ${pd.name} ☀️${pd.cost}`,
        custom_id: `pvz_select_${pt}`,
        disabled: !canAfford && gs.selectedPlant !== pt,
      };
    });
    while (plantBtns.length < 5) plantBtns.push({ type:2,style:2,label:" ",custom_id:`pvz_noop_${plantBtns.length}`,disabled:true });

    const laneBtns = [
      { type:2,style:2,label:"Lane 1",custom_id:"pvz_lane_0" },
      { type:2,style:2,label:"Lane 2",custom_id:"pvz_lane_1" },
      { type:2,style:2,label:"Lane 3",custom_id:"pvz_lane_2" },
      { type:2,style:2,label:"Lane 4",custom_id:"pvz_lane_3" },
      { type:2,style:2,label:"Lane 5",custom_id:"pvz_lane_4" },
    ];

    const betweenWaves = !gs.waveActive && gs.zombies.length===0 && gs.wave < gs.maxWaves;
    const actionBtns = [
      { type:2,style:1, label:"⚡ Next Turn",  custom_id:"pvz_tick" },
      { type:2,style:gs.shovelMode?4:2, label:"⛏️ Shovel",   custom_id:"pvz_shovel" },
      betweenWaves
        ? { type:2,style:3, label:"▶ Next Wave", custom_id:"pvz_nextwave" }
        : { type:2,style:2, label:`☀️ ${gs.sun}`, custom_id:"pvz_suninfo", disabled:true },
      plants.length > pageSize
        ? { type:2,style:2, label:`◀▶ Plants p.${page+1}`, custom_id:"pvz_plantpage" }
        : { type:2,style:2, label:`☀️ Sun: ${gs.sun}`, custom_id:"pvz_sun2",disabled:true },
      { type:2,style:4, label:"❌ Quit", custom_id:"pvz_quit" },
    ];

    let infoText = `**Wave ${gs.wave}/${gs.maxWaves}**  ·  ☀️ ${gs.sun} Sun  ·  ${gs.zombies.length} zombie(s) on field`;
    if (betweenWaves) infoText += "\n**Wave cleared!** Open next wave when ready. Visit the Shop first if you like.";
    if (gs.shovelMode)  infoText += "\n⛏️ **Shovel mode** – pick a Lane to dig up the rightmost plant in it.";
    if (gs.selectedPlant) infoText += `\n🌱 **Selected:** ${PVZ_PLANTS[gs.selectedPlant].name} – pick a Lane to plant.`;

    const comps = [
      { type: 17, components: [
        { type: 12, items:[{ media:{ url:"attachment://game.png" } }] },
        { type: 14, divider:true, spacing:1 },
        { type: 10, content: infoText },
      ]},
    ];
    if (phase === "playing") {
      comps.push({ type:1, components: plantBtns });
      comps.push({ type:1, components: laneBtns  });
      comps.push({ type:1, components: actionBtns });
    }
    if (phase === "game_over") {
      comps.push({ type:1, components:[
        { type:2,style:1,label:"🔄 Restart Level", custom_id:"pvz_restart" },
        { type:2,style:2,label:"🏠 Level Select",  custom_id:"pvz_lvlselect" },
      ]});
    }
    if (phase === "victory") {
      const nextIdx = gs.level+1;
      const hasNext = nextIdx < PVZ_LEVELS.length;
      comps.push({ type:1, components:[
        hasNext ? { type:2,style:3,label:"▶ Next Level",   custom_id:"pvz_nextlevel" }
                : { type:2,style:1,label:"🏆 You beat them all!",custom_id:"pvz_noop_win",disabled:true },
        { type:2,style:2,label:"🏠 Level Select", custom_id:"pvz_lvlselect" },
      ]});
    }
    return comps;
  }

  // Fallback
  return [{ type:10, content:"Loading..." }];
}

// ── Send or edit the game message ──────────────────────────────────────
async function updateGameMessage(gs, interaction, isNew = false) {
  const imgBuffer = await renderPvz(gs);
  const attachment = new AttachmentBuilder(imgBuffer, { name: "game.png" });
  const comps = buildPvzComponents(gs);

  if (isNew) {
    const msg = await interaction.reply({
      files: [attachment],
      components: comps,
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    });
    gs.messageId = msg.id;
    gs.interactionToken = interaction.token;
    gs.appId = interaction.applicationId;
  } else {
    await interaction.update({
      files: [attachment],
      components: comps,
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

// ── Send level-select screen (new message) ─────────────────────────────
async function sendLevelSelect(interaction, gs) {
  const imgBuffer = await renderPvz(gs);
  const attachment = new AttachmentBuilder(imgBuffer, { name: "game.png" });
  const comps = buildPvzComponents(gs);
  const msg = await interaction.reply({
    files: [attachment],
    components: comps,
    flags: MessageFlags.IsComponentsV2,
    fetchReply: true,
  });
  gs.messageId  = msg.id;
  gs.channelId  = interaction.channelId;
  gs.interactionToken = interaction.token;
  gs.appId      = interaction.applicationId;
  pvzGames.set(interaction.channelId, gs);
}

// ─── Place a plant in a lane (leftmost empty col) ─────────────────────
function placePlant(gs, row) {
  if (!gs.selectedPlant) return "No plant selected!";
  const pd = PVZ_PLANTS[gs.selectedPlant];
  if (gs.sun < pd.cost) return `Not enough sun! Need ${pd.cost}, have ${gs.sun}.`;

  if (gs.shovelMode) {
    // Shovel: remove rightmost plant in row
    for (let col = 8; col >= 0; col--) {
      if (gs.grid[row][col]) { gs.grid[row][col] = null; gs.shovelMode = false; return null; }
    }
    return "No plant in that lane to dig up.";
  }

  // Find leftmost empty column (plants go left-to-right in columns 0-8)
  for (let col = 0; col < 9; col++) {
    if (!gs.grid[row][col]) {
      gs.sun -= pd.cost;
      gs.grid[row][col] = {
        type: gs.selectedPlant, hp: pd.hp, maxHp: pd.hp,
        plantedAt: gs.tick, armed: false, armTick: null, chompCooldown: 0,
      };
      // Instant-use plants
      if (pd.instant) {
        if (pd.aoe) { // Cherry Bomb / Doom-shroom
          const range = pd.globalAoe ? 99 : 1;
          gs.zombies.forEach(z => {
            if (Math.abs(z.row - row) <= range && Math.abs(z.x - col) <= range+1) {
              z.hp -= pd.aoeDmg; if(z.hp<=0) z.dead=true;
            }
          });
          gs.grid[row][col] = null;
        }
        if (pd.freeze) {
          gs.zombies.forEach(z => { z.frozen=true; z.frozenTicks=pd.freezeTicks||30; });
          gs.grid[row][col] = null;
        }
        if (pd.squash) {
          const target = gs.zombies.filter(z => z.row===row && !z.dead).sort((a,b)=>a.x-b.x)[0];
          if (target) { target.dead=true; }
          gs.grid[row][col] = null;
        }
      }
      gs.selectedPlant = null;
      gs.zombies = gs.zombies.filter(z => !z.dead);
      return null; // success
    }
  }
  return "That lane is full!";
}

// ─────────────────────────────────────────────────────────────────────
// END OF PART 1
// Append bot_part2.js directly below this line.
// ─────────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════
//  bot.js  ·  PART 2 OF 2
//  Paste this directly after bot_part1.js — do NOT add any code between them.
// ════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  DISCORD CLIENT
// ═══════════════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
  ],
});

// ═══════════════════════════════════════════════════════════════════════
//  SLASH COMMAND REGISTRATION
// ═══════════════════════════════════════════════════════════════════════
client.once(Events.ClientReady, async (c) => {
  console.log(`✅  Logged in as ${c.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Compose and send a custom message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("test")
      .setDescription("DM yourself a preview of a message (admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((o) =>
        o.setName("type")
          .setDescription("Which message type to preview")
          .setRequired(true)
          .addChoices(
            { name: "Welcome", value: "welcome" },
            { name: "Ban",     value: "ban"     },
            { name: "Kick",    value: "kick"    },
            { name: "Mute",    value: "mute"    },
          )
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("pvz")
      .setDescription("Start a Plants vs. Zombies game — everyone can see it!")
      .toJSON(),
  ];

  const rest  = new REST({ version: "10" }).setToken(CONFIG.token);
  const appId = CONFIG.clientId || c.user.id;

  try {
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log("✅  Slash commands registered (/send, /test, /pvz)");
  } catch (err) {
    console.error("❌  Failed to register slash commands:", err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  INTERACTION HANDLER
// ═══════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async (interaction) => {

  // ──────────────────────────────────────────────────────────────────
  //  /send  (admin composer)
  // ──────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "send") {
    const session = {
      title:     "# Your Title Here",
      body:      "Write your message body here.\n---\nUse --- on its own line for a separator.",
      gifUrl:    CONFIG.defaultGifUrl,
      channelId: interaction.channelId,
    };
    sessions.set(interaction.user.id, session);

    await interaction.reply({
      components: buildEditor(session),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ──────────────────────────────────────────────────────────────────
  //  /test  (DM preview)
  // ──────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "test") {
    const type = interaction.options.getString("type");
    const u = interaction.user;
    const g = interaction.guild;

    const ph = {
      user:      `<@${u.id}>`,
      username:  u.username,
      server:    g?.name ?? "Server",
      moderator: `<@${u.id}>`,
      reason:    "This is a test message.",
      until:     new Date(Date.now() + 3_600_000).toUTCString(),
    };

    let components, files = [];

    if (type === "welcome") {
      files = [new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" })];
      components = buildContainer(fill(CONFIG.welcomeTitle, ph), fill(CONFIG.welcomeBody, ph), null, true);
    } else if (type === "ban") {
      components = buildContainer(fill(CONFIG.banTitle, ph), fill(CONFIG.banBody, ph), null);
    } else if (type === "kick") {
      components = buildContainer(fill(CONFIG.kickTitle, ph), fill(CONFIG.kickBody, ph), null);
    } else if (type === "mute") {
      components = buildContainer(fill(CONFIG.muteTitle, ph), fill(CONFIG.muteBody, ph), null);
    }

    try {
      await u.send({ files, components, flags: MessageFlags.IsComponentsV2 });
      await interaction.reply({
        components: [{ type: 10, content: `✅  Test **${type}** message sent to your DMs!` }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } catch {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Could not send DM. Please enable DMs from server members." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // ──────────────────────────────────────────────────────────────────
  //  /pvz  — start or resume game
  // ──────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "pvz") {
    const existing = pvzGames.get(interaction.channelId);
    if (existing && existing.phase !== "game_over" && existing.phase !== "victory") {
      await interaction.reply({
        components: [{ type: 10, content: "❌  A game is already running in this channel! Finish it first or press ❌ Quit." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    // Load persistent unlock data from existing game if present
    const unlockedPlants = existing?.unlockedPlants ?? ["peashooter","sunflower","wallnut"];
    const unlockedLevels = existing?.unlockedLevels ?? [0];
    const levelStars     = existing?.levelStars     ?? {};

    const gs = newLevelSelectState(interaction.user.id, unlockedPlants, unlockedLevels, levelStars);
    gs.channelId = interaction.channelId;
    pvzGames.set(interaction.channelId, gs);

    try {
      await sendLevelSelect(interaction, gs);
    } catch (err) {
      console.error("❌  PvZ render error:", err);
      await interaction.reply({
        components: [{ type: 10, content: `❌  Failed to start game: \`${err.message}\`\nMake sure \`pillow\` is installed: \`pip install pillow\`` }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // ──────────────────────────────────────────────────────────────────
  //  BUTTONS — /send composer
  // ──────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const cid = interaction.customId;

    // ── Composer buttons ────────────────────────────────────────────
    if (["edit_title","edit_body","edit_gif","preview_msg","send_msg","cancel_composer"].includes(cid)) {
      const session = sessions.get(interaction.user.id);
      if (!session) {
        await interaction.reply({
          components: [{ type: 10, content: "❌  Session expired. Run `/send` again." }],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      if (cid === "edit_title") {
        await interaction.showModal(new ModalBuilder().setCustomId("modal_title").setTitle("Edit Title")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input")
              .setLabel("Title (markdown OK, e.g. # Heading)")
              .setStyle(TextInputStyle.Short).setValue(session.title).setRequired(true)
          )));
        return;
      }
      if (cid === "edit_body") {
        await interaction.showModal(new ModalBuilder().setCustomId("modal_body").setTitle("Edit Body")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input")
              .setLabel("Body (use --- alone on a line for divider)")
              .setStyle(TextInputStyle.Paragraph).setValue(session.body).setRequired(true)
          )));
        return;
      }
      if (cid === "edit_gif") {
        await interaction.showModal(new ModalBuilder().setCustomId("modal_gif").setTitle("Edit GIF URL")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("input")
              .setLabel("GIF URL  (type - for no GIF)")
              .setStyle(TextInputStyle.Short).setValue(session.gifUrl || "-").setRequired(true)
          )));
        return;
      }
      if (cid === "preview_msg") {
        await interaction.reply({
          components: [
            { type: 10, content: "-# 👁  Preview — only you can see this" },
            { type: 14, divider: true, spacing: 1 },
            ...buildContainer(session.title, session.body, session.gifUrl),
          ],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }
      if (cid === "send_msg") {
        const ch = interaction.guild.channels.cache.get(session.channelId);
        if (!ch) {
          await interaction.reply({
            components: [{ type: 10, content: "❌  Channel not found." }],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return;
        }
        await ch.send({
          components: buildContainer(session.title, session.body, session.gifUrl),
          flags: MessageFlags.IsComponentsV2,
        });
        sessions.delete(interaction.user.id);
        await interaction.update({
          components: [{ type: 10, content: "✅  **Message sent successfully!**" }],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
      if (cid === "cancel_composer") {
        sessions.delete(interaction.user.id);
        await interaction.update({
          components: [{ type: 10, content: "✖  Composer cancelled." }],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
    }

    // ── PvZ buttons ────────────────────────────────────────────────
    if (cid.startsWith("pvz_")) {
      const gs = pvzGames.get(interaction.channelId);
      if (!gs) {
        await interaction.reply({
          components: [{ type: 10, content: "❌  No active game. Run `/pvz` to start one." }],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      // ── Level select ─────────────────────────────────────────────
      if (cid.startsWith("pvz_level_")) {
        const lvlIdx = parseInt(cid.replace("pvz_level_",""), 10);
        if (!gs.unlockedLevels.includes(lvlIdx)) {
          await interaction.reply({
            components: [{ type: 10, content: "🔒  That level is locked! Complete the previous level first." }],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return;
        }
        const newGs = newGame(
          interaction.channelId, interaction.user.id, lvlIdx,
          gs.unlockedPlants, gs.unlockedLevels, gs.levelStars
        );
        pvzGames.set(interaction.channelId, newGs);
        try {
          await updateGameMessage(newGs, interaction, true);
        } catch (err) {
          console.error("PvZ render error:", err);
        }
        return;
      }

      // ── Tutorial navigation ──────────────────────────────────────
      if (cid === "pvz_tut_next") {
        if (gs.tutorialStep < 4) {
          gs.tutorialStep++;
        } else {
          gs.phase = "playing";
          gs.tutorialDone = true;
          spawnWave(gs);
        }
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }
      if (cid === "pvz_tut_skip") {
        gs.phase = "playing";
        gs.tutorialDone = true;
        spawnWave(gs);
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Plant selection ──────────────────────────────────────────
      if (cid.startsWith("pvz_select_")) {
        const plantType = cid.replace("pvz_select_","");
        if (gs.selectedPlant === plantType) {
          gs.selectedPlant = null; // deselect
        } else {
          const pd = PVZ_PLANTS[plantType];
          if (gs.sun < pd.cost) {
            await interaction.reply({
              components: [{ type: 10, content: `☀️  Not enough sun! Need **${pd.cost}**, you have **${gs.sun}**.` }],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
          }
          gs.selectedPlant = plantType;
          gs.shovelMode = false;
        }
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Lane placement ───────────────────────────────────────────
      if (cid.startsWith("pvz_lane_")) {
        const row = parseInt(cid.replace("pvz_lane_",""), 10);
        if (gs.shovelMode) {
          // Shovel: remove rightmost plant in lane
          let removed = false;
          for (let col = 8; col >= 0; col--) {
            if (gs.grid[row][col]) {
              gs.grid[row][col] = null;
              gs.shovelMode = false;
              removed = true;
              break;
            }
          }
          if (!removed) {
            await interaction.reply({
              components: [{ type: 10, content: "⛏️  No plant in that lane to dig up." }],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
          }
        } else {
          if (!gs.selectedPlant) {
            await interaction.reply({
              components: [{ type: 10, content: "🌱  Select a plant first!" }],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
          }
          const err = placePlant(gs, row);
          if (err) {
            await interaction.reply({
              components: [{ type: 10, content: `❌  ${err}` }],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
          }
        }
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Next turn (tick) ─────────────────────────────────────────
      if (cid === "pvz_tick") {
        // Run 3 ticks per button press for pacing
        for (let i = 0; i < 3; i++) gameTick(gs);
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Shovel mode toggle ───────────────────────────────────────
      if (cid === "pvz_shovel") {
        gs.shovelMode = !gs.shovelMode;
        gs.selectedPlant = null;
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Next wave ────────────────────────────────────────────────
      if (cid === "pvz_nextwave") {
        if (gs.waveActive || gs.zombies.length > 0) {
          await interaction.reply({
            components: [{ type: 10, content: "⚔️  Finish the current wave first!" }],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return;
        }
        spawnWave(gs);
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Plant page flip ──────────────────────────────────────────
      if (cid === "pvz_plantpage") {
        const maxPage = Math.ceil(gs.availablePlants.length / 5) - 1;
        gs.plantPage  = ((gs.plantPage || 0) + 1) % (maxPage + 1);
        try { await updateGameMessage(gs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Restart level ────────────────────────────────────────────
      if (cid === "pvz_restart") {
        const newGs = newGame(
          interaction.channelId, interaction.user.id, gs.level,
          gs.unlockedPlants, gs.unlockedLevels, gs.levelStars
        );
        newGs.phase = "playing";
        newGs.tutorialDone = true;
        spawnWave(newGs);
        pvzGames.set(interaction.channelId, newGs);
        try { await updateGameMessage(newGs, interaction); } catch (e) { console.error(e); }
        return;
      }

      // ── Level select (from game over / victory) ──────────────────
      if (cid === "pvz_lvlselect") {
        const lsGs = newLevelSelectState(
          interaction.user.id, gs.unlockedPlants, gs.unlockedLevels, gs.levelStars
        );
        lsGs.channelId = interaction.channelId;
        pvzGames.set(interaction.channelId, lsGs);
        try {
          const imgBuffer  = await renderPvz(lsGs);
          const attachment = new AttachmentBuilder(imgBuffer, { name: "game.png" });
          await interaction.update({
            files:      [attachment],
            components: buildPvzComponents(lsGs),
            flags:      MessageFlags.IsComponentsV2,
          });
        } catch (e) { console.error(e); }
        return;
      }

      // ── Next level (from victory) ────────────────────────────────
      if (cid === "pvz_nextlevel") {
        const nextIdx = gs.level + 1;
        if (nextIdx >= PVZ_LEVELS.length) {
          await interaction.reply({
            components: [{ type: 10, content: "🏆  You've completed all levels! Amazing!" }],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return;
        }
        const newGs = newGame(
          interaction.channelId, interaction.user.id, nextIdx,
          gs.unlockedPlants, gs.unlockedLevels, gs.levelStars
        );
        pvzGames.set(interaction.channelId, newGs);
        try { await updateGameMessage(newGs, interaction, true); } catch (e) { console.error(e); }
        return;
      }

      // ── Quit ─────────────────────────────────────────────────────
      if (cid === "pvz_quit") {
        pvzGames.delete(interaction.channelId);
        await interaction.update({
          files: [],
          components: [{ type: 17, components: [
            { type: 10, content: "## 🌻  Game ended\nRun `/pvz` again to start a new game." },
          ]}],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Noop / disabled buttons
      if (cid.startsWith("pvz_noop") || cid === "pvz_suninfo" || cid === "pvz_sun2") {
        await interaction.deferUpdate();
        return;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  MODAL SUBMISSIONS  (/send composer)
  // ──────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        components: [{ type: 10, content: "❌  Session expired. Run `/send` again." }],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const value = interaction.fields.getTextInputValue("input");
    if (interaction.customId === "modal_title") session.title  = value;
    if (interaction.customId === "modal_body")  session.body   = value;
    if (interaction.customId === "modal_gif")   session.gifUrl = value;
    sessions.set(interaction.user.id, session);

    await interaction.deferUpdate();
    await interaction.editReply({
      components: buildEditor(session),
      flags:      MessageFlags.IsComponentsV2,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  MODERATION DMs  (Components V2, no embeds)
// ═══════════════════════════════════════════════════════════════════════
client.on("guildBanAdd", async (ban) => {
  const { user, guild } = ban;
  let moderator = "Server moderation";
  let reason    = "No reason provided";
  try {
    const logs  = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.targetId === user.id) {
      moderator = `<@${entry.executorId}>`;
      reason    = entry.reason ?? reason;
    }
  } catch { /* audit logs unavailable */ }

  const d = { user: `<@${user.id}>`, username: user.username, server: guild.name, moderator, reason };
  try {
    await user.send({
      components: buildContainer(fill(CONFIG.banTitle, d), fill(CONFIG.banBody, d), null),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✉️  Ban DM → ${user.tag}`);
  } catch { console.warn(`Could not DM banned user ${user.tag}`); }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const oldT = oldMember.communicationDisabledUntilTimestamp ?? null;
  const newT = newMember.communicationDisabledUntilTimestamp ?? null;
  if (oldT || !newT) return;

  let moderator = "Server moderation";
  let reason    = "No reason provided";
  try {
    const logs  = await newMember.guild.fetchAuditLogs({ limit: 5 });
    const entry = logs.entries.find(e => e.targetId === newMember.id);
    if (entry) { moderator = `<@${entry.executorId}>`; reason = entry.reason ?? reason; }
  } catch { /* ignore */ }

  const until = new Date(newT).toUTCString();
  const d = { user: `<@${newMember.id}>`, username: newMember.user.username, server: newMember.guild.name, moderator, reason, until };
  try {
    await newMember.send({
      components: buildContainer(fill(CONFIG.muteTitle, d), fill(CONFIG.muteBody, d), null),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`✉️  Mute DM → ${newMember.user.tag}`);
  } catch { console.warn(`Could not DM muted user ${newMember.user.tag}`); }
});

client.on("guildMemberRemove", async (member) => {
  try {
    const logs  = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
    const entry = logs.entries.find(e => e.targetId === member.id && Date.now() - e.createdTimestamp < 10_000);
    if (!entry) return;
    const d = {
      user: `<@${member.id}>`, username: member.user.username,
      server: member.guild.name,
      moderator: `<@${entry.executorId}>`,
      reason: entry.reason ?? "No reason provided",
    };
    try {
      await member.send({
        components: buildContainer(fill(CONFIG.kickTitle, d), fill(CONFIG.kickBody, d), null),
        flags: MessageFlags.IsComponentsV2,
      });
      console.log(`✉️  Kick DM → ${member.user.tag}`);
    } catch { /* DM unavailable after removal */ }
  } catch { /* audit logs unavailable */ }
});

// ═══════════════════════════════════════════════════════════════════════
//  WELCOME MESSAGE
// ═══════════════════════════════════════════════════════════════════════
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
  if (!channel) { console.error("❌  Welcome channel not found."); return; }

  const data = {
    user:     `<@${member.id}>`,
    username: member.user.username,
    server:   member.guild.name,
  };

  const attachment = new AttachmentBuilder(CONFIG.gifPath, { name: "video.gif" });
  try {
    await channel.send({
      files:      [attachment],
      components: buildContainer(
        fill(CONFIG.welcomeTitle, data),
        fill(CONFIG.welcomeBody,  data),
        null, true
      ),
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`📨  Welcome → ${member.user.tag}`);
  } catch (err) {
    console.error("❌  Failed to send welcome message:", err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════════════════
if (!CONFIG.token) {
  console.error("❌  DISCORD_TOKEN not set in .env");
  process.exit(1);
}

client.login(CONFIG.token).catch(err => {
  console.error("❌  Login failed:", err);
});
