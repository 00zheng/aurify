const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  credits: document.getElementById("credits"),
  netRate: document.getElementById("net-rate"),
  dropperCount: document.getElementById("dropper-count"),
  coreCount: document.getElementById("core-count"),
  tapValue: document.getElementById("tap-value"),
  objectives: document.getElementById("objectives"),
  palette: document.getElementById("palette"),
  status: document.getElementById("status"),
  coreButton: document.getElementById("core-click")
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
  CORE: "core"
};

const BUILDINGS = [
  { key: "1", type: TYPES.ROAD, name: "Road", cost: 7, benefit: "Placement support" },
  { key: "2", type: TYPES.DROPPER, name: "Money Dropper", cost: 60, benefit: "Passive income" },
  { key: "3", type: TYPES.CORE, name: "Fusion Core", cost: 95, benefit: "Click + global boost" }
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
  }
];

const state = {
  credits: 320,
  selected: 0,
  ticks: 0,
  paused: false,
  player: { x: 45, y: 45 },
  camera: { x: 0, y: 0 },
  count: { road: 0, dropper: 0, core: 0 },
  clickValue: 1,
  netPerCycle: 0,
  statusUntil: 0
};

const grid = Array.from({ length: WORLD_H }, () =>
  Array.from({ length: WORLD_W }, () => ({
    type: TYPES.EMPTY,
    level: 1
  }))
);

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
        netPerCycle: state.netPerCycle
      },
      tasks: tasks.map((t) => ({ done: t.done, claimed: t.claimed })),
      grid: grid.map((row) => row.map((c) => ({ type: c.type, level: c.level })))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
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
    return true;
  } catch {
    return false;
  }
}

function clampNumber(n, min = 0, max = MAX_CREDITS) {
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
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
  state.count = { road: 0, dropper: 0, core: 0 };
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.ROAD) state.count.road += 1;
      if (cell.type === TYPES.DROPPER) state.count.dropper += 1;
      if (cell.type === TYPES.CORE) state.count.core += 1;
    }
  }
  state.clickValue = 1 + state.count.core;
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
  saveProgress();
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
  const gain = Math.max(1, state.clickValue);
  state.credits = clampNumber(state.credits + gain);
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

  const coreMultiplier = 1 + state.count.core * 0.2;
  const value = Math.floor(dropperBase * coreMultiplier);
  state.netPerCycle = state.count.dropper > 0 ? Math.max(1, value) : 0;
}

function updateEconomy() {
  updateCounts();
  calcNetPerCycle();
  state.credits = clampNumber(state.credits + state.netPerCycle);
  evaluateTasks();
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

  if (cell.type === TYPES.DROPPER) {
    ctx.fillStyle = "#556779";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#77e2ff";
    ctx.fillRect(px + 14, py + 8, 18, 8);
    ctx.fillRect(px + 18, py + 18, 10, 14);
    ctx.fillStyle = "#ecfbff";
    ctx.fillRect(px + 19, py + 34, 8, 8);
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
  ui.credits.textContent = Math.floor(state.credits).toString();
  ui.netRate.textContent = Math.floor(state.netPerCycle).toString();
  ui.dropperCount.textContent = state.count.dropper.toString();
  ui.coreCount.textContent = state.count.core.toString();
  ui.tapValue.textContent = state.clickValue.toString();

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

ui.coreButton.addEventListener("click", harvestCredits);

const loaded = loadProgress();
if (!loaded) {
  seedStarterRoads();
  updateCounts();
  calcNetPerCycle();
  saveProgress();
} else {
  updateCounts();
  calcNetPerCycle();
}

renderPalette();
renderTasks();
updateUI();
gameLoop();

window.addEventListener("beforeunload", saveProgress);
