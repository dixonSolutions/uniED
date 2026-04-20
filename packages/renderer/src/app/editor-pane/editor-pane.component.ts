import { Component, inject } from '@angular/core';
import { CodeEditorComponent } from '../editors/code/code-editor.component';
import { LokEditorComponent } from '../editors/lok/lok-editor.component';
import { TabsService } from '../services/tabs.service';

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
        <div class="empty-pane" role="status">
          <i class="pi pi-file" aria-hidden="true"></i>
          <p class="empty-text">Select a file from the sidebar to start editing.</p>
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
    .empty-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--text-color-secondary);
    }
    .empty-pane .pi {
      font-size: 1.75rem;
      opacity: 0.5;
    }
    .empty-text {
      margin: 0;
      font-size: 0.9375rem;
    }
  `,
})
export class EditorPaneComponent {
  readonly tabs = inject(TabsService);
}
