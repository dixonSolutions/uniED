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
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TreeModule } from 'primeng/tree';
import type { FsTreeNode } from '@unied/shared-types';
import { SettingsDialogComponent } from '../shell/settings-dialog.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SettingsDialogComponent,
    SkeletonModule,
    TooltipModule,
    TreeModule,
  ],
  template: `
    <div class="explorer">

      <!-- ── Folder label row ── -->
      <div class="vault-row" (mouseenter)="hovered = true" (mouseleave)="hovered = false">
        <span class="vault-name" [title]="rootPath ?? ''">{{ folderName() }}</span>
        <p-button
          icon="pi pi-folder-open"
          [text]="true"
          [rounded]="true"
          size="small"
          pTooltip="Open another folder"
          tooltipPosition="bottom"
          aria-label="Open another folder"
          [class.vault-action-hidden]="!hovered"
          (onClick)="openFolder.emit()"
        />
      </div>

      <!-- ── Search bar (only when a folder is open) ── -->
      @if (rootPath) {
        <div class="search-row">
          <p-iconfield class="search-field">
            <p-inputicon class="pi pi-search" />
            <input
              pInputText
              type="search"
              placeholder="Search files and folders…"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              class="search-input"
              aria-label="Search files and folders"
            />
          </p-iconfield>
        </div>
      }

      <!-- ── Tree area (flex: 1, scrolls internally) ── -->
      <div class="tree-wrap">
        @if (loading) {
          <div class="skeleton-list" aria-label="Loading files" aria-busy="true">
            @for (w of skeletonWidths; track $index) {
              <p-skeleton height="0.875rem" [style]="{ width: w }" />
            }
          </div>

        } @else if (searchQuery().trim()) {
          <!-- Flat search results -->
          @if (searchResults().length) {
            <div class="result-list" role="listbox" aria-label="Search results">
              @for (node of searchResults(); track node.data) {
                <div
                  class="result-item"
                  [class.result-item--dir]="!node.leaf"
                  role="option"
                  tabindex="0"
                  (click)="onSearchSelect(node)"
                  (keydown.enter)="onSearchSelect(node)"
                  (keydown.space)="$event.preventDefault(); onSearchSelect(node)"
                >
                  <i
                    class="pi result-icon"
                    [class.pi-file]="node.leaf"
                    [class.pi-folder]="!node.leaf"
                    aria-hidden="true"
                  ></i>
                  <div class="result-body">
                    <span class="result-name">{{ node.label }}</span>
                    <span class="result-path">{{ node.data }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="empty-note">No results for "{{ searchQuery() }}"</p>
          }

        } @else if (treeValue().length) {
          <!-- Full tree with built-in virtual scroll -->
          <p-tree
            [value]="treeValue()"
            styleClass="obs-tree"
            selectionMode="single"
            [(selection)]="selectedNode"
            (onNodeSelect)="onNodeSelect($event)"
            [virtualScroll]="true"
            [virtualScrollItemSize]="28"
            scrollHeight="flex"
          ></p-tree>

        } @else {
          <p class="empty-note">No files</p>
        }
      </div>

      <!-- ── Bottom ribbon: settings gear ── -->
      <div class="ribbon">
        <p-button
          icon="pi pi-cog"
          [text]="true"
          [rounded]="true"
          pTooltip="Settings"
          tooltipPosition="right"
          aria-label="Open settings"
          styleClass="ribbon-cog"
          (onClick)="settingsOpen = true"
        />
      </div>

      <!-- Settings dialog -->
      @if (settingsOpen) {
        <app-settings-dialog (close)="settingsOpen = false" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      /* Ensure the host fills 100% of the splitter panel height */
      height: 100%;
      min-height: 0;
      min-width: 0;
      background: var(--surface-card);
    }

    .explorer {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      min-width: 0;
      user-select: none;
      overflow: hidden;
    }

    /* ── Vault label row ── */
    .vault-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.75rem 0.375rem;
      flex-shrink: 0;
      min-width: 0;
    }

    .vault-name {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .vault-action-hidden {
      opacity: 0;
      pointer-events: none;
    }

    /* ── Search bar ── */
    .search-row {
      padding: 0.25rem 0.625rem 0.5rem;
      flex-shrink: 0;
    }

    .search-field {
      width: 100%;
    }

    .search-input {
      width: 100%;
      font-size: 0.8125rem;
      height: 1.875rem;
      padding-top: 0;
      padding-bottom: 0;
      background: var(--surface-ground);
      border-color: var(--surface-border);
    }

    /* ── Tree / results area ── */
    .tree-wrap {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .empty-note {
      margin: 0;
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }

    .skeleton-list {
      padding: 0.25rem 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    /* ── Search results ── */
    .result-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 0.25rem 0;
    }

    .result-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.3rem 0.875rem;
      cursor: pointer;
      border-radius: 0;
      transition: background 80ms ease;
      min-width: 0;
    }

    .result-item:hover,
    .result-item:focus-visible {
      background: var(--surface-hover);
      outline: none;
    }

    .result-icon {
      font-size: 0.8125rem;
      margin-top: 0.175rem;
      flex-shrink: 0;
      color: var(--text-color-secondary);
    }

    .result-item--dir .result-icon {
      color: var(--yellow-400, #facc15);
    }

    .result-body {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .result-name {
      font-size: 0.8125rem;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-path {
      font-size: 0.6875rem;
      color: var(--text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.75;
    }

    /* ── Bottom ribbon ── */
    .ribbon {
      display: flex;
      align-items: center;
      padding: 0.375rem 0.5rem;
      flex-shrink: 0;
      border-top: 1px solid var(--surface-border);
    }

    :host ::ng-deep .ribbon-cog.p-button {
      width: 2rem;
      height: 2rem;
      font-size: 1.0625rem;
    }

    /* ── PrimeNG Tree: Obsidian-style overrides ── */
    :host ::ng-deep .obs-tree {
      background: transparent;
      border: none;
      padding: 0 0 0.5rem;
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Virtual-scroll container must fill the tree-wrap */
    :host ::ng-deep .obs-tree .p-tree-wrapper {
      flex: 1;
      min-height: 0;
    }

    :host ::ng-deep .obs-tree .p-tree-container {
      overflow: visible;
    }

    :host ::ng-deep .obs-tree .p-treenode {
      padding: 0;
    }

    :host ::ng-deep .obs-tree .p-treenode-content {
      padding: 0.2rem 0.75rem;
      border-radius: 0;
      gap: 0.35rem;
    }

    :host ::ng-deep .obs-tree .p-treenode-content:hover {
      background: var(--surface-hover);
    }

    :host ::ng-deep .obs-tree .p-treenode-content.p-highlight {
      background: var(--surface-hover);
      color: var(--text-color);
    }

    :host ::ng-deep .obs-tree .p-treenode-label {
      font-size: 0.8125rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host ::ng-deep .obs-tree .p-tree-toggler {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
    }

    :host ::ng-deep .obs-tree .p-treenode-icon {
      font-size: 0.8125rem;
      flex-shrink: 0;
    }
  `,
})
export class SidebarComponent {
  @Input() set nodes(value: FsTreeNode[]) {
    this.nodesSignal.set(value ?? []);
  }
  @Input() rootPath: string | null = null;
  @Input() loading = false;
  @Output() openFolder = new EventEmitter<void>();
  @Output() fileClick = new EventEmitter<string>();

  hovered = false;
  settingsOpen = false;
  selectedNode: TreeNode | null = null;

  readonly searchQuery = signal('');

  readonly skeletonWidths = ['60%', '85%', '45%', '70%', '55%', '80%', '40%'];

  private readonly nodesSignal = signal<FsTreeNode[]>([]);
  readonly treeValue = computed(() => toTreeNodes(this.nodesSignal()));

  /** Flat list of all nodes whose name matches the current search query. */
  readonly searchResults = computed((): TreeNode[] => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return flatSearch(this.nodesSignal(), q);
  });

  folderName(): string {
    if (!this.rootPath) return 'Explorer';
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

  onSearchSelect(node: TreeNode): void {
    if (node.leaf && typeof node.data === 'string') {
      this.fileClick.emit(node.data);
      this.searchQuery.set('');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTreeNodes(nodes: FsTreeNode[], depth = 0): TreeNode[] {
  return nodes.map((node) => {
    const isDir = node.kind === 'directory';
    const children =
      isDir && node.children?.length ? toTreeNodes(node.children, depth + 1) : undefined;

    if (isDir) {
      return {
        label: node.name,
        data: node.path,
        leaf: false,
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        expanded: depth === 0,
        children: children ?? [],
      };
    }

    return {
      label: node.name,
      data: node.path,
      leaf: true,
      icon: 'pi pi-file',
    };
  });
}

/** Recursively collect all nodes whose name contains the query string. */
function flatSearch(nodes: FsTreeNode[], query: string): TreeNode[] {
  const results: TreeNode[] = [];

  function walk(items: FsTreeNode[]): void {
    for (const n of items) {
      if (n.name.toLowerCase().includes(query)) {
        results.push({
          label: n.name,
          data: n.path,
          leaf: n.kind === 'file',
        });
      }
      if (n.children?.length) {
        walk(n.children);
      }
    }
  }

  walk(nodes);
  return results;
}
