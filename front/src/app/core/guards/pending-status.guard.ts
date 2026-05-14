import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Live player join / session flows stay reachable (e.g. public join links) even for accounts awaiting approval. */
function isPlayerLivePath(url: string): boolean {
  const path = (url || '').split('?')[0];
  return path.startsWith('/player/join') || path.startsWith('/player/session/');
}

export const pendingStatusGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isPlayerLivePath(state.url)) {
    return true;
  }

  if (auth.isLoggedIn() && auth.isPending()) {
    return router.createUrlTree(['/auth/pending-status']);
  }

  return true;
};
