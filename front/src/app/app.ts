import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { LoadingService } from './core/services/loading.service';
import { ThemeService } from './core/services/theme.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ToastComponent } from './shared/toast.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly auth = inject(AuthService);
  readonly loading = inject(LoadingService);
  readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly mobileSidebarOpen = signal(false);

  readonly currentThemeLabel = computed(() => this.theme.isDark() ? 'Light Mode' : 'Dark Mode');
  readonly themeActionLabel = computed(() => this.theme.isDark() ? 'Light' : 'Dark');
  readonly userName = computed(() => this.auth.getFullName() || 'User');
  readonly userRole = computed(() => this.auth.role() || 'User');
  readonly menuButtonLabel = computed(() => this.mobileSidebarOpen() ? 'Close menu' : 'Open menu');
  readonly menuButtonText = computed(() => this.mobileSidebarOpen() ? 'Close' : 'Menu');
  readonly showMenu = computed(() => this.auth.isLoggedIn() && this.auth.status() === 1);

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.loading.beginNavigation();
          return;
        }

        if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.loading.endNavigation();
        }
      });
  }

  toggleTheme(): void {
    this.theme.toggleTheme();
  }

  toggleSidebar(): void {
    this.mobileSidebarOpen.update((isOpen) => !isOpen);
  }

  closeSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  logout(): void {
    this.closeSidebar();
    this.auth.logout();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 1120) {
      this.closeSidebar();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileSidebarOpen()) {
      this.closeSidebar();
    }
  }
}
