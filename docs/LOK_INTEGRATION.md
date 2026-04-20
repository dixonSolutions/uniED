# LibreOfficeKit (LOK) integration

## Current status (Tauri)

The **Electron + Node native addon** path was removed when switching to **Tauri**. The Rust crate in `src-tauri` currently exposes `lok_*` **commands** that return a controlled error for open/render paths until a real LOK binding exists.

## Target approach

1. Load the system LibreOffice install (e.g. `libmergedlo.so` under `/usr/lib/libreoffice/program/` on Linux).
2. Call `lok_init_2`, open documents, and use `paintTile` / input hooks similarly to Collabora-style embedders.
3. Implement this in **Rust** via `libloading` + FFI (or a small C/C++ helper built as a shared library), **not** in the old Node `node-gyp` addon.

## Requirements

- LibreOffice installed on the machine.
- Development headers optional for FFI struct layout; align structs with your target LibreOffice version.

## Renderer

The Angular **Lok editor** still expects tile buffers (BGRA) over `lok_render_tile` once the backend is implemented. No change to the canvas pipeline is required beyond successful commands returning real data.
