# Development

## Prerequisites

- Node.js 18+
- Rust (`rustup`) and system libraries for Tauri ([prerequisites](https://v2.tauri.app/start/prerequisites/))

## Install

```bash
npm install
```

## Run (Tauri + built UI)

```bash
npm run dev
```

This runs `beforeDevCommand` from [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json): `npm run dev:static` at the repo root (production build + [`serve`](https://www.npmjs.com/package/serve) on port 4200). It does **not** use `ng serve`. The Tauri window loads `http://127.0.0.1:4200`.

Use `npm run tauri:dev` as an alias. **`npm tauri dev` is not valid npm syntax** — use `npm run dev` or `npm run tauri:dev`.

## Build frontend only

```bash
npm run build
```

Output: `packages/renderer/dist/renderer/browser/`.

## Build desktop bundle

```bash
npm run build
cargo tauri build
```

(Run `cargo tauri build` from the repository root; the CLI picks up `src-tauri/`.)

## Project layout

- **UI**: PrimeNG (`p-splitter`, `p-tree`, `p-toolbar`, `p-button`, `p-panel`, …)
- **Editor routing**: `editor-kind.ts` chooses CodeMirror vs LOK viewer by extension
- **Backend API**: `packages/renderer/src/app/services/tauri-backend.ts` maps `invoke` / `listen` to typed helpers

## Troubleshooting

- If styles fail to load, ensure hoisted `node_modules` paths in `packages/renderer/angular.json` match your layout (`../../node_modules/...`).
- If Tauri cannot find the built UI, confirm `frontendDist` in `src-tauri/tauri.conf.json` points to `packages/renderer/dist/renderer/browser`.
