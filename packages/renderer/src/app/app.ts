import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import type { FsTreeNode } from '@unied/shared-types';
import { SplitterModule } from 'primeng/splitter';
import { AppHeaderComponent } from './shell/app-header.component';
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
    AppHeaderComponent,
    WelcomeComponent,
    SplitterModule,
    SidebarComponent,
    TabBarComponent,
    EditorPaneComponent,
  ],
  template: `
    <div class="app-shell">
      @if (rootFolder(); as folder) {
        <app-header />
        <p-splitter
          [style]="{ flex: '1', minHeight: 0, width: '100%' }"
          [panelSizes]="[22, 78]"
          [minSizes]="[14, 40]"
          styleClass="unied-splitter flex-1"
        >
          <ng-template pTemplate>
            <div class="sidebar-wrap">
              <app-sidebar
                [rootPath]="folder"
                [nodes]="tree()"
                (openFolder)="onOpenFolder()"
                (fileClick)="onFileOpen($event)"
              />
            </div>
          </ng-template>
          <ng-template pTemplate>
            <div class="main-wrap">
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
      height: 100%;
      min-height: 0;
    }
    :host ::ng-deep .unied-splitter {
      border: none;
      background: transparent;
    }
    :host ::ng-deep .unied-splitter .p-splitter-gutter {
      background: var(--surface-border);
    }
    .sidebar-wrap {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--surface-card);
    }
    .main-wrap {
      height: 100%;
      min-height: 0;
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
  /** Last folder we know about, even if not yet re-opened. */
  readonly lastFolderHint = signal<string | null>(null);

  private unwatchFs: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.theme.initFromConfig();
    const cfg = await this.config.get();
    this.lastFolderHint.set(cfg.lastWorkspaceFolder ?? null);

    if (cfg.lastWorkspaceFolder) {
      try {
        const nodes = await this.fs.readDir(cfg.lastWorkspaceFolder);
        this.rootFolder.set(cfg.lastWorkspaceFolder);
        this.tree.set(nodes);
        await this.fs.watch(cfg.lastWorkspaceFolder);
      } catch {
        this.rootFolder.set(null);
      }
    }

    this.unwatchFs = await this.fs.onFsChanged(() => {
      void this.refreshTree();
    });
  }

  ngOnDestroy(): void {
    this.unwatchFs?.();
  }

  async onOpenFolder(): Promise<void> {
    const folder = await this.fs.openFolder();
    if (!folder) return;
    this.rootFolder.set(folder);
    this.lastFolderHint.set(folder);
    await this.config.set({ lastWorkspaceFolder: folder });
    await this.refreshTree();
    await this.fs.watch(folder);
  }

  async onReopenLast(): Promise<void> {
    const last = this.lastFolderHint();
    if (!last) return;
    try {
      const nodes = await this.fs.readDir(last);
      this.rootFolder.set(last);
      this.tree.set(nodes);
      await this.fs.watch(last);
    } catch {
      void this.onOpenFolder();
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
    } catch {
      this.tree.set([]);
    }
  }

  onFileOpen(path: string): void {
    this.tabs.openFile(path);
  }

  onTabClose(id: string): void {
    this.tabs.closeTab(id);
  }
}
