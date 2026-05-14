import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'quiz-live-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<ThemeMode>('dark');
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.theme.set(this.resolveInitialTheme());

    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const nextTheme = this.theme();
        const root = this.document.documentElement;
        root.setAttribute('data-theme', nextTheme);
        root.style.colorScheme = nextTheme;
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      });
    }
  }

  toggleTheme(): void {
    this.theme.set(this.isDark() ? 'light' : 'dark');
  }

  private resolveInitialTheme(): ThemeMode {
    if (!isPlatformBrowser(this.platformId)) {
      return 'dark';
    }

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
