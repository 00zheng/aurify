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
  clock: document.getElementById("clock")
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
  { key: "1", type: TYPES.ROAD, name: "Sky Road", cost: 8 },
  { key: "2", type: TYPES.RES, name: "Neon Homes", cost: 45 },
  { key: "3", type: TYPES.COM, name: "Holo Mall", cost: 70 },
  { key: "4", type: TYPES.IND, name: "Fusion Lab", cost: 95 },
  { key: "5", type: TYPES.POWER, name: "Solar Spire", cost: 120 },
  { key: "6", type: TYPES.PARK, name: "Zen Garden", cost: 55 }
];

const objectives = [
  { text: "Reach population 30", done: false, check: (s) => s.population >= 30 },
  { text: "Maintain happiness above 70%", done: false, check: (s) => s.happiness >= 70 },
  { text: "Build 6 roads and 1 power plant", done: false, check: (s) => s.count.road >= 6 && s.count.power >= 1 },
  { text: "Earn 1000 credits", done: false, check: (s) => s.credits >= 1000 },
  { text: "Hit population 100 (win)", done: false, check: (s) => s.population >= 100 }
];

let state = {
  credits: 350,
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
  hover: { x: 0, y: 0 },
  player: { x: 2, y: 2, moveTimer: 0 },
  count: { road: 0, res: 0, com: 0, ind: 0, power: 0, park: 0 },
  statusUntil: 0,
  statusText: "Scout the map with your mayor drone, then build your first district."
};

const grid = Array.from({ length: GRID_H }, (_, y) =>
  Array.from({ length: GRID_W }, (_, x) => ({
    type: TYPES.EMPTY,
    level: 0,
    traffic: Math.random() * 0.2,
    glow: (x + y) % 3 === 0 ? Math.random() : 0.1
  }))
);

const keys = new Set();
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
    setStatus("Insufficient credits.");
    return;
  }
  if (choice.type !== TYPES.ROAD && !hasAdjacentRoad(x, y)) {
    setStatus("Zone needs a road connection.");
    return;
  }

  state.credits -= choice.cost;
  cell.type = choice.type;
  cell.level = 1;
  setStatus(`Built ${choice.name}.`);
  updateCounts();
}

function bulldozeAt(x, y) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type === TYPES.EMPTY) return;
  cell.type = TYPES.EMPTY;
  cell.level = 0;
  state.credits += 6;
  setStatus("Tile cleared. +6 credits salvage.");
  updateCounts();
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

  const residents = Math.floor(state.count.res * (3 + state.happiness / 50) * powerRatio);
  state.population = residents;

  const income = Math.floor((resBase + comBase + indBase) * (state.happiness / 100) * powerRatio);
  const upkeep = state.count.road + state.count.power * 5 + state.count.park * 2;

  state.credits += income - upkeep;
  if (state.credits < -100) state.credits = -100;

  state.demandR = Math.max(0, 65 - state.count.res * 3 + state.count.com * 1.2);
  state.demandC = Math.max(0, 60 - state.count.com * 3 + state.count.res * 1.1);
  state.demandI = Math.max(0, 55 - state.count.ind * 2.2 + state.count.com * 0.9);

  growthPass();
  evaluateObjectives();

  state.cycle += 1;
  ui.clock.textContent = `Cycle ${state.cycle}`;
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

function evaluateObjectives() {
  let completedNow = false;
  for (const obj of objectives) {
    if (!obj.done && obj.check(state)) {
      obj.done = true;
      state.credits += 100;
      completedNow = true;
      setStatus(`Objective complete: ${obj.text} (+100 credits)`, 3200);
    }
  }
  if (completedNow) renderObjectives();

  if (objectives[4].done) {
    setStatus("You built a thriving neon utopia. Victory achieved.", 5000);
  }
}

function spawnTraffic() {
  if (state.count.road < 4) return;
  if (cars.length > 28) return;

  if (Math.random() < 0.22) {
    let attempts = 30;
    while (attempts > 0) {
      attempts -= 1;
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (grid[y][x].type === TYPES.ROAD) {
        cars.push({ x: x + 0.5, y: y + 0.5, dir: Math.floor(Math.random() * 4), speed: 0.04 + Math.random() * 0.04, hue: Math.random() < 0.5 ? "#68f6ff" : "#ff7cf9" });
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

  ctx.fillStyle = "#08132f";
  ctx.fillRect(px, py, TILE - 1, TILE - 1);

  if (cell.type === TYPES.EMPTY) {
    const pulse = 12 + Math.sin((state.ticks + x + y) * 0.1) * 8;
    ctx.fillStyle = `rgba(58, 153, 255, ${0.08 + cell.glow * 0.09})`;
    ctx.fillRect(px + 8, py + 8, pulse * 0.28, pulse * 0.28);
    return;
  }

  if (cell.type === TYPES.ROAD) {
    ctx.fillStyle = "#1a2d54";
    ctx.fillRect(px, py, TILE - 1, TILE - 1);
    ctx.fillStyle = "#4cf8ff";
    ctx.fillRect(px + 4, py + 14, TILE - 10, 2);
    return;
  }

  if (cell.type === TYPES.POWER) {
    ctx.fillStyle = "#173a3d";
    ctx.fillRect(px + 2, py + 2, TILE - 5, TILE - 5);
    ctx.fillStyle = "#8dfff0";
    ctx.fillRect(px + 14, py + 5, 4, TILE - 12);
    ctx.fillRect(px + 10, py + 10, 12, 4);
    return;
  }

  if (cell.type === TYPES.PARK) {
    ctx.fillStyle = "#134a31";
    ctx.fillRect(px + 2, py + 2, TILE - 5, TILE - 5);
    ctx.fillStyle = "#86ffc2";
    ctx.fillRect(px + 8, py + 8, 6, 6);
    ctx.fillRect(px + 16, py + 12, 8, 8);
    return;
  }

  const h = cell.level;
  let c1 = "#4fe7ff";
  let c2 = "#a8f9ff";
  if (cell.type === TYPES.COM) {
    c1 = "#ff74f5";
    c2 = "#ffd0fb";
  }
  if (cell.type === TYPES.IND) {
    c1 = "#f9a34f";
    c2 = "#ffe1be";
  }

  ctx.fillStyle = c1;
  ctx.fillRect(px + 5, py + 6, 6 + h * 5, 20 - h * 2);
  ctx.fillStyle = c2;
  ctx.fillRect(px + 14, py + 4, 10 + h * 2, 22 - h * 3);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(px + 5, py + 6, 2, 20);
}

function drawCars() {
  for (const car of cars) {
    const px = OFF_X + car.x * TILE;
    const py = OFF_Y + car.y * TILE;
    ctx.fillStyle = car.hue;
    ctx.fillRect(px - 3, py - 2, 6, 4);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(px + 3, py - 1, 6, 2);
  }
}

function drawPlayer() {
  const px = OFF_X + state.player.x * TILE;
  const py = OFF_Y + state.player.y * TILE;
  ctx.fillStyle = "#fff48c";
  ctx.fillRect(px + 10, py + 10, 12, 12);
  ctx.fillStyle = "#222";
  ctx.fillRect(px + 13, py + 13, 2, 2);
  ctx.fillRect(px + 17, py + 13, 2, 2);
}

function drawHover() {
  const x = state.player.x;
  const y = state.player.y;
  const px = OFF_X + x * TILE;
  const py = OFF_Y + y * TILE;
  ctx.strokeStyle = "#f0ff8f";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#0a1a3b");
  skyGrad.addColorStop(1, "#030710");
  ctx.fillStyle = skyGrad;
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
    ctx.fillStyle = "rgba(3, 8, 20, 0.66)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
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

  if (performance.now() > state.statusUntil) {
    ui.status.textContent = "Expand carefully: roads first, then balanced zones and power.";
  }
}

function renderObjectives() {
  ui.objectives.innerHTML = "";
  for (const obj of objectives) {
    const li = document.createElement("li");
    li.textContent = obj.done ? `DONE - ${obj.text}` : obj.text;
    li.style.color = obj.done ? "#7effbf" : "#e8f3ff";
    ui.objectives.appendChild(li);
  }
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

function movePlayer() {
  if (state.player.moveTimer > 0) {
    state.player.moveTimer -= 1;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowUp")) dy = -1;
  if (keys.has("ArrowDown")) dy = 1;
  if (keys.has("ArrowLeft")) dx = -1;
  if (keys.has("ArrowRight")) dx = 1;

  if (dx !== 0 || dy !== 0) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    if (inBounds(nx, ny)) {
      state.player.x = nx;
      state.player.y = ny;
    }
    state.player.moveTimer = 4;
  }
}

function gameLoop() {
  if (!state.paused) {
    state.ticks += 1;
    movePlayer();
    spawnTraffic();

    if (state.ticks % 60 === 0) {
      updateEconomy();
    }
  }

  render();
  updateUI();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === "p" || e.key === "P") {
    state.paused = !state.paused;
    setStatus(state.paused ? "Simulation paused." : "Simulation resumed.");
    return;
  }

  if (e.key === "x" || e.key === "X") {
    bulldozeAt(state.player.x, state.player.y);
    return;
  }

  const ix = BUILDINGS.findIndex((b) => b.key === e.key);
  if (ix >= 0) {
    state.selected = ix;
    renderPalette();
    setStatus(`Selected ${BUILDINGS[ix].name}.`);
    return;
  }

  if (e.key === " ") {
    buildAt(state.player.x, state.player.y);
  }

  keys.add(e.key);
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key);
});

renderPalette();
renderObjectives();
updateCounts();
updateEconomy();
gameLoop();
