const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  credits: document.getElementById("credits"),
  netRate: document.getElementById("net-rate"),
  dropperCount: document.getElementById("dropper-count"),
  coreCount: document.getElementById("core-count"),
  tapValue: document.getElementById("tap-value"),
  tokens: document.getElementById("tokens"),
  relics: document.getElementById("relics"),
  rebirthPoints: document.getElementById("rebirth-points"),
  rebirthCount: document.getElementById("rebirth-count"),
  objectives: document.getElementById("objectives"),
  palette: document.getElementById("palette"),
  dropperUpgrades: document.getElementById("dropper-upgrades"),
  dungeonButton: document.getElementById("run-dungeon"),
  dungeonInfo: document.getElementById("dungeon-info"),
  rebirthButton: document.getElementById("rebirth-btn"),
  rebirthUpgrades: document.getElementById("rebirth-upgrades"),
  status: document.getElementById("status"),
  coreButton: document.getElementById("core-click"),
  restartButton: document.getElementById("restart-btn"),
  saveIndicator: document.getElementById("save-indicator")
};

const TILE = 48;
const WORLD_W = 90;
const WORLD_H = 90;
const MAX_CREDITS = 1e12;
const SAVE_KEY = "neon_skyline_minimal_save_v1";

const TYPES = {
  EMPTY: "empty",
  ROAD: "road",
  DROPPER: "dropper",
  CORE: "core",
  REFINERY: "refinery",
  DUNGEON_GATE: "dungeon_gate",
  GENERATOR: "generator"
};

const BUILDINGS = [
  { key: "1", type: TYPES.ROAD, name: "Road", cost: 7, benefit: "Placement support" },
  { key: "2", type: TYPES.DROPPER, name: "Money Dropper", cost: 60, benefit: "Passive income" },
  { key: "3", type: TYPES.CORE, name: "Fusion Core", cost: 95, benefit: "Click + global boost" },
  { key: "4", type: TYPES.REFINERY, name: "Ore Refinery", cost: 220, benefit: "Boosts dropper value" },
  { key: "5", type: TYPES.GENERATOR, name: "Power Generator", cost: 170, benefit: "Unlocks advanced output" },
  { key: "6", type: TYPES.DUNGEON_GATE, name: "Dungeon Gate", cost: 260, benefit: "Enables dungeon runs" }
];

const DROPPER_UPGRADES = [
  {
    key: "speed",
    name: "Overclock",
    baseCost: 220,
    maxLevel: 12,
    info: "More drops per cycle"
  },
  {
    key: "value",
    name: "Compression",
    baseCost: 260,
    maxLevel: 12,
    info: "Higher base drop value"
  },
  {
    key: "special",
    name: "Lucky Ore",
    baseCost: 320,
    maxLevel: 8,
    info: "Chance for premium drops"
  }
];

const REBIRTH_UPGRADES = [
  {
    key: "oreValue",
    name: "Permanent Ore Value",
    baseCost: 1,
    maxLevel: 25,
    info: "+8% global output per level"
  },
  {
    key: "dropperSpeed",
    name: "Permanent Dropper Speed",
    baseCost: 1,
    maxLevel: 25,
    info: "+6% dropper speed per level"
  },
  {
    key: "lootChance",
    name: "Dungeon Loot Mastery",
    baseCost: 1,
    maxLevel: 20,
    info: "+2% relic chance per level"
  },
  {
    key: "offlineGain",
    name: "Tap Amplifier",
    baseCost: 1,
    maxLevel: 20,
    info: "+1 click gain per level"
  }
];

const tasks = [
  {
    text: "Build 3 Money Droppers",
    reward: 140,
    done: false,
    claimed: false,
    check: (s) => s.count.dropper >= 3,
    progress: (s) => `${Math.min(s.count.dropper, 3)}/3`
  },
  {
    text: "Build 2 Fusion Cores",
    reward: 220,
    done: false,
    claimed: false,
    check: (s) => s.count.core >= 2,
    progress: (s) => `${Math.min(s.count.core, 2)}/2`
  },
  {
    text: "Reach 50 net/cycle",
    reward: 320,
    done: false,
    claimed: false,
    check: (s) => s.netPerCycle >= 50,
    progress: (s) => `${Math.min(s.netPerCycle, 50)}/50`
  },
  {
    text: "Reach 3000 credits",
    reward: 500,
    done: false,
    claimed: false,
    check: (s) => s.credits >= 3000,
    progress: (s) => `${Math.min(Math.floor(s.credits), 3000)}/3000`
  },
  {
    text: "Complete 3 dungeon runs",
    reward: 700,
    done: false,
    claimed: false,
    check: (s) => s.dungeon.runs >= 3,
    progress: (s) => `${Math.min(s.dungeon.runs, 3)}/3`
  },
  {
    text: "Rebirth once",
    reward: 950,
    done: false,
    claimed: false,
    check: (s) => s.rebirthCount >= 1,
    progress: (s) => `${Math.min(s.rebirthCount, 1)}/1`
  }
];

const state = {
  credits: 320,
  selected: 0,
  ticks: 0,
  paused: false,
  player: { x: 45, y: 45 },
  camera: { x: 0, y: 0 },
  count: { road: 0, dropper: 0, core: 0, refinery: 0, dungeonGate: 0, generator: 0 },
  clickValue: 1,
  netPerCycle: 0,
  statusUntil: 0,
  tokens: 0,
  relics: 0,
  dropperUpgrades: { speed: 0, value: 0, special: 0 },
  rebirthPoints: 0,
  rebirthCount: 0,
  permanent: { oreValue: 0, dropperSpeed: 0, lootChance: 0, offlineGain: 0 },
  dungeon: { depth: 1, runs: 0, bestWave: 0, inProgress: false }
};

const grid = Array.from({ length: WORLD_H }, () =>
  Array.from({ length: WORLD_W }, () => ({
    type: TYPES.EMPTY,
    level: 1
  }))
);

const terrain = Array.from({ length: WORLD_H }, (_, y) =>
  Array.from({ length: WORLD_W }, (_, x) => {
    const n = hash2D(x, y);
    return {
      biome: n > 0.74 ? "dry" : n < 0.22 ? "lush" : "plain",
      speckle: hash2D(x + 91, y + 47),
      tuft: hash2D(x + 17, y + 133)
    };
  })
);

let saveIndicatorTimer;

function showSaveIndicator(text, variant = "saved") {
  if (!ui.saveIndicator) return;
  ui.saveIndicator.textContent = text;
  ui.saveIndicator.classList.remove("saved", "loaded");
  if (variant) ui.saveIndicator.classList.add(variant);

  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => {
    ui.saveIndicator.textContent = "Auto-save on";
    ui.saveIndicator.classList.remove("saved", "loaded");
  }, 1400);
}

function saveProgress() {
  try {
    const payload = {
      state: {
        credits: state.credits,
        selected: state.selected,
        ticks: state.ticks,
        paused: state.paused,
        player: state.player,
        camera: state.camera,
        clickValue: state.clickValue,
        totalTaps: state.totalTaps,
        netPerCycle: state.netPerCycle,
        tokens: state.tokens,
        relics: state.relics,
        dropperUpgrades: state.dropperUpgrades,
        rebirthPoints: state.rebirthPoints,
        rebirthCount: state.rebirthCount,
        permanent: state.permanent,
        dungeon: state.dungeon
      },
      tasks: tasks.map((t) => ({ done: t.done, claimed: t.claimed })),
      grid: grid.map((row) => row.map((c) => ({ type: c.type, level: c.level })))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    showSaveIndicator("Saved", "saved");
  } catch {
    // Ignore save failures (storage quota, private mode, etc).
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.state || !Array.isArray(data.grid) || !Array.isArray(data.tasks)) {
      return false;
    }

    state.credits = clampNumber(Number(data.state.credits || 0));
    state.selected = Number.isInteger(data.state.selected) ? data.state.selected : 0;
    state.ticks = Number.isInteger(data.state.ticks) ? data.state.ticks : 0;
    state.paused = !!data.state.paused;
    state.player = {
      x: Number.isInteger(data.state.player?.x) ? data.state.player.x : state.player.x,
      y: Number.isInteger(data.state.player?.y) ? data.state.player.y : state.player.y
    };
    state.camera = {
      x: Number.isFinite(data.state.camera?.x) ? data.state.camera.x : 0,
      y: Number.isFinite(data.state.camera?.y) ? data.state.camera.y : 0
    };
    state.clickValue = Number.isFinite(data.state.clickValue) ? data.state.clickValue : 1;
    state.totalTaps = Number.isInteger(data.state.totalTaps) ? data.state.totalTaps : 0;
    state.netPerCycle = Number.isFinite(data.state.netPerCycle) ? data.state.netPerCycle : 0;
    state.tokens = Number.isFinite(data.state.tokens) ? Math.max(0, Math.floor(data.state.tokens)) : 0;
    state.relics = Number.isFinite(data.state.relics) ? Math.max(0, Math.floor(data.state.relics)) : 0;
    state.dropperUpgrades = {
      speed: Number.isFinite(data.state.dropperUpgrades?.speed) ? Math.max(0, Math.floor(data.state.dropperUpgrades.speed)) : 0,
      value: Number.isFinite(data.state.dropperUpgrades?.value) ? Math.max(0, Math.floor(data.state.dropperUpgrades.value)) : 0,
      special: Number.isFinite(data.state.dropperUpgrades?.special) ? Math.max(0, Math.floor(data.state.dropperUpgrades.special)) : 0
    };
    state.rebirthPoints = Number.isFinite(data.state.rebirthPoints) ? Math.max(0, Math.floor(data.state.rebirthPoints)) : 0;
    state.rebirthCount = Number.isFinite(data.state.rebirthCount) ? Math.max(0, Math.floor(data.state.rebirthCount)) : 0;
    state.permanent = {
      oreValue: Number.isFinite(data.state.permanent?.oreValue) ? Math.max(0, Math.floor(data.state.permanent.oreValue)) : 0,
      dropperSpeed: Number.isFinite(data.state.permanent?.dropperSpeed) ? Math.max(0, Math.floor(data.state.permanent.dropperSpeed)) : 0,
      lootChance: Number.isFinite(data.state.permanent?.lootChance) ? Math.max(0, Math.floor(data.state.permanent.lootChance)) : 0,
      offlineGain: Number.isFinite(data.state.permanent?.offlineGain) ? Math.max(0, Math.floor(data.state.permanent.offlineGain)) : 0
    };
    state.dungeon = {
      depth: Number.isFinite(data.state.dungeon?.depth) ? Math.max(1, Math.floor(data.state.dungeon.depth)) : 1,
      runs: Number.isFinite(data.state.dungeon?.runs) ? Math.max(0, Math.floor(data.state.dungeon.runs)) : 0,
      bestWave: Number.isFinite(data.state.dungeon?.bestWave) ? Math.max(0, Math.floor(data.state.dungeon.bestWave)) : 0,
      inProgress: false
    };

    for (let y = 0; y < WORLD_H; y += 1) {
      const srcRow = data.grid[y];
      if (!Array.isArray(srcRow)) continue;
      for (let x = 0; x < WORLD_W; x += 1) {
        const src = srcRow[x];
        if (!src || typeof src.type !== "string") continue;
        if (!Object.values(TYPES).includes(src.type)) continue;
        grid[y][x].type = src.type;
        grid[y][x].level = Number.isFinite(src.level) ? Math.max(1, Math.floor(src.level)) : 1;
      }
    }

    data.tasks.forEach((savedTask, i) => {
      if (!tasks[i]) return;
      tasks[i].done = !!savedTask.done;
      tasks[i].claimed = !!savedTask.claimed;
    });

    setStatus("Save loaded.", 1400);
    showSaveIndicator("Save loaded", "loaded");
    return true;
  } catch {
    return false;
  }
}

function resetGame() {
  Object.assign(state, {
    credits: 320,
    selected: 0,
    ticks: 0,
    paused: false,
    player: { x: 45, y: 45 },
    camera: { x: 0, y: 0 },
    count: { road: 0, dropper: 0, core: 0, refinery: 0, dungeonGate: 0, generator: 0 },
    clickValue: 1,
    netPerCycle: 0,
    statusUntil: 0,
    tokens: 0,
    relics: 0,
    dropperUpgrades: { speed: 0, value: 0, special: 0 },
    rebirthPoints: 0,
    rebirthCount: 0,
    permanent: { oreValue: 0, dropperSpeed: 0, lootChance: 0, offlineGain: 0 },
    dungeon: { depth: 1, runs: 0, bestWave: 0, inProgress: false }
  });

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      grid[y][x].type = TYPES.EMPTY;
      grid[y][x].level = 1;
    }
  }

  tasks.forEach((task) => {
    task.done = false;
    task.claimed = false;
  });

  seedStarterRoads();
  updateCounts();
  calcNetPerCycle();
  renderTasks();
  renderPalette();
  renderDropperUpgrades();
  renderRebirthUpgrades();
  updateUI();
  saveProgress();
  setStatus("Progress restarted.");
  showSaveIndicator("Restarted", "loaded");
}

function clampNumber(n, min = 0, max = MAX_CREDITS) {
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function hash2D(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
}

function setStatus(text, ms = 1800) {
  state.statusUntil = performance.now() + ms;
  ui.status.textContent = text;
}

function seedStarterRoads() {
  const cx = Math.floor(WORLD_W / 2);
  const cy = Math.floor(WORLD_H / 2);
  for (let x = cx - 6; x <= cx + 6; x += 1) {
    grid[cy][x].type = TYPES.ROAD;
  }
  for (let y = cy - 6; y <= cy + 6; y += 1) {
    grid[y][cx].type = TYPES.ROAD;
  }
}

function hasAdjacentRoad(x, y) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  return dirs.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return inBounds(nx, ny) && grid[ny][nx].type === TYPES.ROAD;
  });
}

function updateCounts() {
  state.count = { road: 0, dropper: 0, core: 0, refinery: 0, dungeonGate: 0, generator: 0 };
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.ROAD) state.count.road += 1;
      if (cell.type === TYPES.DROPPER) state.count.dropper += 1;
      if (cell.type === TYPES.CORE) state.count.core += 1;
      if (cell.type === TYPES.REFINERY) state.count.refinery += 1;
      if (cell.type === TYPES.DUNGEON_GATE) state.count.dungeonGate += 1;
      if (cell.type === TYPES.GENERATOR) state.count.generator += 1;
    }
  }
  state.clickValue = 1 + state.count.core + state.permanent.offlineGain;
}

function buildAt(x, y) {
  if (!inBounds(x, y)) return;
  const choice = BUILDINGS[state.selected];
  const cell = grid[y][x];

  if (cell.type !== TYPES.EMPTY) {
    setStatus("Tile occupied. Press X to bulldoze.");
    return;
  }
  if (state.credits < choice.cost) {
    setStatus("Not enough credits.");
    return;
  }
  if (choice.type !== TYPES.ROAD && !hasAdjacentRoad(x, y)) {
    setStatus("Connect to a road first.");
    return;
  }

  state.credits = clampNumber(state.credits - choice.cost);
  cell.type = choice.type;
  updateCounts();
  evaluateTasks();
  renderDropperUpgrades();
  saveProgress();
  setStatus(`Built ${choice.name}.`);
}

function bulldozeAt(x, y) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type === TYPES.EMPTY) return;

  state.credits = clampNumber(state.credits + (cell.type === TYPES.ROAD ? 4 : 18));
  cell.type = TYPES.EMPTY;
  cell.level = 1;
  updateCounts();
  evaluateTasks();
  renderDropperUpgrades();
  saveProgress();
  setStatus("Tile cleared.");
}

function claimTask(index) {
  const task = tasks[index];
  if (!task || !task.done || task.claimed) return;
  task.claimed = true;
  state.credits = clampNumber(state.credits + task.reward);
  setStatus(`Task claimed: +${task.reward} credits.`);
  renderTasks();
  renderDropperUpgrades();
  saveProgress();
}

function getDropperUpgradeCost(key) {
  const cfg = DROPPER_UPGRADES.find((u) => u.key === key);
  if (!cfg) return Infinity;
  const level = state.dropperUpgrades[key] || 0;
  return Math.floor(cfg.baseCost * Math.pow(1.42, level));
}

function buyDropperUpgrade(key) {
  const cfg = DROPPER_UPGRADES.find((u) => u.key === key);
  if (!cfg) return;
  const level = state.dropperUpgrades[key] || 0;
  if (level >= cfg.maxLevel) {
    setStatus(`${cfg.name} is maxed.`);
    return;
  }
  const cost = getDropperUpgradeCost(key);
  if (state.credits < cost) {
    setStatus("Not enough credits for upgrade.");
    return;
  }

  state.credits = clampNumber(state.credits - cost);
  state.dropperUpgrades[key] = level + 1;
  calcNetPerCycle();
  renderDropperUpgrades();
  saveProgress();
  setStatus(`${cfg.name} upgraded to ${state.dropperUpgrades[key]}.`);
}

function getRebirthUpgradeCost(key) {
  const cfg = REBIRTH_UPGRADES.find((u) => u.key === key);
  if (!cfg) return Infinity;
  const level = state.permanent[key] || 0;
  return cfg.baseCost + level;
}

function buyRebirthUpgrade(key) {
  const cfg = REBIRTH_UPGRADES.find((u) => u.key === key);
  if (!cfg) return;
  const level = state.permanent[key] || 0;
  if (level >= cfg.maxLevel) {
    setStatus(`${cfg.name} is maxed.`);
    return;
  }
  const cost = getRebirthUpgradeCost(key);
  if (state.rebirthPoints < cost) {
    setStatus("Not enough rebirth points.");
    return;
  }

  state.rebirthPoints -= cost;
  state.permanent[key] = level + 1;
  updateCounts();
  calcNetPerCycle();
  renderRebirthUpgrades();
  saveProgress();
  setStatus(`${cfg.name} upgraded.`);
}

function getRebirthGain() {
  return Math.floor(Math.sqrt(Math.max(0, state.credits) / 100000));
}

function rebirth() {
  const gain = getRebirthGain();
  if (gain < 1) {
    setStatus("Need 100,000 credits to rebirth.");
    return;
  }

  state.rebirthPoints += gain;
  state.rebirthCount += 1;

  state.credits = 320;
  state.selected = 0;
  state.ticks = 0;
  state.player = { x: 45, y: 45 };
  state.camera = { x: 0, y: 0 };
  state.dropperUpgrades = { speed: 0, value: 0, special: 0 };
  state.dungeon.depth = 1;

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      grid[y][x].type = TYPES.EMPTY;
      grid[y][x].level = 1;
    }
  }

  tasks.forEach((task) => {
    task.done = false;
    task.claimed = false;
  });

  seedStarterRoads();
  updateCounts();
  calcNetPerCycle();
  renderPalette();
  renderTasks();
  renderDropperUpgrades();
  renderRebirthUpgrades();
  saveProgress();
  setStatus(`Rebirth complete. +${gain} rebirth points.`);
}

function runDungeon() {
  if (state.dungeon.inProgress) return;
  if (state.count.dungeonGate <= 0) {
    setStatus("Build a Dungeon Gate first.");
    return;
  }

  state.dungeon.inProgress = true;

  const basePower =
    state.count.dropper * 1.8 +
    state.count.core * 2.3 +
    state.count.refinery * 2.6 +
    state.count.generator * 2.1 +
    state.rebirthCount * 3;
  const wavePower = basePower + state.dropperUpgrades.speed * 1.2 + state.dropperUpgrades.value * 1.3;
  const cleared = Math.max(1, Math.floor(2 + wavePower / Math.max(1, state.dungeon.depth * 3)));
  const clampedWave = Math.min(50, cleared);

  const tokenReward = Math.max(4, Math.floor(clampedWave * (1.2 + state.dungeon.depth * 0.15)));
  const relicChance = 0.08 + state.permanent.lootChance * 0.02 + state.dropperUpgrades.special * 0.01;
  const relicFound = Math.random() < relicChance ? 1 : 0;
  const creditReward = clampedWave * 45;

  state.tokens += tokenReward;
  state.relics += relicFound;
  state.credits = clampNumber(state.credits + creditReward);
  state.dungeon.runs += 1;
  state.dungeon.bestWave = Math.max(state.dungeon.bestWave, clampedWave);
  state.dungeon.depth += 1;
  state.dungeon.inProgress = false;

  evaluateTasks();
  renderDropperUpgrades();
  saveProgress();
  setStatus(
    `Dungeon cleared to wave ${clampedWave}. +${tokenReward} tokens, +${creditReward} credits${
      relicFound ? ", +1 relic" : ""
    }.`
  );
}

function evaluateTasks() {
  let changed = false;
  for (const task of tasks) {
    if (!task.done && task.check(state)) {
      task.done = true;
      changed = true;
      setStatus(`Task ready: ${task.text}`);
    }
  }
  if (changed) renderTasks();
}

function harvestCredits() {
  updateCounts();
  const globalBoost = 1 + state.permanent.oreValue * 0.08;
  const gain = Math.max(1, Math.floor(state.clickValue * globalBoost));
  state.credits = clampNumber(state.credits + gain);
  renderDropperUpgrades();
  saveProgress();
  if (Math.random() < 0.2) {
    setStatus(`Harvested +${gain} credits.`);
  }
}

function calcNetPerCycle() {
  let dropperBase = 0;
  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const cell = grid[y][x];
      if (cell.type !== TYPES.DROPPER) continue;
      const roadBoost = hasAdjacentRoad(x, y) ? 1.15 : 1;
      dropperBase += 2 * roadBoost;
    }
  }

  const speedFactor = 1 + state.dropperUpgrades.speed * 0.12 + state.permanent.dropperSpeed * 0.06;
  const valueFactor = 1 + state.dropperUpgrades.value * 0.17 + state.count.refinery * 0.14;
  const generatorFactor = state.count.generator > 0 ? 1 + Math.min(0.5, state.count.generator * 0.08) : 0.85;
  const coreMultiplier = 1 + state.count.core * 0.2;
  const permanentFactor = 1 + state.permanent.oreValue * 0.08;
  const luckyBonus = 1 + state.dropperUpgrades.special * 0.03;
  const value = Math.floor(dropperBase * speedFactor * valueFactor * generatorFactor * coreMultiplier * permanentFactor * luckyBonus);
  state.netPerCycle = state.count.dropper > 0 ? Math.max(1, value) : 0;
}

function updateEconomy() {
  updateCounts();
  calcNetPerCycle();
  state.credits = clampNumber(state.credits + state.netPerCycle);
  evaluateTasks();
  renderDropperUpgrades();
  saveProgress();
}

function updateCamera() {
  const targetX = state.player.x * TILE - canvas.width / 2 + TILE / 2;
  const targetY = state.player.y * TILE - canvas.height / 2 + TILE / 2;
  const maxX = WORLD_W * TILE - canvas.width;
  const maxY = WORLD_H * TILE - canvas.height;
  state.camera.x = Math.max(0, Math.min(maxX, targetX));
  state.camera.y = Math.max(0, Math.min(maxY, targetY));
}

function drawTile(x, y, cell) {
  const px = x * TILE - state.camera.x;
  const py = y * TILE - state.camera.y;
  if (px > canvas.width || py > canvas.height || px < -TILE || py < -TILE) return;

  const t = terrain[y][x];

  // Base terrain pass intentionally paints full tiles (no -1 gap) to avoid visible block seams.
  if (t.biome === "lush") {
    ctx.fillStyle = "#67a451";
  } else if (t.biome === "dry") {
    ctx.fillStyle = "#8da64d";
  } else {
    ctx.fillStyle = "#74a955";
  }
  ctx.fillRect(px, py, TILE, TILE);

  const tone = 0.06 + t.speckle * 0.08;
  ctx.fillStyle = `rgba(255, 255, 255, ${tone})`;
  ctx.fillRect(px + 4, py + 4, TILE - 10, TILE - 10);

  ctx.fillStyle = `rgba(34, 83, 30, ${0.08 + t.tuft * 0.16})`;
  ctx.fillRect(px + 8, py + 10, 3, 4);
  ctx.fillRect(px + 18, py + 24, 3, 4);
  ctx.fillRect(px + 31, py + 15, 3, 4);

  if (cell.type === TYPES.EMPTY) {
    return;
  }

  if (cell.type === TYPES.ROAD) {
    ctx.fillStyle = "#c79a58";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(109, 76, 40, 0.24)";
    ctx.fillRect(px + 2, py + 6, TILE - 4, 4);
    ctx.fillRect(px + 4, py + 18, TILE - 8, 3);
    ctx.fillRect(px + 3, py + 29, TILE - 6, 4);
    ctx.fillRect(px + 5, py + 39, TILE - 10, 3);
    return;
  }

  if (cell.type === TYPES.DROPPER) {
    ctx.fillStyle = "rgba(31, 41, 58, 0.35)";
    ctx.beginPath();
    ctx.ellipse(px + 29, py + 41, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#49627d";
    ctx.fillRect(px + 10, py + 15, 26, 22);
    ctx.fillStyle = "#354962";
    ctx.fillRect(px + 12, py + 37, 22, 6);

    ctx.fillStyle = "#8ff0ff";
    ctx.fillRect(px + 13, py + 17, 20, 6);
    ctx.fillStyle = "#dbfdff";
    ctx.fillRect(px + 22, py + 24, 4, 10);

    ctx.fillStyle = "#caedff";
    ctx.fillRect(px + 19, py + 30, 10, 9);
    return;
  }

  if (cell.type === TYPES.CORE) {
    ctx.fillStyle = "#5f4f78";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#ff95f3";
    ctx.fillRect(px + 15, py + 8, 16, 16);
    ctx.fillStyle = "#ffe9fd";
    ctx.fillRect(px + 18, py + 12, 10, 9);
    ctx.fillStyle = "#bdfdff";
    ctx.fillRect(px + 17, py + 27, 12, 12);
  }
}

function drawPlayer() {
  const px = state.player.x * TILE - state.camera.x;
  const py = state.player.y * TILE - state.camera.y;
  ctx.fillStyle = "rgba(33, 28, 19, 0.35)";
  ctx.beginPath();
  ctx.ellipse(px + 23, py + 38, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2f62aa";
  ctx.fillRect(px + 16, py + 18, 14, 15);
  ctx.fillStyle = "#f3c09b";
  ctx.fillRect(px + 17, py + 12, 12, 7);
  ctx.fillStyle = "#9b6c38";
  ctx.fillRect(px + 15, py + 10, 16, 2);
  ctx.fillStyle = "#533720";
  ctx.fillRect(px + 17, py + 8, 12, 2);
}

function drawHover() {
  const px = state.player.x * TILE - state.camera.x;
  const py = state.player.y * TILE - state.camera.y;
  ctx.strokeStyle = "#f8e67d";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
}

function render() {
  updateCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8cc8ff");
  sky.addColorStop(0.55, "#78b06b");
  sky.addColorStop(1, "#3a5f31");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startX = Math.max(0, Math.floor(state.camera.x / TILE) - 1);
  const endX = Math.min(WORLD_W - 1, startX + Math.ceil(canvas.width / TILE) + 2);
  const startY = Math.max(0, Math.floor(state.camera.y / TILE) - 1);
  const endY = Math.min(WORLD_H - 1, startY + Math.ceil(canvas.height / TILE) + 2);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      drawTile(x, y, grid[y][x]);
    }
  }

  drawHover();
  drawPlayer();
}

function updateUI() {
  ui.credits.textContent = Math.floor(state.credits).toString();
  ui.netRate.textContent = Math.floor(state.netPerCycle).toString();
  ui.dropperCount.textContent = state.count.dropper.toString();
  ui.coreCount.textContent = state.count.core.toString();
  ui.tapValue.textContent = state.clickValue.toString();
  if (ui.tokens) ui.tokens.textContent = state.tokens.toString();
  if (ui.relics) ui.relics.textContent = state.relics.toString();
  if (ui.rebirthPoints) ui.rebirthPoints.textContent = state.rebirthPoints.toString();
  if (ui.rebirthCount) ui.rebirthCount.textContent = state.rebirthCount.toString();

  if (ui.dungeonInfo) {
    ui.dungeonInfo.textContent = `Depth ${state.dungeon.depth} | Best wave ${state.dungeon.bestWave} | Runs ${state.dungeon.runs}`;
  }

  if (ui.rebirthButton) {
    const gain = getRebirthGain();
    ui.rebirthButton.textContent = gain > 0 ? `Rebirth (+${gain} RP)` : "Rebirth (Need 100k)";
  }

  if (performance.now() > state.statusUntil) {
    ui.status.textContent = "Build roads, then place droppers and cores. Harvest and reinvest.";
  }
}

function renderTasks() {
  ui.objectives.innerHTML = "";
  tasks.forEach((task, i) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${task.text} [${task.progress(state)}]`;
    text.style.flex = "1";

    const btn = document.createElement("button");
    btn.className = "task-button";

    if (task.claimed) {
      btn.textContent = "Claimed";
      btn.disabled = true;
    } else if (task.done) {
      btn.textContent = `Claim +${task.reward}`;
      btn.addEventListener("click", () => claimTask(i));
    } else {
      btn.textContent = "Locked";
      btn.disabled = true;
    }

    li.appendChild(text);
    li.appendChild(btn);
    ui.objectives.appendChild(li);
  });
}

function renderPalette() {
  ui.palette.innerHTML = "";
  BUILDINGS.forEach((b, i) => {
    const li = document.createElement("li");
    if (i === state.selected) li.classList.add("active");
    li.textContent = `${b.key} ${b.name} (${b.cost}) - ${b.benefit}`;
    li.addEventListener("click", () => {
      state.selected = i;
      renderPalette();
      setStatus(`Selected ${b.name}.`);
    });
    ui.palette.appendChild(li);
  });
}

function renderDropperUpgrades() {
  if (!ui.dropperUpgrades) return;
  ui.dropperUpgrades.innerHTML = "";
  DROPPER_UPGRADES.forEach((upgrade) => {
    const level = state.dropperUpgrades[upgrade.key] || 0;
    const cost = getDropperUpgradeCost(upgrade.key);

    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "upgrade-row";

    const label = document.createElement("span");
    label.className = "upgrade-label";
    label.textContent = `${upgrade.name} Lv.${level}/${upgrade.maxLevel}`;

    const meta = document.createElement("span");
    meta.className = "upgrade-meta";
    meta.textContent = upgrade.info;

    row.appendChild(label);
    row.appendChild(meta);

    const button = document.createElement("button");
    button.className = "upgrade-button";

    if (level >= upgrade.maxLevel) {
      button.textContent = "Maxed";
      button.disabled = true;
    } else {
      button.textContent = `Buy (${cost})`;
      button.disabled = state.credits < cost;
      button.addEventListener("click", () => buyDropperUpgrade(upgrade.key));
    }

    li.appendChild(row);
    li.appendChild(button);
    ui.dropperUpgrades.appendChild(li);
  });
}

function renderRebirthUpgrades() {
  if (!ui.rebirthUpgrades) return;
  ui.rebirthUpgrades.innerHTML = "";

  REBIRTH_UPGRADES.forEach((upgrade) => {
    const level = state.permanent[upgrade.key] || 0;
    const cost = getRebirthUpgradeCost(upgrade.key);

    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "upgrade-row";

    const label = document.createElement("span");
    label.className = "upgrade-label";
    label.textContent = `${upgrade.name} Lv.${level}/${upgrade.maxLevel}`;

    const meta = document.createElement("span");
    meta.className = "upgrade-meta";
    meta.textContent = upgrade.info;

    row.appendChild(label);
    row.appendChild(meta);

    const button = document.createElement("button");
    button.className = "upgrade-button";

    if (level >= upgrade.maxLevel) {
      button.textContent = "Maxed";
      button.disabled = true;
    } else {
      button.textContent = `Spend ${cost} RP`;
      button.disabled = state.rebirthPoints < cost;
      button.addEventListener("click", () => buyRebirthUpgrade(upgrade.key));
    }

    li.appendChild(row);
    li.appendChild(button);
    ui.rebirthUpgrades.appendChild(li);
  });
}

function keyToMove(key) {
  if (key === "ArrowUp" || key === "w") return { dx: 0, dy: -1 };
  if (key === "ArrowDown" || key === "s") return { dx: 0, dy: 1 };
  if (key === "ArrowLeft" || key === "a") return { dx: -1, dy: 0 };
  if (key === "ArrowRight" || key === "d") return { dx: 1, dy: 0 };
  return null;
}

function attemptMove(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!inBounds(nx, ny)) return;
  state.player.x = nx;
  state.player.y = ny;
}

function gameLoop() {
  if (!state.paused) {
    state.ticks += 1;
    if (state.ticks % 60 === 0) updateEconomy();
  }

  render();
  updateUI();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "].includes(key)) {
    e.preventDefault();
  }

  if (key === "p") {
    if (!e.repeat) {
      state.paused = !state.paused;
      setStatus(state.paused ? "Simulation paused." : "Simulation resumed.");
    }
    return;
  }

  if (key === "x") {
    if (!e.repeat) bulldozeAt(state.player.x, state.player.y);
    return;
  }

  const move = keyToMove(key);
  if (move) {
    if (!e.repeat) attemptMove(move.dx, move.dy);
    return;
  }

  const ix = BUILDINGS.findIndex((b) => b.key === key);
  if (ix >= 0) {
    state.selected = ix;
    renderPalette();
    setStatus(`Selected ${BUILDINGS[ix].name}.`);
    return;
  }

  if (key === " ") {
    if (!e.repeat) buildAt(state.player.x, state.player.y);
  }
});

if (ui.coreButton) ui.coreButton.addEventListener("click", harvestCredits);
if (ui.dungeonButton) ui.dungeonButton.addEventListener("click", runDungeon);
if (ui.rebirthButton) ui.rebirthButton.addEventListener("click", rebirth);
if (ui.restartButton) {
  ui.restartButton.addEventListener("click", () => {
    if (window.confirm("Restart progress? This will overwrite your current save.")) {
      localStorage.removeItem(SAVE_KEY);
      resetGame();
    }
  });
}

const loaded = loadProgress();
if (!loaded) {
  seedStarterRoads();
  updateCounts();
  calcNetPerCycle();
  saveProgress();
  showSaveIndicator("New save", "saved");
} else {
  updateCounts();
  calcNetPerCycle();
}

renderPalette();
renderTasks();
renderDropperUpgrades();
renderRebirthUpgrades();
updateUI();
gameLoop();

window.addEventListener("beforeunload", saveProgress);
