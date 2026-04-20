# uniED

Cross-platform desktop editor (**Tauri** + **Angular** + **PrimeNG**): workspace file tree, tabs, **CodeMirror** for text, and LibreOffice document viewing when LOK is integrated in the Rust backend.

## Requirements

- Node.js 18+
- [Rust](https://rustup.rs/) (for Tauri)
- Linux: system dependencies for Tauri/WebKitGTK (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Development (one command)

From the **repository root**:

```bash
npm install
npm start
```

Same as `npm start` (opens the desktop app):

| Command | What it runs |
|--------|----------------|
| `npm start` | `tauri dev` (recommended — standard npm entry) |
| `npm run dev` | `tauri dev` |
| `npm run tauri:dev` | `tauri dev` |
| `npm run tauri -- dev` | `tauri dev` (the `--` forwards `dev` to the CLI) |

**These do not work:** `npm tauri dev`, `npm tauri`, `npm run tauri` alone — npm is not the Tauri CLI. `npm run tauri` with no arguments only prints `tauri --help`.

### What happens on `npm run dev`

1. Tauri runs `beforeDevCommand` from [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).
2. That runs `npm run dev:static` from the repo root: production **build** of shared types + Angular, then the static folder is served on port **4200** with [`serve`](https://www.npmjs.com/package/serve) (not `ng serve`).
3. The Tauri window opens and loads `http://127.0.0.1:4200`.

So you do **not** start a dev server in a second terminal. There is no Angular CLI dev server; reloads require re-running `tauri dev` (or add a watch workflow later).

### Optional: Angular dev server (HMR)

If you want `ng serve` for faster iteration, run in a separate terminal:

```bash
npm run dev:renderer
```

…and point Tauri’s `beforeDevCommand` / `devUrl` at that workflow (restore `beforeDevCommand` to `npm run dev:renderer --prefix ..` in `tauri.conf.json`).

## Build (web UI only)

```bash
npm run build
```

## Tauri bundle

```bash
npm install
npm run build
cargo tauri build
```

(Run from repo root; `npm run build` compiles shared types and the Angular app first.)

## Documentation

See [`docs/`](docs/) for architecture, development, LOK notes, and the command/event API.

## License

MIT
