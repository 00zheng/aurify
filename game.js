const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  credits: document.getElementById("credits"),
  power: document.getElementById("power"),
  factoryRate: document.getElementById("factory-rate"),
  netRate: document.getElementById("net-rate"),
  objectives: document.getElementById("objectives"),
  palette: document.getElementById("palette"),
  status: document.getElementById("status"),
  clock: document.getElementById("clock"),
  coreButton: document.getElementById("core-click"),
  tapValue: document.getElementById("tap-value"),
  passiveRate: document.getElementById("passive-rate"),
  dropperCount: document.getElementById("dropper-count"),
  coreCount: document.getElementById("core-count"),
  conveyorCount: document.getElementById("conveyor-count"),
  toggleCycle: document.getElementById("toggle-cycle")
};

const TILE = 48;
const WORLD_W = 90;
const WORLD_H = 90;

const TYPES = {
  EMPTY: "empty",
  ROAD: "road",
  POWER: "power",
  DROPPER: "dropper",
  CORE: "core",
  CONVEYOR: "conveyor",
  BANK: "bank"
};

const BUILDINGS = [
  { key: "1", type: TYPES.ROAD, name: "Road", cost: 7 },
  { key: "2", type: TYPES.POWER, name: "Battery Relay", cost: 80 },
  { key: "3", type: TYPES.DROPPER, name: "Money Dropper", cost: 60 },
  { key: "4", type: TYPES.CORE, name: "Fusion Core", cost: 95 },
  { key: "5", type: TYPES.CONVEYOR, name: "Conveyor", cost: 45 },
  { key: "6", type: TYPES.BANK, name: "Credit Bank", cost: 140 }
];

const tasks = [
  {
    text: "Build 3 Money Droppers",
    reward: 180,
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
    text: "Upgrade factory tile to Lv 4",
    reward: 280,
    done: false,
    claimed: false,
    check: (s) => s.maxFactoryLevel >= 4,
    progress: (s) => `${Math.min(s.maxFactoryLevel, 4)}/4`
  },
  {
    text: "Reach 70 factory income/cycle",
    reward: 360,
    done: false,
    claimed: false,
    check: (s) => s.factoryIncome >= 70,
    progress: (s) => `${Math.min(s.factoryIncome, 70)}/70`
  },
  {
    text: "Reach 2500 credits",
    reward: 500,
    done: false,
    claimed: false,
    check: (s) => s.credits >= 2500,
    progress: (s) => `${Math.min(Math.floor(s.credits), 2500)}/2500`
  }
];

let state = {
  credits: 200,
  cycle: 1,
  ticks: 0,
  paused: false,
  showCycle: true,
  selected: 0,
  player: { x: 45, y: 45 },
  camera: { x: 0, y: 0 },
  count: { road: 0, power: 0, dropper: 0, core: 0, conveyor: 0, bank: 0 },
  statusUntil: 0,
  clickValue: 1,
  totalTaps: 0,
  passivePerCycle: 0,
  factoryIncome: 0,
  netPerCycle: 0,
  maxFactoryLevel: 1
};

const grid = Array.from({ length: WORLD_H }, () =>
  Array.from({ length: WORLD_W }, () => ({
    type: TYPES.EMPTY,
    level: 1
  }))
);

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn[data-tab]");
  const panelGame = document.getElementById("panel-game");
  const panelHow = document.getElementById("panel-how");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const showGame = tab.dataset.tab === "game";
      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });

      panelGame.classList.toggle("active", showGame);
      panelHow.classList.toggle("active", !showGame);
      panelGame.hidden = !showGame;
      panelHow.hidden = showGame;
    });
  });
}

function setupCycleToggle() {
  ui.toggleCycle.addEventListener("click", () => {
    state.showCycle = !state.showCycle;
    ui.clock.style.display = state.showCycle ? "block" : "none";
    ui.toggleCycle.textContent = state.showCycle ? "Hide Cycle" : "Show Cycle";
  });
}

function seedStarterRoads() {
  const cx = Math.floor(WORLD_W / 2);
  const cy = Math.floor(WORLD_H / 2);
  for (let x = cx - 6; x <= cx + 6; x += 1) {
    placeFixed(x, cy, TYPES.ROAD);
  }
  for (let y = cy - 6; y <= cy + 6; y += 1) {
    placeFixed(cx, y, TYPES.ROAD);
  }
}

function placeFixed(x, y, type) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type !== TYPES.EMPTY) return;
  cell.type = type;
  cell.level = 1;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
}

function setStatus(text, ms = 1800) {
  state.statusUntil = performance.now() + ms;
  ui.status.textContent = text;
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

function hasAdjacentConveyor(x, y) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  return dirs.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return inBounds(nx, ny) && grid[ny][nx].type === TYPES.CONVEYOR;
  });
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

  const needsRoad = choice.type !== TYPES.ROAD;
  if (needsRoad && !hasAdjacentRoad(x, y)) {
    setStatus("Connect to a road first.");
    return;
  }

  state.credits -= choice.cost;
  cell.type = choice.type;
  cell.level = 1;

  if ((choice.type === TYPES.DROPPER || choice.type === TYPES.CORE) && !hasAdjacentConveyor(x, y)) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    const slot = dirs.find(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return inBounds(nx, ny) && grid[ny][nx].type === TYPES.EMPTY;
    });
    if (slot) {
      const [dx, dy] = slot;
      grid[y + dy][x + dx].type = TYPES.CONVEYOR;
      grid[y + dy][x + dx].level = 1;
    }
  }

  updateCounts();
  evaluateTasks();
  setStatus(`Built ${choice.name}.`);
}

function bulldozeAt(x, y) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type === TYPES.EMPTY) return;

  const special = cell.type === TYPES.DROPPER || cell.type === TYPES.CORE || cell.type === TYPES.CONVEYOR || cell.type === TYPES.BANK || cell.type === TYPES.POWER;
  state.credits += special ? 18 : 6;
  cell.type = TYPES.EMPTY;
  cell.level = 1;
  updateCounts();
  evaluateTasks();
  setStatus("Tile cleared.");
}

function getUpgradeCost(cell) {
  if (cell.type === TYPES.DROPPER) return Math.floor(42 * 1.4 ** (cell.level - 1));
  if (cell.type === TYPES.CORE) return Math.floor(60 * 1.45 ** (cell.level - 1));
  if (cell.type === TYPES.CONVEYOR) return Math.floor(35 * 1.35 ** (cell.level - 1));
  if (cell.type === TYPES.POWER) return Math.floor(70 * 1.4 ** (cell.level - 1));
  if (cell.type === TYPES.BANK) return Math.floor(85 * 1.45 ** (cell.level - 1));
  return 0;
}

function interactTile() {
  const cell = grid[state.player.y][state.player.x];

  if (cell.type === TYPES.CORE) {
    const gain = Math.max(1, Math.floor(cell.level * state.clickValue * 2.2));
    state.credits += gain;
    state.totalTaps += 1;
    updateUI();
    setStatus(`Fusion Core harvested +${gain}.`);
    evaluateTasks();
    return;
  }

  const canUpgrade = [TYPES.DROPPER, TYPES.CONVEYOR, TYPES.POWER, TYPES.BANK].includes(cell.type);
  if (!canUpgrade) {
    setStatus("Nothing to interact with here.");
    return;
  }

  const cost = getUpgradeCost(cell);
  if (state.credits < cost) {
    setStatus(`Need ${cost} credits to upgrade.`);
    return;
  }

  state.credits -= cost;
  cell.level += 1;
  state.maxFactoryLevel = Math.max(state.maxFactoryLevel, cell.level);
  updateCounts();
  evaluateTasks();
  setStatus(`${cell.type} upgraded to Lv ${cell.level}.`);
}

function getPowerStats() {
  let cap = 0;
  let used = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.POWER) cap += 20 + cell.level * 10;
      if (cell.type === TYPES.DROPPER) used += 2;
      if (cell.type === TYPES.CORE) used += 3;
      if (cell.type === TYPES.CONVEYOR) used += 1;
      if (cell.type === TYPES.BANK) used += 2;
    }
  }

  return { cap, used };
}

function updateCounts() {
  state.count = { road: 0, power: 0, dropper: 0, core: 0, conveyor: 0, bank: 0 };
  state.maxFactoryLevel = 1;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.ROAD) state.count.road += 1;
      if (cell.type === TYPES.POWER) state.count.power += 1;
      if (cell.type === TYPES.DROPPER) state.count.dropper += 1;
      if (cell.type === TYPES.CORE) state.count.core += 1;
      if (cell.type === TYPES.CONVEYOR) state.count.conveyor += 1;
      if (cell.type === TYPES.BANK) state.count.bank += 1;
      if (cell.type !== TYPES.EMPTY && cell.type !== TYPES.ROAD) {
        state.maxFactoryLevel = Math.max(state.maxFactoryLevel, cell.level);
      }
    }
  }
}

function calcFactoryIncome() {
  let dropperOutput = 0;
  let conveyorBoost = 1;
  let coreBoost = 1;
  let bankBoost = 1;

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const cell = grid[y][x];
      if (cell.type === TYPES.CONVEYOR) conveyorBoost += 0.03 * cell.level;
      if (cell.type === TYPES.CORE) coreBoost += 0.08 * cell.level;
      if (cell.type === TYPES.BANK) bankBoost += 0.06 * cell.level;
      if (cell.type === TYPES.DROPPER) {
        const base = cell.level * (1 + (cell.level - 1) * 0.2);
        const localBoost = hasAdjacentConveyor(x, y) ? 1.3 : 1;
        dropperOutput += base * localBoost;
      }
    }
  }

  return Math.floor(dropperOutput * conveyorBoost * coreBoost * bankBoost);
}

function updateEconomy() {
  updateCounts();
  const p = getPowerStats();
  const powerRatio = p.used === 0 ? 1 : Math.min(1, p.cap / p.used);

  state.factoryIncome = Math.floor(calcFactoryIncome() * powerRatio);
  state.passivePerCycle = state.factoryIncome;

  const upkeep =
    state.count.road +
    state.count.conveyor +
    state.count.dropper * 2 +
    state.count.core * 2 +
    state.count.bank * 3 +
    state.count.power;

  state.netPerCycle = state.factoryIncome - upkeep;
  state.credits = Math.max(0, state.credits + state.netPerCycle);

  state.clickValue = 1 + Math.floor(state.count.core * 0.35 + state.maxFactoryLevel * 0.3);

  state.cycle += 1;
  ui.clock.textContent = `Cycle ${state.cycle}`;
  evaluateTasks();
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

function claimTask(index) {
  const task = tasks[index];
  if (!task || !task.done || task.claimed) return;
  task.claimed = true;
  state.credits += task.reward;
  setStatus(`Task claimed: +${task.reward} credits.`);
  renderTasks();
}

function clickCore() {
  const gain = Math.max(1, Math.floor(state.clickValue));
  state.credits += gain;
  state.totalTaps += 1;
  updateUI();
  if (state.totalTaps % 6 === 0) setStatus(`Harvested +${gain} credits.`);
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

  if (cell.type === TYPES.EMPTY) {
    ctx.fillStyle = "#4f7a42";
    ctx.fillRect(px, py, TILE - 1, TILE - 1);
    ctx.fillStyle = "rgba(142, 214, 113, 0.14)";
    ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    return;
  }

  if (cell.type === TYPES.ROAD) {
    ctx.fillStyle = "#b9a37a";
    ctx.fillRect(px, py, TILE - 1, TILE - 1);
    ctx.fillStyle = "#98835f";
    for (let yy = 3; yy < TILE; yy += 8) {
      ctx.fillRect(px + 3, py + yy, TILE - 8, 2);
    }
    return;
  }

  if (cell.type === TYPES.CONVEYOR) {
    ctx.fillStyle = "#6e5c90";
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#bca9e6";
    ctx.fillRect(px + 8, py + 20, TILE - 16, 7);
    ctx.fillStyle = "#ece6ff";
    ctx.fillRect(px + 14, py + 11, 6, 5);
    ctx.fillRect(px + 24, py + 11, 6, 5);
  }

  if (cell.type === TYPES.DROPPER) {
    ctx.fillStyle = "#556779";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#77e2ff";
    ctx.fillRect(px + 14, py + 8, 18, 8);
    ctx.fillRect(px + 18, py + 18, 10, 14);
    ctx.fillStyle = "#ecfbff";
    ctx.fillRect(px + 19, py + 34, 8, 8);
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

  if (cell.type === TYPES.POWER) {
    ctx.fillStyle = "#457069";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#b8fff6";
    ctx.fillRect(px + 21, py + 8, 6, TILE - 16);
    ctx.fillRect(px + 15, py + 15, 18, 5);
  }

  if (cell.type === TYPES.BANK) {
    ctx.fillStyle = "#8a6f3d";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#f4d694";
    ctx.fillRect(px + 10, py + 13, TILE - 20, 16);
    ctx.fillStyle = "#fff4cd";
    ctx.fillRect(px + 13, py + 17, TILE - 26, 8);
  }

  if (cell.type !== TYPES.EMPTY && cell.type !== TYPES.ROAD) {
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "12px Rajdhani";
    ctx.fillText(`L${cell.level}`, px + 3, py + 14);
  }
}

function drawPlayer() {
  const px = state.player.x * TILE - state.camera.x;
  const py = state.player.y * TILE - state.camera.y;
  ctx.fillStyle = "#2f62aa";
  ctx.fillRect(px + 16, py + 17, 14, 16);
  ctx.fillStyle = "#f3c09b";
  ctx.fillRect(px + 17, py + 11, 12, 7);
  ctx.fillStyle = "#533720";
  ctx.fillRect(px + 17, py + 9, 12, 2);
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
  const p = getPowerStats();

  ui.credits.textContent = Math.floor(state.credits).toString();
  ui.power.textContent = `${p.used} / ${p.cap}`;
  ui.factoryRate.textContent = state.factoryIncome.toString();
  ui.netRate.textContent = state.netPerCycle.toString();
  ui.tapValue.textContent = Math.floor(state.clickValue).toString();
  ui.passiveRate.textContent = state.passivePerCycle.toString();

  ui.dropperCount.textContent = state.count.dropper.toString();
  ui.coreCount.textContent = state.count.core.toString();
  ui.conveyorCount.textContent = state.count.conveyor.toString();

  if (performance.now() > state.statusUntil) {
    ui.status.textContent = "Build droppers, cores, conveyors, power relays, and banks. Reinvest every cycle.";
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
    li.textContent = `${b.key} ${b.name} (${b.cost})`;
    li.addEventListener("click", () => {
      state.selected = i;
      renderPalette();
      setStatus(`Selected ${b.name}.`);
    });
    ui.palette.appendChild(li);
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

  if (key === "e") {
    if (!e.repeat) interactTile();
    return;
  }

  const movement = keyToMove(key);
  if (movement) {
    if (!e.repeat) attemptMove(movement.dx, movement.dy);
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

ui.coreButton.addEventListener("click", clickCore);

setupTabs();
setupCycleToggle();
seedStarterRoads();
updateCounts();
renderPalette();
renderTasks();
updateEconomy();
gameLoop();
