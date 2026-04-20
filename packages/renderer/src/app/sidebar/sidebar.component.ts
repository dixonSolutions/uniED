import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { TooltipModule } from 'primeng/tooltip';
import { TreeModule } from 'primeng/tree';
import type { FsTreeNode } from '@unied/shared-types';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ButtonModule, ScrollPanelModule, TooltipModule, TreeModule],
  template: `
    <aside class="sidebar" aria-label="Workspace">
      <header class="sidebar-header">
        <div class="folder-meta">
          <i class="pi pi-folder" aria-hidden="true"></i>
          <span class="folder-name" [title]="rootPath ?? ''">{{ folderName() }}</span>
        </div>
        <p-button
          icon="pi pi-folder-open"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          size="small"
          ariaLabel="Open another folder"
          pTooltip="Open another folder"
          tooltipPosition="bottom"
          (onClick)="openFolder.emit()"
        />
      </header>

      @if (treeValue().length) {
        <p-scrollPanel
          [style]="{ width: '100%', flex: '1', minHeight: '0' }"
          styleClass="unied-tree-scroll"
        >
          <p-tree
            [value]="treeValue()"
            styleClass="unied-tree w-full border-none"
            (onNodeSelect)="onNodeSelect($event)"
          ></p-tree>
        </p-scrollPanel>
      } @else {
        <p class="empty">This folder is empty.</p>
      }
    </aside>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-width: 0;
      background: var(--surface-card);
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
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
    }
    .folder-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .empty {
      margin: 0;
      padding: 1rem 0.875rem;
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }
    :host ::ng-deep .unied-tree-scroll {
      border: none;
    }
    :host ::ng-deep .unied-tree-scroll .p-scrollpanel-content {
      padding: 0;
    }
    :host ::ng-deep .unied-tree {
      background: transparent;
      padding: 0.25rem 0;
    }
    :host ::ng-deep .unied-tree .p-treenode-content {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    :host ::ng-deep .unied-tree .p-treenode-label {
      font-size: 0.875rem;
    }
  `,
})
export class SidebarComponent {
  @Input() set nodes(value: FsTreeNode[]) {
    this.nodesSignal.set(value);
  }
  @Input() rootPath: string | null = null;
  @Output() openFolder = new EventEmitter<void>();
  @Output() fileClick = new EventEmitter<string>();

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
