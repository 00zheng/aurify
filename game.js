const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  credits: document.getElementById("credits"),
  population: document.getElementById("population"),
  happiness: document.getElementById("happiness"),
  power: document.getElementById("power"),
  pollution: document.getElementById("pollution"),
  demand: document.getElementById("demand"),
  objectives: document.getElementById("objectives"),
  palette: document.getElementById("palette"),
  status: document.getElementById("status"),
  clock: document.getElementById("clock"),
  coreButton: document.getElementById("core-click"),
  tapValue: document.getElementById("tap-value"),
  passiveRate: document.getElementById("passive-rate"),
  upgrades: document.getElementById("upgrades")
};

const TILE = 32;
const GRID_W = 22;
const GRID_H = 18;
const OFF_X = 16;
const OFF_Y = 16;

const TYPES = {
  EMPTY: "empty",
  ROAD: "road",
  RES: "res",
  COM: "com",
  IND: "ind",
  POWER: "power",
  PARK: "park"
};

const BUILDINGS = [
  { key: "1", type: TYPES.ROAD, name: "Stone Walkway", cost: 7 },
  { key: "2", type: TYPES.RES, name: "Sky Cottages", cost: 42 },
  { key: "3", type: TYPES.COM, name: "Bazaar Hub", cost: 70 },
  { key: "4", type: TYPES.IND, name: "Fabricator", cost: 94 },
  { key: "5", type: TYPES.POWER, name: "Sun Reactor", cost: 120 },
  { key: "6", type: TYPES.PARK, name: "Garden Pod", cost: 55 }
];

const upgrades = [
  {
    id: "gloves",
    name: "Quantum Gloves",
    cost: 90,
    desc: "+1 credits per tap",
    bought: false,
    apply: (s) => {
      s.clickValue += 1;
    }
  },
  {
    id: "miner",
    name: "Drone Miners",
    cost: 220,
    desc: "+5 passive credits/cycle",
    bought: false,
    apply: (s) => {
      s.passiveFlat += 5;
    }
  },
  {
    id: "optimizer",
    name: "Market Optimizer",
    cost: 520,
    desc: "+20% all income",
    bought: false,
    apply: (s) => {
      s.incomeMultiplier += 0.2;
    }
  },
  {
    id: "swarm",
    name: "Nano Swarm",
    cost: 980,
    desc: "+14 passive credits/cycle",
    bought: false,
    apply: (s) => {
      s.passiveFlat += 14;
    }
  },
  {
    id: "hyperloop",
    name: "Hyperloop Freight",
    cost: 1450,
    desc: "+35% city income",
    bought: false,
    apply: (s) => {
      s.cityIncomeMultiplier += 0.35;
    }
  }
];

const tasks = [
  {
    text: "Build 6 walkways",
    reward: 120,
    done: false,
    claimed: false,
    check: (s) => s.count.road >= 6,
    progress: (s) => `${Math.min(s.count.road, 6)}/6`
  },
  {
    text: "Build 2 Sky Cottages",
    reward: 160,
    done: false,
    claimed: false,
    check: (s) => s.count.res >= 2,
    progress: (s) => `${Math.min(s.count.res, 2)}/2`
  },
  {
    text: "Tap the Fusion Core 40 times",
    reward: 180,
    done: false,
    claimed: false,
    check: (s) => s.totalTaps >= 40,
    progress: (s) => `${Math.min(s.totalTaps, 40)}/40`
  },
  {
    text: "Reach population 50",
    reward: 240,
    done: false,
    claimed: false,
    check: (s) => s.population >= 50,
    progress: (s) => `${Math.min(s.population, 50)}/50`
  },
  {
    text: "Reach 20 passive income/cycle",
    reward: 320,
    done: false,
    claimed: false,
    check: (s) => s.passivePerCycle >= 20,
    progress: (s) => `${Math.min(s.passivePerCycle, 20)}/20`
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
  credits: 280,
  population: 0,
  happiness: 55,
  pollution: 0,
  powerUsed: 0,
  powerCap: 0,
  demandR: 40,
  demandC: 30,
  demandI: 25,
  cycle: 1,
  ticks: 0,
  paused: false,
  selected: 0,
  player: { x: 2, y: 2 },
  count: { road: 0, res: 0, com: 0, ind: 0, power: 0, park: 0 },
  statusUntil: 0,
  statusText: "Move with Arrow Keys or WASD, then build and harvest credits.",
  clickValue: 1,
  passiveFlat: 0,
  passivePerCycle: 0,
  incomeMultiplier: 1,
  cityIncomeMultiplier: 1,
  totalTaps: 0
};

const grid = Array.from({ length: GRID_H }, () =>
  Array.from({ length: GRID_W }, () => ({
    type: TYPES.EMPTY,
    level: 0,
    glow: Math.random()
  }))
);

const cars = [];

function seedStarterRoads() {
  for (let x = 4; x < 11; x += 1) {
    placeFixed(x, 8, TYPES.ROAD);
  }
  for (let y = 6; y < 12; y += 1) {
    placeFixed(7, y, TYPES.ROAD);
  }
}

function placeFixed(x, y, type) {
  const cell = grid[y][x];
  if (cell.type !== TYPES.EMPTY) return;
  cell.type = type;
  cell.level = 1;
  updateCounts();
}

seedStarterRoads();

function updateCounts() {
  state.count = { road: 0, res: 0, com: 0, ind: 0, power: 0, park: 0 };
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.ROAD) state.count.road += 1;
      if (cell.type === TYPES.RES) state.count.res += 1;
      if (cell.type === TYPES.COM) state.count.com += 1;
      if (cell.type === TYPES.IND) state.count.ind += 1;
      if (cell.type === TYPES.POWER) state.count.power += 1;
      if (cell.type === TYPES.PARK) state.count.park += 1;
    }
  }
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
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

function setStatus(text, ms = 1800) {
  state.statusText = text;
  state.statusUntil = performance.now() + ms;
  ui.status.textContent = text;
}

function buildAt(x, y) {
  if (!inBounds(x, y)) return;
  const choice = BUILDINGS[state.selected];
  const cell = grid[y][x];

  if (cell.type !== TYPES.EMPTY) {
    setStatus("Tile is occupied. Press X to bulldoze.");
    return;
  }
  if (state.credits < choice.cost) {
    setStatus("Not enough credits.");
    return;
  }
  if (choice.type !== TYPES.ROAD && !hasAdjacentRoad(x, y)) {
    setStatus("Connect this tile to a walkway first.");
    return;
  }

  state.credits -= choice.cost;
  cell.type = choice.type;
  cell.level = 1;
  updateCounts();
  setStatus(`Built ${choice.name}.`);
  evaluateTasks();
}

function bulldozeAt(x, y) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type === TYPES.EMPTY) return;
  cell.type = TYPES.EMPTY;
  cell.level = 0;
  state.credits += 6;
  updateCounts();
  setStatus("Tile cleared. +6 credits salvage.");
}

function attemptMove(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!inBounds(nx, ny)) return;
  state.player.x = nx;
  state.player.y = ny;
}

function getPowerStats() {
  let cap = 0;
  let used = 0;
  for (const row of grid) {
    for (const c of row) {
      if (c.type === TYPES.POWER) cap += 28;
      if (c.type === TYPES.RES) used += 2;
      if (c.type === TYPES.COM) used += 3;
      if (c.type === TYPES.IND) used += 4;
      if (c.type === TYPES.PARK) used += 1;
    }
  }
  return { cap, used };
}

function growthPass() {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const c = grid[y][x];
      if (c.type === TYPES.RES && state.demandR > 35 && state.happiness > 62 && c.level < 3) {
        if (Math.random() < 0.24) c.level += 1;
      }
      if (c.type === TYPES.COM && state.demandC > 30 && c.level < 3) {
        if (Math.random() < 0.22) c.level += 1;
      }
      if (c.type === TYPES.IND && state.demandI > 28 && c.level < 3) {
        if (Math.random() < 0.2) c.level += 1;
      }
      if ((c.type === TYPES.RES || c.type === TYPES.COM) && state.pollution > 45 && c.level > 1) {
        if (Math.random() < 0.11) c.level -= 1;
      }
    }
  }
}

function updateEconomy() {
  const p = getPowerStats();
  state.powerCap = p.cap;
  state.powerUsed = p.used;

  const powerRatio = state.powerUsed === 0 ? 1 : Math.min(1, state.powerCap / state.powerUsed);

  const resBase = state.count.res * 4;
  const comBase = state.count.com * 6;
  const indBase = state.count.ind * 8;

  const parksBoost = state.count.park * 2;
  const overIndPenalty = Math.max(0, state.count.ind - state.count.res) * 1.5;

  state.pollution = Math.max(0, Math.floor(state.count.ind * 6 - state.count.park * 4));

  const cityQuality = 65 + parksBoost - overIndPenalty - state.pollution * 0.15;
  state.happiness = Math.max(20, Math.min(98, Math.floor(cityQuality * powerRatio)));

  state.population = Math.floor(state.count.res * (3 + state.happiness / 50) * powerRatio);

  const cityIncome = Math.floor((resBase + comBase + indBase) * (state.happiness / 100) * powerRatio * state.cityIncomeMultiplier);
  const passiveIncome = state.passiveFlat;
  state.passivePerCycle = Math.floor(passiveIncome * state.incomeMultiplier);

  const upkeep = state.count.road + state.count.power * 5 + state.count.park * 2;
  const totalIncome = Math.floor((cityIncome + passiveIncome) * state.incomeMultiplier);

  state.credits += totalIncome - upkeep;
  if (state.credits < -100) state.credits = -100;

  state.demandR = Math.max(0, 65 - state.count.res * 3 + state.count.com * 1.2);
  state.demandC = Math.max(0, 60 - state.count.com * 3 + state.count.res * 1.1);
  state.demandI = Math.max(0, 55 - state.count.ind * 2.2 + state.count.com * 0.9);

  growthPass();
  evaluateTasks();
  state.cycle += 1;
  ui.clock.textContent = `Cycle ${state.cycle}`;
}

function evaluateTasks() {
  let changed = false;
  for (const task of tasks) {
    if (!task.done && task.check(state)) {
      task.done = true;
      changed = true;
      setStatus(`Task ready: ${task.text}. Claim reward in Tasks panel.`, 2600);
    }
  }
  if (changed) renderTasks();
}

function claimTask(index) {
  const task = tasks[index];
  if (!task || !task.done || task.claimed) return;
  task.claimed = true;
  state.credits += task.reward;
  setStatus(`Task claimed: +${task.reward} credits.`, 2400);
  renderTasks();
}

function clickCore() {
  const gain = Math.floor(state.clickValue * state.incomeMultiplier);
  state.credits += gain;
  state.totalTaps += 1;
  if (state.totalTaps % 6 === 0) {
    setStatus(`Fusion Core output +${gain} credits.`);
  }
  evaluateTasks();
}

function buyUpgrade(index) {
  const upgrade = upgrades[index];
  if (!upgrade || upgrade.bought) return;
  if (state.credits < upgrade.cost) {
    setStatus("Not enough credits for that upgrade.");
    return;
  }
  state.credits -= upgrade.cost;
  upgrade.bought = true;
  upgrade.apply(state);
  setStatus(`Upgrade purchased: ${upgrade.name}.`);
  renderUpgrades();
}

function spawnTraffic() {
  if (state.count.road < 4) return;
  if (cars.length > 24) return;

  if (Math.random() < 0.18) {
    let attempts = 30;
    while (attempts > 0) {
      attempts -= 1;
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (grid[y][x].type === TYPES.ROAD) {
        cars.push({
          x: x + 0.5,
          y: y + 0.5,
          dir: Math.floor(Math.random() * 4),
          speed: 0.03 + Math.random() * 0.03,
          hue: Math.random() < 0.5 ? "#89f4ff" : "#ff7ee8"
        });
        break;
      }
    }
  }

  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const car = cars[i];
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ];
    const [dx, dy] = dirs[car.dir];
    car.x += dx * car.speed;
    car.y += dy * car.speed;

    const cx = Math.floor(car.x);
    const cy = Math.floor(car.y);

    if (!inBounds(cx, cy) || grid[cy][cx].type !== TYPES.ROAD) {
      car.dir = Math.floor(Math.random() * 4);
      car.x -= dx * car.speed * 2;
      car.y -= dy * car.speed * 2;
    } else if (Math.random() < 0.08) {
      car.dir = Math.floor(Math.random() * 4);
    }

    if (car.x < -1 || car.y < -1 || car.x > GRID_W + 1 || car.y > GRID_H + 1) {
      cars.splice(i, 1);
    }
  }
}

function drawTile(x, y, cell) {
  const px = OFF_X + x * TILE;
  const py = OFF_Y + y * TILE;

  if (cell.type === TYPES.EMPTY) {
    ctx.fillStyle = "#4f7a42";
    ctx.fillRect(px, py, TILE - 1, TILE - 1);
    ctx.fillStyle = "rgba(142, 214, 113, 0.16)";
    ctx.fillRect(px + 4, py + 4, TILE - 10, TILE - 10);
    return;
  }

  if (cell.type === TYPES.ROAD) {
    ctx.fillStyle = "#b9a37a";
    ctx.fillRect(px, py, TILE - 1, TILE - 1);
    ctx.fillStyle = "#98835f";
    for (let yy = 2; yy < TILE; yy += 6) {
      ctx.fillRect(px + 2, py + yy, TILE - 6, 2);
    }
    return;
  }

  if (cell.type === TYPES.POWER) {
    ctx.fillStyle = "#6f8e5d";
    ctx.fillRect(px + 2, py + 2, TILE - 5, TILE - 5);
    ctx.fillStyle = "#a9f7ff";
    ctx.fillRect(px + 14, py + 5, 4, TILE - 12);
    ctx.fillRect(px + 10, py + 10, 12, 4);
    return;
  }

  if (cell.type === TYPES.PARK) {
    ctx.fillStyle = "#3c7a3a";
    ctx.fillRect(px + 2, py + 2, TILE - 5, TILE - 5);
    ctx.fillStyle = "#9ce88f";
    ctx.fillRect(px + 8, py + 8, 7, 7);
    ctx.fillRect(px + 17, py + 12, 7, 7);
    return;
  }

  ctx.fillStyle = "#6a5638";
  ctx.fillRect(px, py, TILE - 1, TILE - 1);

  let c1 = "#66de8a";
  let c2 = "#4ebd73";
  if (cell.type === TYPES.COM) {
    c1 = "#68d4ff";
    c2 = "#4aa8e5";
  }
  if (cell.type === TYPES.IND) {
    c1 = "#f4b167";
    c2 = "#d99145";
  }

  ctx.fillStyle = c1;
  for (let xx = 5; xx < TILE - 4; xx += 7) {
    ctx.fillRect(px + xx, py + 4, 4, TILE - 8);
  }
  ctx.fillStyle = c2;
  ctx.fillRect(px + 3, py + 3, TILE - 7, 4);

  if (cell.level >= 2) {
    ctx.fillStyle = "#f2f2be";
    ctx.fillRect(px + 12, py + 13, 8, 6);
  }
  if (cell.level >= 3) {
    ctx.fillStyle = "#cc4ad6";
    ctx.fillRect(px + 14, py + 10, 4, 4);
  }
}

function drawCars() {
  for (const car of cars) {
    const px = OFF_X + car.x * TILE;
    const py = OFF_Y + car.y * TILE;
    ctx.fillStyle = car.hue;
    ctx.fillRect(px - 3, py - 2, 6, 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(px + 3, py - 1, 5, 2);
  }
}

function drawPlayer() {
  const px = OFF_X + state.player.x * TILE;
  const py = OFF_Y + state.player.y * TILE;
  ctx.fillStyle = "#2f62aa";
  ctx.fillRect(px + 11, py + 12, 10, 11);
  ctx.fillStyle = "#f3c09b";
  ctx.fillRect(px + 12, py + 8, 8, 5);
  ctx.fillStyle = "#533720";
  ctx.fillRect(px + 12, py + 7, 8, 2);
}

function drawHover() {
  const px = OFF_X + state.player.x * TILE;
  const py = OFF_Y + state.player.y * TILE;
  ctx.strokeStyle = "#f8e67d";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8cc8ff");
  sky.addColorStop(0.55, "#78b06b");
  sky.addColorStop(1, "#3a5f31");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      drawTile(x, y, grid[y][x]);
    }
  }

  drawCars();
  drawHover();
  drawPlayer();

  if (state.paused) {
    ctx.fillStyle = "rgba(20, 20, 20, 0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff9e5";
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText("PAUSED", 420, 320);
  }
}

function updateUI() {
  ui.credits.textContent = Math.floor(state.credits).toString();
  ui.population.textContent = state.population.toString();
  ui.happiness.textContent = `${state.happiness}%`;
  ui.power.textContent = `${state.powerUsed} / ${state.powerCap}`;
  ui.pollution.textContent = state.pollution.toString();
  ui.demand.textContent = `${Math.floor(state.demandR)} / ${Math.floor(state.demandC)} / ${Math.floor(state.demandI)}`;
  ui.tapValue.textContent = Math.floor(state.clickValue * state.incomeMultiplier).toString();
  ui.passiveRate.textContent = state.passivePerCycle.toString();

  if (performance.now() > state.statusUntil) {
    ui.status.textContent = "Click Harvest Credits for fast cash, then reinvest in upgrades and zones.";
  }
}

function renderTasks() {
  ui.objectives.innerHTML = "";
  tasks.forEach((task, i) => {
    const li = document.createElement("li");

    const text = document.createElement("span");
    const progress = task.progress(state);
    text.textContent = `${task.text} [${progress}]`;
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

function renderUpgrades() {
  ui.upgrades.innerHTML = "";
  upgrades.forEach((upgrade, i) => {
    const li = document.createElement("li");

    const label = document.createElement("div");
    label.textContent = `${upgrade.name} (${upgrade.cost}) - ${upgrade.desc}`;

    const button = document.createElement("button");
    button.className = "upgrade-button";
    if (upgrade.bought) {
      button.textContent = "Owned";
      button.disabled = true;
    } else {
      button.textContent = "Buy";
      button.disabled = state.credits < upgrade.cost;
      button.addEventListener("click", () => buyUpgrade(i));
    }

    li.appendChild(label);
    li.appendChild(button);
    ui.upgrades.appendChild(li);
  });
}

function keyToMove(key) {
  if (key === "ArrowUp" || key === "w") return { dx: 0, dy: -1 };
  if (key === "ArrowDown" || key === "s") return { dx: 0, dy: 1 };
  if (key === "ArrowLeft" || key === "a") return { dx: -1, dy: 0 };
  if (key === "ArrowRight" || key === "d") return { dx: 1, dy: 0 };
  return null;
}

function gameLoop() {
  if (!state.paused) {
    state.ticks += 1;
    spawnTraffic();

    if (state.ticks % 60 === 0) {
      updateEconomy();
    }
  }

  render();
  updateUI();
  renderUpgrades();
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

  const movement = keyToMove(key);
  if (movement) {
    if (!e.repeat) {
      attemptMove(movement.dx, movement.dy);
    }
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

renderPalette();
renderTasks();
updateCounts();
updateEconomy();
renderUpgrades();
gameLoop();
