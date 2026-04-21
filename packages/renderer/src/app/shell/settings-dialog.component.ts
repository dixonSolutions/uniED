import { Component, EventEmitter, OnInit, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ThemeService } from '../services/theme.service';
import { ConfigService } from '../services/config.service';

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Theme and display settings',
    icon: 'pi pi-palette',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DividerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [closable]="false"
      [showHeader]="false"
      [style]="{ width: '26rem', 'max-height': '80vh' }"
      styleClass="settings-dlg"
      (onHide)="close.emit()"
    >
      <div class="s-shell">

        <!-- ── Header ── -->
        <div class="s-header">
          @if (activeSection()) {
            <p-button
              icon="pi pi-arrow-left"
              [text]="true"
              [rounded]="true"
              size="small"
              aria-label="Back"
              (onClick)="goBack()"
            />
            <span class="s-title">{{ activeSectionMeta()?.title }}</span>
          } @else {
            <span class="s-title">Settings</span>
          }
          <p-button
            icon="pi pi-times"
            [text]="true"
            [rounded]="true"
            size="small"
            aria-label="Close settings"
            class="s-close"
            (onClick)="close.emit()"
          />
        </div>

        <!-- ── Search ── -->
        <div class="s-search-row">
          <p-iconfield class="s-search-field">
            <p-inputicon class="pi pi-search" />
            <input
              pInputText
              type="search"
              [placeholder]="activeSection() ? 'Search in ' + activeSectionMeta()?.title : 'Search…'"
              [(ngModel)]="query"
              class="s-search"
            />
          </p-iconfield>
        </div>

        <p-divider styleClass="s-divider" />

        <!-- ── Main: section list ── -->
        @if (!activeSection()) {
          <div class="s-list" role="list">
            @for (section of filteredSections(); track section.id) {
              <p-button
                [text]="true"
                styleClass="s-section-row"
                [attr.role]="'listitem'"
                (onClick)="navigate(section.id)"
              >
                <ng-template pTemplate="content">
                  <i class="{{ section.icon }} s-section-icon" aria-hidden="true"></i>
                  <div class="s-section-body">
                    <span class="s-section-title">{{ section.title }}</span>
                    <span class="s-section-desc">{{ section.description }}</span>
                  </div>
                  <i class="pi pi-chevron-right s-chevron" aria-hidden="true"></i>
                </ng-template>
              </p-button>
            }
            @if (filteredSections().length === 0) {
              <div class="s-empty-wrap">
                <p-message
                  severity="info"
                  [text]="noMatchText()"
                  styleClass="s-empty-msg"
                />
              </div>
            }
          </div>
        }

        <!-- ── Appearance section ── -->
        @if (activeSection() === 'appearance') {
          <div class="s-section-content">
            <div class="s-setting-row">
              <div class="s-setting-label">
                <span class="s-setting-title">Theme</span>
                <span class="s-setting-desc">Choose the interface colour scheme</span>
              </div>
              <p-selectbutton
                [options]="themeOptions"
                [(ngModel)]="themeValue"
                optionLabel="label"
                optionValue="value"
                (onChange)="onThemeChange($event.value)"
              />
            </div>
          </div>
        }

      </div>
    </p-dialog>
  `,
  styles: `
    /* Dialog wrapper */
    :host ::ng-deep .settings-dlg .p-dialog-content {
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      background: var(--surface-card);
    }

    .s-shell {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* ── Header ── */
    .s-header {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.875rem 1rem 0.75rem;
    }

    .s-title {
      flex: 1;
      font-size: 1.0625rem;
      font-weight: 700;
      color: var(--text-color);
    }

    .s-close {
      margin-left: auto;
    }

    /* ── Search ── */
    .s-search-row {
      padding: 0 1rem 0.75rem;
    }

    .s-search-field {
      width: 100%;
    }

    .s-search {
      width: 100%;
      font-size: 0.875rem;
      background: var(--surface-ground);
      border-color: var(--surface-border);
    }

    :host ::ng-deep .s-divider {
      margin: 0;
    }

    /* ── Section list ── */
    .s-list {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      max-height: calc(80vh - 10rem);
    }

    /* Make the p-button span full width as a nav row */
    :host ::ng-deep .s-section-row.p-button {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0.875rem 1.25rem;
      border-radius: 0;
      justify-content: flex-start;
      color: var(--text-color);
      gap: 0.875rem;
    }

    :host ::ng-deep .s-section-row .p-button-label {
      display: contents; /* let our ng-template content flow naturally */
    }

    .s-section-icon {
      font-size: 1rem;
      color: var(--text-color-secondary);
      flex-shrink: 0;
      width: 1.25rem;
      text-align: center;
    }

    .s-section-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
      text-align: left;
    }

    .s-section-title {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .s-section-desc {
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }

    .s-chevron {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      flex-shrink: 0;
    }

    .s-empty-wrap {
      padding: 1rem 1.25rem;
    }

    :host ::ng-deep .s-empty-msg {
      width: 100%;
    }

    /* ── Section content ── */
    .s-section-content {
      padding: 0.75rem 1.25rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      overflow-y: auto;
      max-height: calc(80vh - 10rem);
    }

    .s-setting-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .s-setting-label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex: 1;
      min-width: 0;
    }

    .s-setting-title {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .s-setting-desc {
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
      line-height: 1.5;
    }
  `,
})
export class SettingsDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly theme = inject(ThemeService);
  private readonly config = inject(ConfigService);

  visible = true;
  query = '';

  readonly activeSection = signal<string | null>(null);

  readonly activeSectionMeta = computed(() =>
    SECTIONS.find((s) => s.id === this.activeSection()) ?? null
  );

  readonly filteredSections = computed(() => {
    const q = this.query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  });

  readonly themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  /** Two-way bound to the SelectButton. Initialised in ngOnInit. */
  themeValue: 'light' | 'dark' = 'dark';

  ngOnInit(): void {
    this.themeValue = this.theme.mode();
  }

  noMatchText(): string {
    return `No settings match "${this.query}"`;
  }

  navigate(sectionId: string): void {
    this.query = '';
    this.activeSection.set(sectionId);
  }

  goBack(): void {
    this.query = '';
    this.activeSection.set(null);
  }

  onThemeChange(value: 'light' | 'dark'): void {
    this.theme.setMode(value);
    this.config.set({ theme: value }).catch(() => {});
  }
}
