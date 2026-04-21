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
import { MessageService } from 'primeng/api';
import { SplitterModule } from 'primeng/splitter';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    WelcomeComponent,
    SidebarComponent,
    TabBarComponent,
    EditorPaneComponent,
    SplitterModule,
    ToastModule,
  ],
  template: `
    <p-toast position="bottom-right" [life]="5000" />
    <div class="app-shell">
      @if (rootFolder(); as folder) {
        <p-splitter
          styleClass="workspace-splitter"
          [panelSizes]="[22, 78]"
          [minSizes]="[14, 40]"
        >
          <ng-template pTemplate>
            <app-sidebar
              [rootPath]="folder"
              [nodes]="tree()"
              [loading]="loading()"
              (openFolder)="onOpenFolder()"
              (fileClick)="onFileOpen($event)"
            />
          </ng-template>
          <ng-template pTemplate>
            <div class="main">
              <app-tab-bar
                [tabs]="tabs.tabs()"
                [activeId]="tabs.activeId()"
                (select)="tabs.selectTab($event)"
                (close)="onTabClose($event)"
              />
              <app-editor-pane />
            </div>
          </ng-template>
        </p-splitter>
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

    /* Make the splitter fill all vertical space */
    :host ::ng-deep .workspace-splitter.p-splitter {
      flex: 1;
      min-height: 0;
      border: none;
      border-radius: 0;
      background: var(--surface-ground);
    }

    /* Sidebar panel — must be a flex column so app-sidebar can stretch to fill it */
    :host ::ng-deep .workspace-splitter .p-splitter-panel:first-child {
      min-width: 180px;
      max-width: 520px;
      background: var(--surface-card);
      border-right: 1px solid var(--surface-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      /* Explicit height ensures the sidebar's flex children can use flex: 1 */
      height: 100%;
    }

    /* app-sidebar fills the whole panel */
    :host ::ng-deep .workspace-splitter .p-splitter-panel:first-child app-sidebar {
      flex: 1;
      min-height: 0;
      height: 100%;
    }

    /* Gutter styling */
    :host ::ng-deep .workspace-splitter .p-splitter-gutter {
      background: var(--surface-border);
      width: 4px;
      transition: background 120ms ease;
    }

    :host ::ng-deep .workspace-splitter .p-splitter-gutter:hover,
    :host ::ng-deep .workspace-splitter .p-splitter-gutter-handle:focus {
      background: var(--primary-color);
    }

    /* Main editor panel */
    .main {
      flex: 1;
      min-width: 0;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--surface-ground);
    }

    :host ::ng-deep .workspace-splitter .p-splitter-panel:last-child {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
  `,
})
export class App implements OnInit, OnDestroy {
  readonly fs = inject(FsService);
  readonly config = inject(ConfigService);
  readonly theme = inject(ThemeService);
  readonly tabs = inject(TabsService);
  private readonly msg = inject(MessageService);

  readonly rootFolder = signal<string | null>(null);
  readonly tree = signal<FsTreeNode[]>([]);
  readonly loading = signal<boolean>(false);
  readonly lastFolderHint = signal<string | null>(null);

  private unwatchFs: (() => void) | null = null;

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
        this.rootFolder.set(lastFolder);
        this.fs.watch(lastFolder).catch(() => { /* watcher optional */ });
      } catch (err) {
        // Stay on welcome screen; keep the hint so "Reopen" button remains visible.
        this.rootFolder.set(null);
        this.msg.add({
          severity: 'error',
          summary: 'Could not open workspace',
          detail: `"${lastFolder.split(/[/\\]/).pop()}" could not be read. ${String(err)}`,
          life: 6000,
        });
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
    const defaultDir = this.rootFolder() ?? this.lastFolderHint() ?? undefined;
    const folder = await this.fs.openFolder(defaultDir);
    if (!folder) return;

    // Show workspace immediately — don't wait for tree or watcher.
    this.rootFolder.set(folder);
    this.lastFolderHint.set(folder);
    this.config.set({ lastWorkspaceFolder: folder }).catch(() => {});

    this.loading.set(true);
    try {
      const nodes = await this.fs.readDir(folder);
      this.tree.set(nodes);
    } catch (err) {
      this.tree.set([]);
      // Drop back to welcome screen and show a toast — don't leave a broken workspace open.
      this.rootFolder.set(null);
      console.error('[uniED] readDir failed:', err);
      this.msg.add({
        severity: 'error',
        summary: 'Could not read folder',
        detail: String(err),
        life: 6000,
      });
    } finally {
      this.loading.set(false);
    }

    if (this.rootFolder()) {
      this.fs.watch(folder).catch(() => {});
    }
  }

  async onReopenLast(): Promise<void> {
    const last = this.lastFolderHint();
    if (!last) return;
    this.rootFolder.set(last);
    this.loading.set(true);
    try {
      const nodes = await this.fs.readDir(last);
      this.tree.set(nodes);
    } catch (err) {
      this.tree.set([]);
      this.rootFolder.set(null);
      console.error('[uniED] readDir failed:', err);
      this.msg.add({
        severity: 'error',
        summary: 'Could not open workspace',
        detail: String(err),
        life: 6000,
      });
    } finally {
      this.loading.set(false);
    }
    if (this.rootFolder()) {
      this.fs.watch(last).catch(() => {});
    }
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
}
