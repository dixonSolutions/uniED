# Tauri command & event API

Electron IPC channels are replaced by **Tauri commands** (`invoke`) and **events** (`listen`). Names are listed in `@unied/shared-types` as `TAURI_CMD`.

## Commands (Rust → `invoke`)

| Command | Arguments (JSON keys match Rust param names) | Returns |
|---------|-----------------------------------------------|---------|
| `fs_open_folder` | — | `string \| null` |
| `fs_read_dir` | `root_path` | `FsTreeNode[]` |
| `fs_read_file` | `file_path` | `string` |
| `fs_write_file` | `file_path`, `content` | `void` |
| `fs_create_file` | `file_path`, `content?` | `void` |
| `fs_create_folder` | `folder_path` | `void` |
| `fs_rename` | `old_path`, `new_path` | `void` |
| `fs_delete` | `target_path` | `void` |
| `fs_watch` | `root_path` | `void` |
| `fs_unwatch` | `root_path` | `void` |
| `config_get` | — | `AppConfig` JSON |
| `config_set` | `partial` | merged `AppConfig` |
| `lok_open` | `file_path` | error until implemented |
| `lok_close` | `doc_id` | `void` |
| `lok_render_tile` | `req` | error until implemented |
| `lok_post_key` | `payload` | `void` |
| `lok_post_mouse` | `payload` | `void` |
| `lok_doc_size` | `doc_id` | error until implemented |
| `lok_command` | `cmd`, `args?` | JSON |

## Events

| Event | Payload | Direction |
|-------|---------|-------------|
| `fs-changed` | `{ path, event }` | Rust → renderer |

The Angular `FsService` subscribes via `@tauri-apps/api/event` `listen('fs-changed', ...)`.

## Usage from Angular

Prefer `getUniedApi()` from `tauri-backend.ts` rather than calling `invoke` directly, so argument shapes stay consistent.
