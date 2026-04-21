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
  type LokOpenResult,
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
      openFolder: (defaultDir?: string) =>
        invoke<string | null>(TAURI_CMD.FS_OPEN_FOLDER, defaultDir ? { defaultDir } : {}),
      readDir: async (rootPath: string) => {
        const raw = await invoke<RawFsNode[]>(TAURI_CMD.FS_READ_DIR, { rootPath });
        return normalizeTree(raw);
      },
      readFile: (filePath: string) =>
        invoke<string>(TAURI_CMD.FS_READ_FILE, { filePath }),
      writeFile: (filePath: string, content: string) =>
        invoke<void>(TAURI_CMD.FS_WRITE_FILE, { filePath, content }),
      createFile: (filePath: string, content?: string) =>
        invoke<void>(TAURI_CMD.FS_CREATE_FILE, { filePath, content }),
      createFolder: (folderPath: string) =>
        invoke<void>(TAURI_CMD.FS_CREATE_FOLDER, { folderPath }),
      rename: (oldPath: string, newPath: string) =>
        invoke<void>(TAURI_CMD.FS_RENAME, { oldPath, newPath }),
      delete: (targetPath: string) =>
        invoke<void>(TAURI_CMD.FS_DELETE, { targetPath }),
      watch: (rootPath: string) =>
        invoke<void>(TAURI_CMD.FS_WATCH, { rootPath }),
      unwatch: (rootPath: string) =>
        invoke<void>(TAURI_CMD.FS_UNWATCH, { rootPath }),
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
        invoke<LokOpenResult>(TAURI_CMD.LOK_OPEN, { filePath }),
      close: (docId: number) =>
        invoke<void>(TAURI_CMD.LOK_CLOSE, { docId }),
      renderTile: (
        docId: number,
        canvasW: number, canvasH: number,
        tileX: number,  tileY: number,
        tileW: number,  tileH: number,
      ) =>
        invoke<string>(TAURI_CMD.LOK_RENDER_TILE, { docId, canvasW, canvasH, tileX, tileY, tileW, tileH }),
      postMouse: (
        docId: number,
        eventType: number, x: number, y: number,
        count: number, buttons: number, modifier: number,
      ) =>
        invoke<void>(TAURI_CMD.LOK_POST_MOUSE, { docId, eventType, x, y, count, buttons, modifier }),
      postKey: (
        docId: number,
        eventType: number, charCode: number, keyCode: number,
      ) =>
        invoke<void>(TAURI_CMD.LOK_POST_KEY, { docId, eventType, charCode, keyCode }),
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
