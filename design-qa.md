**Design QA**

- Date: 2026-07-03
- Scope: compact Public Alpha battle UI, generated raster assets, `/board` compact preview route, iPhone 14 Pro style responsive checks
- Evidence directory: `docs/design/qa-screenshots/2026-07-03/`

**Screenshots**

- `docs/design/qa-screenshots/2026-07-03/player-landscape-before.png`
- `docs/design/qa-screenshots/2026-07-03/player-landscape-after-attack.png`
- `docs/design/qa-screenshots/2026-07-03/board-landscape.png`
- `docs/design/qa-screenshots/2026-07-03/board-portrait.png`

**Automated Visual Checks**

- Player landscape `852x393`: horizontal overflow `0`, vertical overflow `0`
- Player landscape after `撃つ`: horizontal overflow `0`, vertical overflow `0`
- Board landscape `852x393`: horizontal overflow `0`, vertical overflow `0`
- Board portrait `393x852`: horizontal overflow `0`, vertical overflow `0`
- Generated images: all referenced generated PNGs loaded with non-zero natural size
- Combat action feedback: attack beam image, damage number, guard number, turret state classes, and HP changes verified

**Build Checks**

- `git diff --check`: passed
- `npm test`: 5 files passed, 61 tests passed
- `npm run build`: passed

**Findings**

- No P0/P1/P2 visual findings remain for the checked viewports.

**Notes**

- `/board` now uses the compact public battle preview instead of the old tall HostScreen presentation.
- The portrait Player screen still allows vertical scrolling for the full operator workflow; the checked regression target is no horizontal clipping.
