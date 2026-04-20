import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToolbarModule } from 'primeng/toolbar';
import { ThemeService, type UiTheme } from '../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ToolbarModule, SelectButtonModule, FormsModule],
  template: `
    <p-toolbar styleClass="unied-app-header border-noround">
      <div class="p-toolbar-group-start gap-2 align-items-center">
        <span class="brand text-xl font-semibold text-color">uniED</span>
      </div>
      <div class="p-toolbar-group-end gap-2 align-items-center">
        <span class="text-sm text-color-secondary" id="theme-lbl">Theme</span>
        <p-selectButton
          ariaLabelledBy="theme-lbl"
          [options]="themeOptions"
          [ngModel]="theme.mode()"
          (ngModelChange)="onTheme($event)"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          styleClass="unied-theme-select"
        />
      </div>
    </p-toolbar>
  `,
  styles: `
    :host ::ng-deep .unied-app-header {
      border-radius: 0;
      border: none;
      border-bottom: 1px solid var(--surface-border);
      padding: 0.5rem 1rem;
      flex-shrink: 0;
      background: var(--surface-card);
    }
    .brand {
      letter-spacing: 0.03em;
    }
  `,
})
export class AppHeaderComponent {
  readonly theme = inject(ThemeService);

  readonly themeOptions: { label: string; value: UiTheme }[] = [
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
  ];

  onTheme(v: UiTheme): void {
    void this.theme.setMode(v);
  }
}
