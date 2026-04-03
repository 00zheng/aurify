# Neon Skyline Tycoon

A browser-based 2D pixel tycoon game with arrow-key movement, intuitive progression, and a futuristic utopian cyberpunk visual style.

## Features

- Arrow key movement for the mayor drone cursor
- Build system with 6 tile types:
  - `1` Sky Road
  - `2` Neon Homes (Residential)
  - `3` Holo Mall (Commercial)
  - `4` Fusion Lab (Industrial)
  - `5` Solar Spire (Power)
  - `6` Zen Garden (Park)
- Economic simulation:
  - Credits, population, happiness, pollution, demand, power capacity/usage
- Objective progression and rewards
- Flying-car ambient traffic for cyberpunk atmosphere
- Mobile-friendly layout (desktop-first gameplay)

## Play Controls

- Move drone: `Arrow Keys`
- Build selected structure: `Space`
- Bulldoze tile: `X`
- Pause: `P`
- Change structure: keys `1` to `6`

## Intuitive Progression Path (Recommended Strategy)

1. Extend roads from starter roads.
2. Place 2-3 residential zones.
3. Add 1 commercial zone.
4. Add 1 industrial zone for stronger economy.
5. Add a power plant as soon as power demand rises.
6. Add parks to increase happiness and counter pollution.
7. Keep zones balanced using the demand meter.

## Run Locally

Because this is plain HTML/CSS/JS, you can run it with any static server.

### Option A: VS Code Live Server

1. Install the "Live Server" extension.
2. Open `index.html`.
3. Click "Go Live".

### Option B: Any static hosting server

Serve this folder and open `index.html`.

## Publish On GitHub Pages

1. Push this project to your GitHub repository.
2. In repository settings, open **Pages**.
3. Set source to **Deploy from branch**.
4. Select branch `main` and folder `/ (root)`.
5. Save and wait for deployment.

Your game will be available at:

`https://<your-username>.github.io/<repo-name>/`

## Asset Upgrade Plan (If You Want Custom Models/Designs)

You can ship now with procedural pixel art, then replace visuals tile by tile.

### Pixel Art Specs

- Grid tile size: **32x32 px**
- Suggested style: top-down city tiles with bright emissive accents
- Palette target:
  - Deep navy: `#08132f`
  - Neon cyan: `#4cf8ff`
  - Neon magenta: `#ff74f5`
  - Mint glow: `#8dfff0`
  - Warm tech orange: `#f9a34f`

### What To Design First

1. Roads (`road_32.png`): clean lane marks with glowing strips
2. Residential set (`res_lv1`, `res_lv2`, `res_lv3`)
3. Commercial set (`com_lv1`, `com_lv2`, `com_lv3`)
4. Industrial set (`ind_lv1`, `ind_lv2`, `ind_lv3`)
5. Power plant tile
6. Park tile
7. Drone/player sprite (optional)
8. Flying car sprites (2-3 variants)

### Best Tool Workflow (Beginner Friendly)

1. Open Aseprite or LibreSprite.
2. Create a new 32x32 canvas.
3. Turn on pixel grid and nearest-neighbor scaling.
4. Block silhouette in 2-3 shades.
5. Add emissive windows/strips in neon colors.
6. Add tiny highlights on top edges.
7. Test readability at 1x and 2x zoom.
8. Export PNG with transparent background.

### Integration Checklist

1. Place PNGs in an `assets/tiles/` folder.
2. Add a sprite loader in `game.js`.
3. Swap each tile draw function from procedural rectangles to image draws.
4. Keep logic unchanged so progression remains stable.

## Next Quality Upgrades (Toward Premium Tycoon Depth)

- Zoning brush tools (drag-to-paint roads/zones)
- Multiple maps and scenario goals
- Save/load system (localStorage)
- Disasters/events and policy cards
- Better pathfinding and traffic simulation
- SFX/music and animated billboards
