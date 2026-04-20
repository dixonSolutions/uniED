import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import type { FsTreeNode } from '@unied/shared-types';
import { WelcomeComponent } from './shell/welcome.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TabBarComponent } from './tabs/tab-bar.component';
import { EditorPaneComponent } from './editor-pane/editor-pane.component';
import { ConfigService } from './services/config.service';
import { FsService } from './services/fs.service';
import { ThemeService } from './services/theme.service';
import { TabsService } from './services/tabs.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    WelcomeComponent,
    SidebarComponent,
    TabBarComponent,
    EditorPaneComponent,
  ],
  template: `
    <div class="app-shell">
      @if (rootFolder(); as folder) {
        <div class="workspace">
          <aside class="side" [style.width.px]="sidebarWidth()">
            <app-sidebar
              [rootPath]="folder"
              [nodes]="tree()"
              [loading]="loading()"
              [treeError]="treeError()"
              (openFolder)="onOpenFolder()"
              (fileClick)="onFileOpen($event)"
            />
          </aside>
          <div
            class="resizer"
            role="separator"
            aria-orientation="vertical"
            tabindex="0"
            (mousedown)="startResize($event)"
            (keydown)="onResizerKey($event)"
          ></div>
          <main class="main">
            <app-tab-bar
              [tabs]="tabs.tabs()"
              [activeId]="tabs.activeId()"
              (select)="tabs.selectTab($event)"
              (close)="onTabClose($event)"
            />
            <app-editor-pane />
          </main>
        </div>
      } @else {
        <app-welcome
          [lastFolder]="lastFolderHint()"
          (openFolder)="onOpenFolder()"
          (reopenLast)="onReopenLast()"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      min-height: 0;
      overflow: hidden;
    }
    app-welcome {
      flex: 1;
      min-height: 0;
    }
    .workspace {
      flex: 1;
      display: grid;
      grid-template-columns: auto 6px 1fr;
      min-height: 0;
      overflow: hidden;
      background: var(--surface-ground);
    }
    .side {
      min-width: 200px;
      max-width: 480px;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: flex;
      background: var(--surface-card);
      border-right: 1px solid var(--surface-border);
    }
    .resizer {
      cursor: col-resize;
      background: transparent;
      position: relative;
    }
    .resizer:hover,
    .resizer:focus-visible {
      background: var(--primary-color);
      outline: none;
    }
    .main {
      min-width: 0;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--surface-ground);
    }
  `,
})
export class App implements OnInit, OnDestroy {
  readonly fs = inject(FsService);
  readonly config = inject(ConfigService);
  readonly theme = inject(ThemeService);
  readonly tabs = inject(TabsService);

  readonly rootFolder = signal<string | null>(null);
  readonly tree = signal<FsTreeNode[]>([]);
  readonly loading = signal<boolean>(false);
  readonly treeError = signal<string | null>(null);
  readonly lastFolderHint = signal<string | null>(null);
  readonly sidebarWidth = signal<number>(280);

  private unwatchFs: (() => void) | null = null;
  private resizeStart: { x: number; w: number } | null = null;

  async ngOnInit(): Promise<void> {
    // Never let any startup step freeze the UI — each awaited call is independent.
    try { await this.theme.initFromConfig(); } catch { /* use defaults */ }

    let lastFolder: string | undefined;
    try {
      const cfg = await this.config.get();
      lastFolder = cfg.lastWorkspaceFolder;
      this.lastFolderHint.set(lastFolder ?? null);
    } catch { /* config unreadable — start fresh */ }

    if (lastFolder) {
      this.loading.set(true);
      try {
        const nodes = await this.fs.readDir(lastFolder);
        this.tree.set(nodes);
        this.treeError.set(null);
        this.rootFolder.set(lastFolder);
        this.fs.watch(lastFolder).catch(() => { /* watcher optional */ });
      } catch {
        this.rootFolder.set(null);
        this.lastFolderHint.set(null);
      } finally {
        this.loading.set(false);
      }
    }

    // Event listener is also non-critical.
    try {
      this.unwatchFs = await this.fs.onFsChanged(() => { void this.refreshTree(); });
    } catch { /* live-reload unavailable */ }
  }

  ngOnDestroy(): void {
    this.unwatchFs?.();
  }

  async onOpenFolder(): Promise<void> {
    const folder = await this.fs.openFolder();
    if (!folder) return;

    // Show workspace immediately — don't wait for tree or watcher.
    this.rootFolder.set(folder);
    this.lastFolderHint.set(folder);
    this.config.set({ lastWorkspaceFolder: folder }).catch(() => {});

    this.loading.set(true);
    this.treeError.set(null);
    try {
      const nodes = await this.fs.readDir(folder);
      this.tree.set(nodes);
    } catch (err) {
      this.tree.set([]);
      this.treeError.set(String(err));
      console.error('[uniED] readDir failed:', err);
    } finally {
      this.loading.set(false);
    }

    this.fs.watch(folder).catch(() => {});
  }

  async onReopenLast(): Promise<void> {
    const last = this.lastFolderHint();
    if (!last) return;
    this.rootFolder.set(last);
    this.loading.set(true);
    this.treeError.set(null);
    try {
      const nodes = await this.fs.readDir(last);
      this.tree.set(nodes);
    } catch (err) {
      this.tree.set([]);
      this.treeError.set(String(err));
      console.error('[uniED] readDir failed:', err);
    } finally {
      this.loading.set(false);
    }
    this.fs.watch(last).catch(() => {});
  }

  async refreshTree(): Promise<void> {
    const root = this.rootFolder();
    if (!root) {
      this.tree.set([]);
      return;
    }
    try {
      const nodes = await this.fs.readDir(root);
      this.tree.set(nodes);
      this.treeError.set(null);
    } catch (err) {
      console.error('[uniED] refreshTree failed:', err);
    }
  }

  onFileOpen(path: string): void {
    this.tabs.openFile(path);
  }

  onTabClose(id: string): void {
    this.tabs.closeTab(id);
  }

  startResize(ev: MouseEvent): void {
    ev.preventDefault();
    this.resizeStart = { x: ev.clientX, w: this.sidebarWidth() };
    const move = (e: MouseEvent) => this.onResizeMove(e);
    const up = () => {
      this.resizeStart = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  private onResizeMove(ev: MouseEvent): void {
    if (!this.resizeStart) return;
    const next = this.resizeStart.w + (ev.clientX - this.resizeStart.x);
    this.sidebarWidth.set(Math.max(200, Math.min(560, next)));
  }

  onResizerKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      const delta = ev.key === 'ArrowLeft' ? -16 : 16;
      this.sidebarWidth.set(Math.max(200, Math.min(560, this.sidebarWidth() + delta)));
    }
  }
}
