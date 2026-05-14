import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeRequests = signal(0);
  private readonly activeNavigations = signal(0);

  readonly isLoading = computed(() => this.activeRequests() > 0 || this.activeNavigations() > 0);

  beginRequest(): void {
    this.activeRequests.update((count) => count + 1);
  }

  endRequest(): void {
    this.activeRequests.update((count) => Math.max(0, count - 1));
  }

  beginNavigation(): void {
    this.activeNavigations.update((count) => count + 1);
  }

  endNavigation(): void {
    this.activeNavigations.update((count) => Math.max(0, count - 1));
  }
}
