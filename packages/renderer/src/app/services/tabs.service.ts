import { computed, Injectable, signal } from '@angular/core';
import type { LokOpenResult } from '@unied/shared-types';
import { editorKindForPath, type EditorKind } from '../shared/editor-kind';

export interface EditorTab {
  id: string;
  path: string;
  title: string;
  dirty: boolean;
  kind: EditorKind;
  /** Set after LOK open for lok tabs */
  docId?: number;
  lok?: LokOpenResult;
}

let tabSeq = 1;

function fileTitle(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

@Injectable({ providedIn: 'root' })
export class TabsService {
  readonly tabs = signal<EditorTab[]>([]);
  readonly activeId = signal<string | null>(null);

  /** Current active tab (derived). */
  readonly activeTab = computed(() => {
    const id = this.activeId();
    if (!id) return null;
    return this.tabs().find((t) => t.id === id) ?? null;
  });

  getActiveTab(): EditorTab | null {
    return this.activeTab();
  }

  openFile(path: string, kind?: EditorKind): string {
    const k = kind ?? editorKindForPath(path);
    const existing = this.tabs().find((t) => t.path === path);
    if (existing) {
      this.activeId.set(existing.id);
      return existing.id;
    }
    const id = `tab-${tabSeq++}`;
    const tab: EditorTab = {
      id,
      path,
      title: fileTitle(path),
      dirty: false,
      kind: k,
    };
    this.tabs.update((list) => [...list, tab]);
    this.activeId.set(id);
    return id;
  }

  setLokMeta(tabId: string, meta: LokOpenResult): void {
    this.tabs.update((list) =>
      list.map((t) =>
        t.id === tabId ? { ...t, docId: meta.docId, lok: meta } : t
      )
    );
  }

  closeTab(id: string): void {
    this.tabs.update((list) => list.filter((t) => t.id !== id));
    if (this.activeId() === id) {
      const remaining = this.tabs();
      this.activeId.set(remaining.length ? remaining[remaining.length - 1].id : null);
    }
  }

  selectTab(id: string): void {
    if (this.tabs().some((t) => t.id === id)) {
      this.activeId.set(id);
    }
  }

  markDirty(id: string, dirty: boolean): void {
    this.tabs.update((list) =>
      list.map((t) => (t.id === id ? { ...t, dirty } : t))
    );
  }
}
