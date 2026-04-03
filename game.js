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
  dropperCount: document.getElementById("dropper-count"),
  coreCount: document.getElementById("core-count"),
  conveyorCount: document.getElementById("conveyor-count"),
  factoryRate: document.getElementById("factory-rate")
};

const TILE = 48;
const WORLD_W = 90;
const WORLD_H = 90;

const TYPES = {
  EMPTY: "empty",
  ROAD: "road",
  RES: "res",
  COM: "com",
  IND: "ind",
  POWER: "power",
  PARK: "park",
  DROPPER: "dropper",
  CORE: "core",
  CONVEYOR: "conveyor"
};

const BUILDINGS = [
  { key: "1", type: TYPES.ROAD, name: "Stone Walkway", cost: 7 },
  { key: "2", type: TYPES.RES, name: "Sky Cottages", cost: 42 },
  { key: "3", type: TYPES.COM, name: "Bazaar Hub", cost: 70 },
  { key: "4", type: TYPES.IND, name: "Fabricator", cost: 94 },
  { key: "5", type: TYPES.POWER, name: "Sun Reactor", cost: 120 },
  { key: "6", type: TYPES.PARK, name: "Garden Pod", cost: 55 },
  { key: "7", type: TYPES.DROPPER, name: "Money Dropper", cost: 60 },
  { key: "8", type: TYPES.CORE, name: "Fusion Core", cost: 95 }
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
    text: "Upgrade any factory tile to Lv 4",
    reward: 260,
    done: false,
    claimed: false,
    check: (s) => s.maxFactoryLevel >= 4,
    progress: (s) => `${Math.min(s.maxFactoryLevel, 4)}/4`
  },
  {
    text: "Reach factory income 45/cycle",
    reward: 320,
    done: false,
    claimed: false,
    check: (s) => s.passivePerCycle >= 45,
    progress: (s) => `${Math.min(s.passivePerCycle, 45)}/45`
  },
  {
    text: "Reach 2000 credits",
    reward: 500,
    done: false,
    claimed: false,
    check: (s) => s.credits >= 2000,
    progress: (s) => `${Math.min(Math.floor(s.credits), 2000)}/2000`
  }
];

let state = {
  credits: 160,
  population: 0,
  happiness: 60,
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
  player: { x: 45, y: 45 },
  camera: { x: 0, y: 0 },
  count: {
    road: 0,
    res: 0,
    com: 0,
    ind: 0,
    power: 0,
    park: 0,
    dropper: 0,
    core: 0,
    conveyor: 0
  },
  statusUntil: 0,
  statusText: "Build droppers and cores on the map, then press E to upgrade them.",
  clickValue: 1,
  totalTaps: 0,
  passivePerCycle: 0,
  maxFactoryLevel: 1
};

const grid = Array.from({ length: WORLD_H }, () =>
  Array.from({ length: WORLD_W }, () => ({
    type: TYPES.EMPTY,
    level: 1,
    glow: Math.random()
  }))
);

const cars = [];

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
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

seedStarterRoads();

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
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

function setStatus(text, ms = 2000) {
  state.statusText = text;
  state.statusUntil = performance.now() + ms;
  ui.status.textContent = text;
}

function canBuildWithoutRoad(type) {
  return type === TYPES.ROAD || type === TYPES.DROPPER || type === TYPES.CORE || type === TYPES.CONVEYOR;
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

  if (!canBuildWithoutRoad(choice.type) && !hasAdjacentRoad(x, y)) {
    setStatus("Connect this tile to a road first.");
    return;
  }

  state.credits -= choice.cost;
  cell.type = choice.type;
  cell.level = 1;

  if (choice.type === TYPES.DROPPER || choice.type === TYPES.CORE) {
    if (!hasAdjacentConveyor(x, y)) {
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
  }

  updateCounts();
  evaluateTasks();
  setStatus(`Built ${choice.name}.`);
}

function bulldozeAt(x, y) {
  if (!inBounds(x, y)) return;
  const cell = grid[y][x];
  if (cell.type === TYPES.EMPTY) return;

  const refund = cell.type === TYPES.DROPPER || cell.type === TYPES.CORE || cell.type === TYPES.CONVEYOR ? 16 : 6;
  cell.type = TYPES.EMPTY;
  cell.level = 1;
  state.credits += refund;
  updateCounts();
  evaluateTasks();
  setStatus(`Tile cleared. +${refund} credits salvage.`);
}

function attemptMove(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!inBounds(nx, ny)) return;
  state.player.x = nx;
  state.player.y = ny;
}

function getFactoryUpgradeCost(cell) {
  if (cell.type === TYPES.DROPPER) return Math.floor(45 * 1.4 ** (cell.level - 1));
  if (cell.type === TYPES.CORE) return Math.floor(65 * 1.45 ** (cell.level - 1));
  if (cell.type === TYPES.CONVEYOR) return Math.floor(40 * 1.35 ** (cell.level - 1));
  return 0;
}

function interactTile() {
  const cell = grid[state.player.y][state.player.x];

  if (cell.type === TYPES.CORE) {
    const gain = Math.floor(cell.level * state.clickValue * 2.5);
    state.credits += gain;
    state.totalTaps += 1;
    setStatus(`Fusion Core harvested +${gain} credits.`);
    evaluateTasks();
    return;
  }

  if (cell.type === TYPES.DROPPER || cell.type === TYPES.CONVEYOR) {
    const cost = getFactoryUpgradeCost(cell);
    if (state.credits < cost) {
      setStatus(`Need ${cost} credits to upgrade this ${cell.type}.`);
      return;
    }

    state.credits -= cost;
    cell.level += 1;
    state.maxFactoryLevel = Math.max(state.maxFactoryLevel, cell.level);
    updateCounts();
    evaluateTasks();
    setStatus(`${cell.type} upgraded to Lv ${cell.level}.`);
    return;
  }

  setStatus("No interactive factory building here.");
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
      if (c.type === TYPES.DROPPER) used += 1;
      if (c.type === TYPES.CORE) used += 1;
      if (c.type === TYPES.CONVEYOR) used += 1;
    }
  }

  return { cap, used };
}

function updateCounts() {
  state.count = {
    road: 0,
    res: 0,
    com: 0,
    ind: 0,
    power: 0,
    park: 0,
    dropper: 0,
    core: 0,
    conveyor: 0
  };

  state.maxFactoryLevel = 1;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TYPES.ROAD) state.count.road += 1;
      if (cell.type === TYPES.RES) state.count.res += 1;
      if (cell.type === TYPES.COM) state.count.com += 1;
      if (cell.type === TYPES.IND) state.count.ind += 1;
      if (cell.type === TYPES.POWER) state.count.power += 1;
      if (cell.type === TYPES.PARK) state.count.park += 1;
      if (cell.type === TYPES.DROPPER) state.count.dropper += 1;
      if (cell.type === TYPES.CORE) state.count.core += 1;
      if (cell.type === TYPES.CONVEYOR) state.count.conveyor += 1;

      if (cell.type === TYPES.DROPPER || cell.type === TYPES.CORE || cell.type === TYPES.CONVEYOR) {
        state.maxFactoryLevel = Math.max(state.maxFactoryLevel, cell.level);
      }
    }
  }
}

function calcFactoryIncome() {
  let raw = 0;
  let coreBoost = 1;
  let conveyorBoost = 1;

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const cell = grid[y][x];

      if (cell.type === TYPES.CORE) {
        coreBoost += cell.level * 0.09;
      }
      if (cell.type === TYPES.CONVEYOR) {
        conveyorBoost += cell.level * 0.03;
      }
    }
  }

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const cell = grid[y][x];
      if (cell.type !== TYPES.DROPPER) continue;

      const base = cell.level * (1 + (cell.level - 1) * 0.18);
      const local = hasAdjacentConveyor(x, y) ? 1.35 : 1;
      raw += base * local;
    }
  }

  return Math.floor(raw * coreBoost * conveyorBoost);
}

function growthPass() {
  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const c = grid[y][x];
      if (c.type === TYPES.RES && state.demandR > 35 && state.happiness > 62 && c.level < 3) {
        if (Math.random() < 0.2) c.level += 1;
      }
      if (c.type === TYPES.COM && state.demandC > 30 && c.level < 3) {
        if (Math.random() < 0.18) c.level += 1;
      }
      if (c.type === TYPES.IND && state.demandI > 28 && c.level < 3) {
        if (Math.random() < 0.16) c.level += 1;
      }
      if ((c.type === TYPES.RES || c.type === TYPES.COM) && state.pollution > 45 && c.level > 1) {
        if (Math.random() < 0.09) c.level -= 1;
      }
    }
  }
}

function updateEconomy() {
  updateCounts();

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

  const cityIncome = Math.floor((resBase + comBase + indBase) * (state.happiness / 100) * powerRatio);
  const factoryIncome = calcFactoryIncome();
  state.passivePerCycle = factoryIncome;

  const upkeep = state.count.road + state.count.power * 5 + state.count.park * 2 + state.count.conveyor;
  const totalIncome = cityIncome + factoryIncome;

  state.credits = Math.max(0, state.credits + totalIncome - upkeep);
  state.demandR = Math.max(0, 65 - state.count.res * 3 + state.count.com * 1.2);
  state.demandC = Math.max(0, 60 - state.count.com * 3 + state.count.res * 1.1);
  state.demandI = Math.max(0, 55 - state.count.ind * 2.2 + state.count.com * 0.9);

  state.clickValue = 1 + Math.floor(state.count.core * 0.4 + state.maxFactoryLevel * 0.25);

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
  const gain = Math.max(1, Math.floor(state.clickValue));
  state.credits += gain;
  state.totalTaps += 1;
  updateUI();
  if (state.totalTaps % 6 === 0) {
    setStatus(`Harvested +${gain} credits.`);
  }
  evaluateTasks();
}

function updateCamera() {
  const targetX = state.player.x * TILE - canvas.width / 2 + TILE / 2;
  const targetY = state.player.y * TILE - canvas.height / 2 + TILE / 2;

  const maxX = WORLD_W * TILE - canvas.width;
  const maxY = WORLD_H * TILE - canvas.height;

  state.camera.x = Math.max(0, Math.min(maxX, targetX));
  state.camera.y = Math.max(0, Math.min(maxY, targetY));
}

function spawnTraffic() {
  if (state.count.road < 4) return;
  if (cars.length > 40) return;

  if (Math.random() < 0.16) {
    let attempts = 35;
    while (attempts > 0) {
      attempts -= 1;
      const x = Math.floor(Math.random() * WORLD_W);
      const y = Math.floor(Math.random() * WORLD_H);
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

    if (car.x < -2 || car.y < -2 || car.x > WORLD_W + 2 || car.y > WORLD_H + 2) {
      cars.splice(i, 1);
    }
  }
}

function drawTile(x, y, cell) {
  const px = x * TILE - state.camera.x;
  const py = y * TILE - state.camera.y;

  if (px > canvas.width || py > canvas.height || px < -TILE || py < -TILE) {
    return;
  }

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

  if (cell.type === TYPES.POWER) {
    ctx.fillStyle = "#6f8e5d";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#a9f7ff";
    ctx.fillRect(px + 21, py + 8, 6, TILE - 16);
    ctx.fillRect(px + 15, py + 15, 18, 5);
    return;
  }

  if (cell.type === TYPES.PARK) {
    ctx.fillStyle = "#3c7a3a";
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#9ce88f";
    ctx.fillRect(px + 12, py + 12, 9, 9);
    ctx.fillRect(px + 24, py + 16, 9, 9);
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
    ctx.fillStyle = "#231e31";
    ctx.font = "12px Rajdhani";
    ctx.fillText(`L${cell.level}`, px + 3, py + 14);
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
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "12px Rajdhani";
    ctx.fillText(`L${cell.level}`, px + 3, py + 14);
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
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "12px Rajdhani";
    ctx.fillText(`L${cell.level}`, px + 3, py + 14);
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
  for (let xx = 8; xx < TILE - 8; xx += 10) {
    ctx.fillRect(px + xx, py + 6, 6, TILE - 12);
  }
  ctx.fillStyle = c2;
  ctx.fillRect(px + 5, py + 5, TILE - 10, 6);
}

function drawCars() {
  for (const car of cars) {
    const px = car.x * TILE - state.camera.x;
    const py = car.y * TILE - state.camera.y;
    ctx.fillStyle = car.hue;
    ctx.fillRect(px - 4, py - 2, 8, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(px + 4, py - 1, 7, 3);
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

  drawCars();
  drawHover();
  drawPlayer();

  const worldInfo = `Tile ${state.player.x},${state.player.y} | World ${WORLD_W}x${WORLD_H}`;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(10, canvas.height - 32, 260, 22);
  ctx.fillStyle = "#f0f9ff";
  ctx.font = "14px Rajdhani";
  ctx.fillText(worldInfo, 16, canvas.height - 16);

  if (state.paused) {
    ctx.fillStyle = "rgba(20, 20, 20, 0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff9e5";
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText("PAUSED", 490, 384);
  }
}

function updateUI() {
  ui.credits.textContent = Math.floor(state.credits).toString();
  ui.population.textContent = state.population.toString();
  ui.happiness.textContent = `${state.happiness}%`;
  ui.power.textContent = `${state.powerUsed} / ${state.powerCap}`;
  ui.pollution.textContent = state.pollution.toString();
  ui.demand.textContent = `${Math.floor(state.demandR)} / ${Math.floor(state.demandC)} / ${Math.floor(state.demandI)}`;

  ui.tapValue.textContent = Math.floor(state.clickValue).toString();
  ui.passiveRate.textContent = state.passivePerCycle.toString();
  ui.dropperCount.textContent = state.count.dropper.toString();
  ui.coreCount.textContent = state.count.core.toString();
  ui.conveyorCount.textContent = state.count.conveyor.toString();
  ui.factoryRate.textContent = state.passivePerCycle.toString();

  if (performance.now() > state.statusUntil) {
    ui.status.textContent = "Build droppers + cores on map, add conveyors, then press E to upgrade factory tiles.";
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
updateCounts();
renderPalette();
renderTasks();
updateEconomy();
gameLoop();
