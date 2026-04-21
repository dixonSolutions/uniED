import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';

export type UiTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly configSvc = inject(ConfigService);

  /** Active UI theme (default dark). */
  readonly mode = signal<UiTheme>('dark');

  readonly isDark = computed(() => this.mode() === 'dark');

  /** Load saved preference; defaults to dark. */
  async initFromConfig(): Promise<void> {
    const cfg = await this.configSvc.get();
    const t = cfg.theme === 'light' || cfg.theme === 'dark' ? cfg.theme : 'dark';
    this.apply(t, false);
  }

  /** User-toggled theme; persists to app config. */
  async setMode(next: UiTheme): Promise<void> {
    this.apply(next, true);
  }

  private apply(next: UiTheme, persist: boolean): void {
    this.mode.set(next);

    // PrimeNG 21 reads darkModeSelector: '.dark' from providePrimeNG config,
    // so toggling this class is all that's needed to switch the full theme.
    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    root.classList.toggle('light', next === 'light');

    if (persist) {
      void this.configSvc.set({ theme: next });
    }
  }
}
