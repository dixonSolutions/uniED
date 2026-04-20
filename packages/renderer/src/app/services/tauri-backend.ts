import { invoke } from '@tauri-apps/api/core';
import { createBrowserUniedApi } from './browser-unied-api';

/** Tauri 2 injects window.__TAURI_INTERNALS__ — this is the only reliable check. */
function hasTauriContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
  );
}
import { listen } from '@tauri-apps/api/event';
import {
  TAURI_CMD,
  type AppConfig,
  type FsChangedEvent,
  type FsTreeNode,
  type LokKeyEventPayload,
  type LokMouseEventPayload,
  type LokOpenResult,
  type LokTileRequest,
  type LokTileResult,
  type UniedTauriApi,
} from '@unied/shared-types';

function mapFsEvent(e: string): FsChangedEvent['event'] {
  switch (e) {
    case 'add':
    case 'change':
    case 'unlink':
    case 'addDir':
    case 'unlinkDir':
      return e;
    default:
      return 'change';
  }
}

interface RawFsNode {
  name: string;
  path: string;
  kind: string;
  children?: RawFsNode[];
}

function normalizeTree(nodes: RawFsNode[]): FsTreeNode[] {
  return nodes.map((n) => ({
    name: n.name,
    path: n.path,
    kind: n.kind === 'directory' ? 'directory' : 'file',
    children: n.children ? normalizeTree(n.children) : undefined,
  }));
}

let cachedApi: UniedTauriApi | null = null;

export function getUniedApi(): UniedTauriApi {
  if (!cachedApi) {
    cachedApi = hasTauriContext() ? createUniedTauriApi() : createBrowserUniedApi();
  }
  return cachedApi;
}

export function createUniedTauriApi(): UniedTauriApi {
  return {
    fs: {
      openFolder: () => invoke<string | null>(TAURI_CMD.FS_OPEN_FOLDER),
      readDir: async (rootPath: string) => {
        const raw = await invoke<RawFsNode[]>(TAURI_CMD.FS_READ_DIR, {
          root_path: rootPath,
        });
        return normalizeTree(raw);
      },
      readFile: (filePath: string) =>
        invoke<string>(TAURI_CMD.FS_READ_FILE, { file_path: filePath }),
      writeFile: (filePath: string, content: string) =>
        invoke<void>(TAURI_CMD.FS_WRITE_FILE, { file_path: filePath, content }),
      createFile: (filePath: string, content?: string) =>
        invoke<void>(TAURI_CMD.FS_CREATE_FILE, { file_path: filePath, content }),
      createFolder: (folderPath: string) =>
        invoke<void>(TAURI_CMD.FS_CREATE_FOLDER, { folder_path: folderPath }),
      rename: (oldPath: string, newPath: string) =>
        invoke<void>(TAURI_CMD.FS_RENAME, { old_path: oldPath, new_path: newPath }),
      delete: (targetPath: string) =>
        invoke<void>(TAURI_CMD.FS_DELETE, { target_path: targetPath }),
      watch: (rootPath: string) =>
        invoke<void>(TAURI_CMD.FS_WATCH, { root_path: rootPath }),
      unwatch: (rootPath: string) =>
        invoke<void>(TAURI_CMD.FS_UNWATCH, { root_path: rootPath }),
      onChanged: async (cb: (ev: FsChangedEvent) => void) => {
        const un = await listen<{ path: string; event: string }>(
          'fs-changed',
          (ev) => {
            cb({
              path: ev.payload.path,
              event: mapFsEvent(ev.payload.event),
            });
          }
        );
        return () => {
          un();
        };
      },
    },
    lok: {
      open: (filePath: string) =>
        invoke<LokOpenResult>(TAURI_CMD.LOK_OPEN, { file_path: filePath }),
      close: (docId: number) =>
        invoke<void>(TAURI_CMD.LOK_CLOSE, { doc_id: docId }),
      renderTile: (req: LokTileRequest) =>
        invoke<LokTileResult>(TAURI_CMD.LOK_RENDER_TILE, { req }),
      postKey: (payload: LokKeyEventPayload) =>
        invoke<void>(TAURI_CMD.LOK_POST_KEY, { payload }),
      postMouse: (payload: LokMouseEventPayload) =>
        invoke<void>(TAURI_CMD.LOK_POST_MOUSE, { payload }),
      docSize: (docId: number) =>
        invoke<{ widthTwips: number; heightTwips: number }>(
          TAURI_CMD.LOK_DOC_SIZE,
          { doc_id: docId }
        ),
      command: (cmd: string, args?: unknown) =>
        invoke(TAURI_CMD.LOK_COMMAND, { cmd, args }),
    },
    config: {
      get: () => invoke<AppConfig>(TAURI_CMD.CONFIG_GET),
      set: (partial: Partial<AppConfig>) =>
        invoke<AppConfig>(TAURI_CMD.CONFIG_SET, { partial }),
    },
  };
}
