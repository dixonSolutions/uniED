import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TreeModule } from 'primeng/tree';
import type { FsTreeNode } from '@unied/shared-types';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ButtonModule, TooltipModule, TreeModule],
  template: `
    <div class="sidebar">
      <!-- Folder header -->
      <header class="sidebar-header">
        <div class="folder-meta">
          <i class="pi pi-folder" aria-hidden="true"></i>
          <span class="folder-name" [title]="rootPath ?? ''">{{ folderName() }}</span>
        </div>
        <button
          type="button"
          class="icon-btn"
          pTooltip="Open another folder"
          tooltipPosition="right"
          aria-label="Open another folder"
          (click)="openFolder.emit()"
        >
          <i class="pi pi-folder-open" aria-hidden="true"></i>
        </button>
      </header>

      <!-- File tree -->
      <div class="tree-wrap">
        @if (loading) {
          <p class="status">Loading…</p>
        } @else if (treeError) {
          <p class="status error" [title]="treeError">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            Could not read folder.
          </p>
        } @else if (treeValue().length) {
          <p-tree
            [value]="treeValue()"
            styleClass="unied-tree"
            (onNodeSelect)="onNodeSelect($event)"
          ></p-tree>
        } @else {
          <p class="status">Empty folder.</p>
        }
      </div>

      <!-- Bottom toolbar: theme toggle + settings -->
      <footer class="sidebar-footer">
        <div class="footer-group">
          <button
            type="button"
            class="icon-btn"
            [class.active]="theme.mode() === 'light'"
            pTooltip="Light theme"
            tooltipPosition="right"
            aria-label="Switch to light theme"
            (click)="theme.setMode('light')"
          >
            <i class="pi pi-sun" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="icon-btn"
            [class.active]="theme.mode() === 'dark'"
            pTooltip="Dark theme"
            tooltipPosition="right"
            aria-label="Switch to dark theme"
            (click)="theme.setMode('dark')"
          >
            <i class="pi pi-moon" aria-hidden="true"></i>
          </button>
        </div>
        <button
          type="button"
          class="icon-btn"
          pTooltip="Settings (coming soon)"
          tooltipPosition="right"
          aria-label="Settings"
          disabled
        >
          <i class="pi pi-cog" aria-hidden="true"></i>
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      background: var(--surface-card);
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
    }

    /* ── Header ── */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.5rem 0.5rem 0.75rem;
      border-bottom: 1px solid var(--surface-border);
      flex-shrink: 0;
    }

    .folder-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .folder-meta .pi {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .folder-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── File tree ── */
    .tree-wrap {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }

    .status {
      margin: 0;
      padding: 0.875rem 1rem;
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status.error {
      color: var(--red-400, #f87171);
    }

    /* ── Footer ── */
    .sidebar-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0.5rem;
      border-top: 1px solid var(--surface-border);
      flex-shrink: 0;
    }

    .footer-group {
      display: flex;
      align-items: center;
      gap: 0.125rem;
    }

    /* ── Shared icon button ── */
    .icon-btn {
      display: inline-grid;
      place-items: center;
      width: 1.875rem;
      height: 1.875rem;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-color-secondary);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      flex-shrink: 0;
    }

    .icon-btn:hover:not(:disabled) {
      background: var(--surface-hover);
      color: var(--text-color);
    }

    .icon-btn.active {
      color: var(--primary-color);
    }

    .icon-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .icon-btn:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: -2px;
    }

    .icon-btn .pi {
      font-size: 0.9375rem;
    }

    /* ── PrimeNG tree overrides ── */
    :host ::ng-deep .unied-tree {
      background: transparent;
      border: none;
      padding: 0.25rem 0;
      width: 100%;
    }

    :host ::ng-deep .unied-tree .p-tree-container {
      overflow: visible;
      max-height: none;
    }

    :host ::ng-deep .unied-tree .p-treenode-content {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    :host ::ng-deep .unied-tree .p-treenode-label {
      font-size: 0.8125rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class SidebarComponent {
  @Input() set nodes(value: FsTreeNode[]) {
    this.nodesSignal.set(value ?? []);
  }
  @Input() rootPath: string | null = null;
  @Input() loading = false;
  @Input() treeError: string | null = null;
  @Output() openFolder = new EventEmitter<void>();
  @Output() fileClick = new EventEmitter<string>();

  readonly theme = inject(ThemeService);

  private readonly nodesSignal = signal<FsTreeNode[]>([]);
  readonly treeValue = computed(() => toTreeNodes(this.nodesSignal()));

  folderName(): string {
    if (!this.rootPath) return 'Workspace';
    return (
      this.rootPath
        .replace(/[\\/]+$/, '')
        .split(/[/\\]/)
        .filter(Boolean)
        .pop() ?? this.rootPath
    );
  }

  onNodeSelect(event: { node: TreeNode }): void {
    const n = event.node;
    if (n.leaf && typeof n.data === 'string') {
      this.fileClick.emit(n.data);
    }
  }
}

function toTreeNodes(nodes: FsTreeNode[], depth = 0): TreeNode[] {
  return nodes.map((node) => {
    const isDir = node.kind === 'directory';
    const children =
      isDir && node.children?.length ? toTreeNodes(node.children, depth + 1) : undefined;
    return {
      label: node.name,
      data: node.path,
      leaf: !isDir,
      icon: isDir ? 'pi pi-folder' : 'pi pi-file',
      expandedIcon: isDir ? 'pi pi-folder-open' : undefined,
      collapsedIcon: isDir ? 'pi pi-folder' : undefined,
      expanded: depth === 0,
      children,
    };
  });
}
