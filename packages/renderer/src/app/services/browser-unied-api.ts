/**
 * When the app runs in a normal browser (no Tauri), `invoke` is unavailable.
 * This implementation uses the File System Access API so you can pick a folder
 * (e.g. Documents) and browse/edit text files like in the desktop shell.
 */
import type {
  AppConfig,
  FsChangedEvent,
  FsTreeNode,
  LokOpenResult,
  UniedTauriApi,
} from '@unied/shared-types';

const CONFIG_KEY = 'unied.browser.config.v1';

const BROWSER_ROOT_PREFIX = 'browser://';

let rootDirHandle: FileSystemDirectoryHandle | null = null;
let rootPathStr: string | null = null;

function joinPath(base: string, name: string): string {
  return `${base}/${name}`;
}

/** Segments relative to the opened root, or null if `fullPath` is not under root. */
function pathSegments(fullPath: string): string[] | null {
  if (!rootPathStr || !fullPath.startsWith(rootPathStr)) return null;
  const rest = fullPath.slice(rootPathStr.length).replace(/^\//, '');
  if (!rest) return [];
  return rest.split('/').filter(Boolean);
}

type DirHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
};

async function listDir(
  dir: FileSystemDirectoryHandle,
  basePath: string
): Promise<FsTreeNode[]> {
  const items: { name: string; kind: 'file' | 'directory' }[] = [];
  for await (const handle of (dir as DirHandle).values()) {
    items.push({ name: handle.name, kind: handle.kind });
  }
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const out: FsTreeNode[] = [];
  for (const { name, kind } of items) {
    const path = joinPath(basePath, name);
    if (kind === 'directory') {
      const sub = await dir.getDirectoryHandle(name);
      const children = await listDir(sub, path);
      out.push({
        name,
        path,
        kind: 'directory',
        children: children.length ? children : undefined,
      });
    } else {
      out.push({ name, path, kind: 'file' });
    }
  }
  return out;
}

async function walkToFile(
  segments: string[]
): Promise<FileSystemFileHandle | null> {
  if (!rootDirHandle || segments.length === 0) return null;
  let dir = rootDirHandle;
  for (let i = 0; i < segments.length - 1; i++) {
    dir = await dir.getDirectoryHandle(segments[i]!);
  }
  try {
    return await dir.getFileHandle(segments[segments.length - 1]!);
  } catch {
    return null;
  }
}

async function walkToDirectory(
  segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
  if (!rootDirHandle) return null;
  if (segments.length === 0) return rootDirHandle;
  let dir = rootDirHandle;
  for (const s of segments) {
    dir = await dir.getDirectoryHandle(s);
  }
  return dir;
}

async function ensureParentDirForFile(
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  if (!rootDirHandle) throw new Error('No folder open');
  let dir = rootDirHandle;
  for (let i = 0; i < segments.length - 1; i++) {
    dir = await dir.getDirectoryHandle(segments[i]!, { create: true });
  }
  return dir;
}

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as AppConfig;
    if (
      parsed.lastWorkspaceFolder &&
      !parsed.lastWorkspaceFolder.startsWith(BROWSER_ROOT_PREFIX)
    ) {
      delete parsed.lastWorkspaceFolder;
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

const lokUnavailable = (): never => {
  throw new Error(
    'LibreOffice editing is only available in the desktop app (Tauri).'
  );
};

export function createBrowserUniedApi(): UniedTauriApi {
  const fsApi = {
    openFolder: async (_defaultDir?: string) => {
        const w = window as Window & {
          showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        };
        if (typeof window === 'undefined' || typeof w.showDirectoryPicker !== 'function') {
          console.warn(
            'File System Access API not available; use Chromium-based browser or the desktop app.'
          );
          return null;
        }
        try {
          const handle = await w.showDirectoryPicker();
          rootDirHandle = handle;
          rootPathStr = `${BROWSER_ROOT_PREFIX}${handle.name}`;
          return rootPathStr;
        } catch {
          return null;
        }
      },

      readDir: async (rootPath: string) => {
        if (
          rootPathStr !== rootPath ||
          !rootDirHandle ||
          !rootPath.startsWith(BROWSER_ROOT_PREFIX)
        ) {
          return [];
        }
        return listDir(rootDirHandle, rootPath);
      },

      readFile: async (filePath: string) => {
        const segs = pathSegments(filePath);
        if (!segs?.length) throw new Error('Invalid path');
        const fh = await walkToFile(segs);
        if (!fh) throw new Error('File not found');
        const file = await fh.getFile();
        return file.text();
      },

    writeFile: async (filePath: string, content: string) => {
        const segs = pathSegments(filePath);
        if (!segs?.length) throw new Error('Invalid path');
        const parent = await ensureParentDirForFile(segs);
        const fh = await parent.getFileHandle(segs[segs.length - 1]!, {
          create: true,
        });
        const writable = await fh.createWritable();
        await writable.write(content);
        await writable.close();
      },

    createFile: async (filePath: string, content = '') => {
        await fsApi.writeFile(filePath, content);
      },

    createFolder: async (folderPath: string) => {
        const segs = pathSegments(folderPath);
        if (!segs) throw new Error('Invalid path');
        if (!rootDirHandle) throw new Error('No folder open');
        let dir = rootDirHandle;
        for (const s of segs) {
          dir = await dir.getDirectoryHandle(s, { create: true });
        }
      },

    rename: async (oldPath: string, newPath: string) => {
        const oldSegs = pathSegments(oldPath);
        const newSegs = pathSegments(newPath);
        if (!oldSegs?.length || !newSegs?.length) {
          throw new Error('Invalid path');
        }
        const oldName = oldSegs[oldSegs.length - 1]!;
        const newName = newSegs[newSegs.length - 1]!;
        const oldParent = await walkToDirectory(oldSegs.slice(0, -1));
        const newParent = await walkToDirectory(newSegs.slice(0, -1));
        if (!oldParent || !newParent) throw new Error('Path not found');
        let handle: FileSystemHandle;
        try {
          handle = await oldParent.getFileHandle(oldName);
        } catch {
          handle = await oldParent.getDirectoryHandle(oldName);
        }
        type Movable = FileSystemHandle & {
          move?: (
            destination: FileSystemDirectoryHandle,
            name?: string
          ) => Promise<void>;
        };
        const mv = (handle as Movable).move;
        if (typeof mv === 'function') {
          await mv.call(handle, newParent, newName);
          return;
        }
        throw new Error(
          'Rename is not supported in this browser (missing FileSystemHandle.move).'
        );
      },

    delete: async (targetPath: string) => {
        const segs = pathSegments(targetPath);
        if (!segs?.length) throw new Error('Invalid path');
        const name = segs[segs.length - 1]!;
        const parentSegs = segs.slice(0, -1);
        const parent = await walkToDirectory(parentSegs);
        if (!parent) throw new Error('Path not found');
        await parent.removeEntry(name, { recursive: true });
      },

    watch: async () => {
        /* no file watcher in browser */
      },

    unwatch: async () => {
        /* noop */
      },

    onChanged: async (_cb: (ev: FsChangedEvent) => void) => {
        return () => {
          /* noop */
        };
      },
  };

  return {
    fs: fsApi,

    lok: {
      open: async (_filePath: string): Promise<LokOpenResult> => lokUnavailable(),
      close: async (_docId: number) => lokUnavailable(),
      renderTile: async (..._args: unknown[]) => lokUnavailable() as string,
      postMouse: async (..._args: unknown[]) => lokUnavailable(),
      postKey: async (..._args: unknown[]) => lokUnavailable(),
      command: async (_cmd: string, _args?: unknown) => lokUnavailable(),
    },

    config: {
      get: async () => {
        const c = loadConfig();
        if (
          c.lastWorkspaceFolder?.startsWith(BROWSER_ROOT_PREFIX) &&
          !rootDirHandle
        ) {
          const next = { ...c, lastWorkspaceFolder: undefined };
          saveConfig(next);
          return next;
        }
        return c;
      },
      set: async (partial: Partial<AppConfig>) => {
        const next = { ...loadConfig(), ...partial };
        saveConfig(next);
        return next;
      },
    },
  };
}
