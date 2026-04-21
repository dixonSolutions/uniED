import { Component, inject } from '@angular/core';
import { CodeEditorComponent } from '../editors/code/code-editor.component';
import { LokEditorComponent } from '../editors/lok/lok-editor.component';
import { TabsService } from '../services/tabs.service';

interface QuickAction {
  label: string;
  shortcut: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-editor-pane',
  standalone: true,
  imports: [CodeEditorComponent, LokEditorComponent],
  template: `
    <section class="pane">
      @if (tabs.activeTab(); as tab) {
        <div class="editor-fill">
          @switch (tab.kind) {
            @case ('code') {
              <app-code-editor [tabId]="tab.id" [filePath]="tab.path" />
            }
            @case ('lok') {
              <app-lok-editor [tabId]="tab.id" [filePath]="tab.path" />
            }
          }
        </div>
      } @else {
        <!-- New Tab screen — Obsidian-inspired -->
        <div class="new-tab" role="main" aria-label="New tab">
          <div class="new-tab-content">
            <h1 class="new-tab-title">uniED</h1>
            <p class="new-tab-subtitle">Universal document editor</p>

            <div class="quick-actions" role="list">
              @for (action of quickActions; track action.label) {
                <div class="quick-action" role="listitem">
                  <i class="pi {{ action.icon }} action-icon" aria-hidden="true"></i>
                  <div class="action-body">
                    <span class="action-label">{{ action.label }}</span>
                    <span class="action-desc">{{ action.description }}</span>
                  </div>
                  <kbd class="action-kbd">{{ action.shortcut }}</kbd>
                </div>
              }
            </div>

            <p class="new-tab-hint">Select a file in the explorer to open it</p>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }

    .pane {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .editor-fill {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* ── New Tab ── */
    .new-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      background: var(--surface-ground);
    }

    .new-tab-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      width: 100%;
      max-width: 28rem;
    }

    .new-tab-title {
      margin: 0 0 0.125rem;
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: var(--text-color);
    }

    .new-tab-subtitle {
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .quick-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      margin-bottom: 1.75rem;
    }

    .quick-action {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.625rem;
      border-radius: 6px;
      cursor: default;
      transition: background 100ms ease;
    }

    .quick-action:hover {
      background: var(--surface-hover);
    }

    .action-icon {
      font-size: 0.9375rem;
      color: var(--text-color-secondary);
      width: 1.25rem;
      text-align: center;
      flex-shrink: 0;
    }

    .action-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .action-label {
      font-size: 0.9rem;
      color: var(--text-color);
    }

    .action-desc {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .action-kbd {
      font-size: 0.6875rem;
      font-family: inherit;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--surface-border);
      background: var(--surface-card);
      color: var(--text-color-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .new-tab-hint {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
      opacity: 0.7;
    }
  `,
})
export class EditorPaneComponent {
  readonly tabs = inject(TabsService);

  readonly quickActions: QuickAction[] = [
    {
      label: 'Open file',
      shortcut: 'Click in explorer',
      icon: 'pi-file',
      description: 'Open a Markdown or LibreOffice document',
    },
    {
      label: 'Switch tab',
      shortcut: 'Click tab',
      icon: 'pi-clone',
      description: 'Multiple documents can be open at once',
    },
    {
      label: 'Close tab',
      shortcut: '× button',
      icon: 'pi-times-circle',
      description: 'Close the current document',
    },
  ];
}
