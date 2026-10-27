# 激流ナゾリバー (web)

Browser port of the Unity game. Vite + TypeScript + three.js; no framework. Hosted at
https://cont.tumbleweed.jp/NazoRiver-web/ (add `?debug=true` for debug tools).

## Commands

- `npm ci`: install dependencies
- `npm run dev`: dev server on :5173
- `npm run build`: typecheck (`tsc --noEmit`) + build to `dist/` (relative base, so it works in any subfolder)
- `npx tsc --noEmit`: typecheck only. `noUnusedLocals`/`noUnusedParameters` are on.

## Layout

- Everything is laid out on a fixed **1920×1080 stage** (`#stage`), scaled to fit in `main.ts`.
  Use `place(node, cx, cy, w, h)` (centre-based) for positioning.
- `src/game.ts`: game state machine (`phase`), produces a `View` each step. `src/hud.ts` renders the View into DOM.
- `src/title.ts` + `src/title.css` + `src/title-logo.svg`: title screen and intro animation (Web Animations API).
- `src/menu.ts` + `src/menu.css`: hamburger menu (volume, record reset, debug jump/clear).
- `src/audio.ts`: Web Audio. BGM/SE volume is saved in localStorage `nazoriver.volume`.
- `src/trophies.ts`: achievements, stored in localStorage `nazoriver.trophies`.
- `src/data/`: questions, stages. `src/modes/`: boss and special stages.
- `public/`: images, audio, fonts (served as-is). `asset("art/x.webp")` resolves a public path.
- `tools/title-art/`: Python pipeline that made the title background and vector logo.

## Gotchas

- The **Wanpaku font is a limited version**: dakuten/handakuten kana (ド, デ, バ, ゾ…) and small kana (ッ, ュ…)
  render as **blank**. Only use it for text you have checked (e.g. オンライン版, Latin). For UI text use
  `"M PLUS Rounded 1c"` (self-hosted via @fontsource, weights 700/800) or `NotoJP`.
- Debug: `?debug=true` exposes `window.__game`, shows the debug section in the menu and the in-game menu button.
  `game.debugJump(level)` jumps to an area; `game.debugClear()` clears the current stage (rivers skip to the fork).
- Overlays in `Hud` are only toggled in `update()`. Anything visible by default shows until the first frame,
  and the first frame waits for `world.ready`, so hide new overlays in the constructor.
- Headless checks: Chromium + Playwright are available (`require('playwright')`). Take screenshots at 1280×720
  and check them. Intro timing: `T_*` constants at the top of `title.ts`.
