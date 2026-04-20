import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';

export type UiTheme = 'light' | 'dark';

/** Lara indigo — neutral surfaces, minimal chroma. */
const PRIME_THEME_PATH: Record<UiTheme, string> = {
  dark: 'primeng-themes/dark/theme.css',
  light: 'primeng-themes/light/theme.css',
};

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

  /** User toggled theme; persists to app config. */
  async setMode(next: UiTheme): Promise<void> {
    this.apply(next, true);
  }

  private apply(next: UiTheme, persist: boolean): void {
    this.mode.set(next);
    const root = document.documentElement;
    root.dataset['theme'] = next;
    root.classList.remove('dark', 'light');
    root.classList.add(next);

    const href = PRIME_THEME_PATH[next];
    let link = document.getElementById('prime-theme') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'prime-theme';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = href;

    if (persist) {
      void this.configSvc.set({ theme: next });
    }
  }
}
