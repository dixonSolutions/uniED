# uniED architecture

uniED is a **Tauri 2** desktop shell with an **Angular** renderer and **PrimeNG** as the UI component library. There is **no Electron** runtime.

## High-level diagram

```mermaid
flowchart TD
  subgraph ui [Angular UI]
    sidebar[Sidebar p-tree]
    tabs[Tab bar p-toolbar]
    router[Editor pane]
    cm[CodeMirror 6]
    lok[Lok canvas]
  end

  subgraph tauri [Tauri core]
    invoke[invoke commands]
    events[events e.g. fs-changed]
  end

  subgraph rust [Rust backend]
    fs[Filesystem + notify]
    cfg[JSON config in app dir]
    lokstub[LOK stubs]
  end

  sidebar --> tabs
  tabs --> router
  router -->|text/code| cm
  router -->|office formats| lok
  ui --> invoke
  invoke --> rust
  rust --> events
  events --> ui
```

## Packages

| Path | Role |
|------|------|
| `packages/renderer` | Angular app (standalone components), PrimeNG, CodeMirror |
| `packages/shared-types` | Shared TypeScript types and `TAURI_CMD` names |
| `src-tauri` | Rust: commands for FS, config, file watching; LOK placeholders |

## Security

All filesystem and native access is enforced in **Rust**. The webview only calls explicit Tauri commands; paths are validated (absolute paths, etc.) in the backend.

## LibreOfficeKit

LOK integration is **not** implemented in Rust yet. `lok_*` commands return a clear error until a native LO layer is added (e.g. `libloading` of `libmergedlo.so` or a dedicated sidecar). See [LOK_INTEGRATION.md](LOK_INTEGRATION.md).
