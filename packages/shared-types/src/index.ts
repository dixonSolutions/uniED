/**
 * uniED shared types (Tauri commands + payloads).
 * Security: the Rust backend validates paths and operations.
 */

/** Tauri command names match #[tauri::command] fn names in src-tauri */
export const TAURI_CMD = {
  FS_OPEN_FOLDER: 'fs_open_folder',
  FS_READ_DIR: 'fs_read_dir',
  FS_READ_FILE: 'fs_read_file',
  FS_WRITE_FILE: 'fs_write_file',
  FS_CREATE_FILE: 'fs_create_file',
  FS_CREATE_FOLDER: 'fs_create_folder',
  FS_RENAME: 'fs_rename',
  FS_DELETE: 'fs_delete',
  FS_WATCH: 'fs_watch',
  FS_UNWATCH: 'fs_unwatch',

  LOK_OPEN: 'lok_open',
  LOK_CLOSE: 'lok_close',
  LOK_RENDER_TILE: 'lok_render_tile',
  LOK_POST_KEY: 'lok_post_key',
  LOK_POST_MOUSE: 'lok_post_mouse',
  LOK_COMMAND: 'lok_command',
  LOK_DOC_SIZE: 'lok_doc_size',

  CONFIG_GET: 'config_get',
  CONFIG_SET: 'config_set',
} as const;

/** Legacy alias — IPC channel names (documentation only). */
export const IPC = {
  FS_OPEN_FOLDER: 'fs:open-folder',
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_CREATE_FILE: 'fs:create-file',
  FS_CREATE_FOLDER: 'fs:create-folder',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_WATCH: 'fs:watch',
  FS_UNWATCH: 'fs:unwatch',
  FS_CHANGED: 'fs-changed',

  LOK_OPEN: 'lok:open',
  LOK_CLOSE: 'lok:close',
  LOK_RENDER_TILE: 'lok:render-tile',
  LOK_POST_KEY: 'lok:post-key',
  LOK_POST_MOUSE: 'lok:post-mouse',
  LOK_COMMAND: 'lok:command',
  LOK_DOC_SIZE: 'lok:doc-size',

  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface FsTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: FsTreeNode[];
}

export interface FsChangedEvent {
  path: string;
  event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
}

/** Result of lok_open — document ID and full size in twips. */
export interface LokOpenResult {
  docId: number;
  widthTwips: number;
  heightTwips: number;
}

/** Renderer-facing API implemented with Tauri `invoke` / `listen`. */
export interface UniedTauriApi {
  fs: {
    openFolder: (defaultDir?: string) => Promise<string | null>;
    readDir: (rootPath: string) => Promise<FsTreeNode[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    createFile: (filePath: string, content?: string) => Promise<void>;
    createFolder: (folderPath: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    delete: (targetPath: string) => Promise<void>;
    watch: (rootPath: string) => Promise<void>;
    unwatch: (rootPath: string) => Promise<void>;
    onChanged: (cb: (ev: FsChangedEvent) => void) => Promise<() => void>;
  };
  lok: {
    open: (filePath: string) => Promise<LokOpenResult>;
    close: (docId: number) => Promise<void>;
    /** Returns base64-encoded RGBA pixel data (width × height × 4 bytes). */
    renderTile: (
      docId: number,
      canvasW: number, canvasH: number,
      tileX: number,  tileY: number,
      tileW: number,  tileH: number,
    ) => Promise<string>;
    postMouse: (
      docId: number,
      eventType: number, x: number, y: number,
      count: number, buttons: number, modifier: number,
    ) => Promise<void>;
    postKey: (
      docId: number,
      eventType: number, charCode: number, keyCode: number,
    ) => Promise<void>;
    command: (cmd: string, args?: unknown) => Promise<unknown>;
  };
  config: {
    get: () => Promise<AppConfig>;
    set: (partial: Partial<AppConfig>) => Promise<AppConfig>;
  };
}

/** @deprecated Use UniedTauriApi */
export type UniedPreloadApi = UniedTauriApi;

export interface AppConfig {
  lastWorkspaceFolder?: string;
  /** UI chrome theme. Default: dark. */
  theme?: 'light' | 'dark';
  editorFontSize?: number;
  recentFiles?: string[];
}
