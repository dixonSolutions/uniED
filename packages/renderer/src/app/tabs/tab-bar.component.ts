import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import type { EditorTab } from '../services/tabs.service';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [ButtonModule, TooltipModule],
  template: `
    @if (tabs.length) {
      <nav class="tab-bar" role="tablist" aria-label="Open files">
        @for (tab of tabs; track tab.id) {
          <div
            class="tab"
            [class.active]="tab.id === activeId"
            role="tab"
            [attr.aria-selected]="tab.id === activeId"
          >
            <!-- Tab label — complex slot content prevents a clean p-button swap here;
                 close button uses p-button for consistency -->
            <button
              type="button"
              class="tab-label"
              [title]="tab.path"
              (click)="select.emit(tab.id)"
            >
              <i
                class="pi"
                [class.pi-file]="tab.kind === 'code'"
                [class.pi-file-edit]="tab.kind === 'lok'"
                aria-hidden="true"
              ></i>
              <span class="tab-name">{{ tab.title }}</span>
              @if (tab.dirty) {
                <span class="dirty-dot" aria-label="Unsaved changes">•</span>
              }
            </button>
            <p-button
              icon="pi pi-times"
              [text]="true"
              [rounded]="true"
              size="small"
              [attr.aria-label]="'Close ' + tab.title"
              [pTooltip]="'Close ' + tab.title"
              tooltipPosition="bottom"
              styleClass="tab-close-btn"
              (onClick)="close.emit(tab.id)"
            />
          </div>
        }
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
      flex-shrink: 0;
    }

    .tab-bar {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      align-items: stretch;
      min-height: 2.25rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 0;
      padding: 0 0.125rem 0 0.625rem;
      border-right: 1px solid var(--surface-border);
      max-width: 16rem;
      position: relative;
    }

    .tab.active {
      background: var(--surface-ground);
    }

    .tab.active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--primary-color);
    }

    .tab-label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: transparent;
      border: 0;
      padding: 0.375rem 0.25rem;
      cursor: pointer;
      color: var(--text-color-secondary);
      font: inherit;
      font-size: 0.8125rem;
      min-width: 0;
    }

    .tab.active .tab-label {
      color: var(--text-color);
      font-weight: 600;
    }

    .tab-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 10rem;
    }

    .dirty-dot {
      color: var(--primary-color);
      font-size: 1.25rem;
      line-height: 0;
    }

    .tab-label:focus-visible {
      outline: 2px solid var(--focus-ring, var(--primary-color));
      outline-offset: -2px;
      border-radius: 3px;
    }

    /* Constrain the p-button close to a compact square */
    :host ::ng-deep .tab-close-btn.p-button {
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      flex-shrink: 0;
    }
  `,
})
export class TabBarComponent {
  @Input({ required: true }) tabs: EditorTab[] = [];
  @Input() activeId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<string>();
}
