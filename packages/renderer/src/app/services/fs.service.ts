import { Injectable } from '@angular/core';
import type { FsChangedEvent, FsTreeNode } from '@unied/shared-types';
import { getUniedApi } from './tauri-backend';

@Injectable({ providedIn: 'root' })
export class FsService {
  openFolder(): Promise<string | null> {
    return getUniedApi().fs.openFolder();
  }

  readDir(rootPath: string): Promise<FsTreeNode[]> {
    return getUniedApi().fs.readDir(rootPath);
  }

  readFile(filePath: string): Promise<string> {
    return getUniedApi().fs.readFile(filePath);
  }

  writeFile(filePath: string, content: string): Promise<void> {
    return getUniedApi().fs.writeFile(filePath, content);
  }

  createFile(filePath: string, content?: string): Promise<void> {
    return getUniedApi().fs.createFile(filePath, content);
  }

  createFolder(folderPath: string): Promise<void> {
    return getUniedApi().fs.createFolder(folderPath);
  }

  rename(oldPath: string, newPath: string): Promise<void> {
    return getUniedApi().fs.rename(oldPath, newPath);
  }

  deletePath(targetPath: string): Promise<void> {
    return getUniedApi().fs.delete(targetPath);
  }

  watch(rootPath: string): Promise<void> {
    return getUniedApi().fs.watch(rootPath);
  }

  onFsChanged(cb: (ev: FsChangedEvent) => void): Promise<() => void> {
    return getUniedApi().fs.onChanged(cb);
  }
}
