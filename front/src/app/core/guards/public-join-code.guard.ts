import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { GameSessionService } from '../services/game-session.service';

function sessionIsPublic(session: { accessType?: unknown; AccessType?: unknown } | null | undefined): boolean {
  if (!session) {
    return false;
  }
  const raw = session.accessType ?? session.AccessType;
  if (raw === null || raw === undefined) {
    return false;
  }
  if (typeof raw === 'number') {
    return raw === 1;
  }
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return t === '1' || t === 'public';
  }
  const n = Number(raw);
  return n === 1;
}

/** Guests may open join-by-code only when the session is Public. Logged-in users always pass. */
export const publicJoinCodeGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const sessions = inject(GameSessionService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  const raw = route.paramMap.get('code')?.trim();
  if (!raw) {
    return true;
  }

  return sessions.getByCode(raw.toUpperCase()).pipe(
    map((s) => {
      if (sessionIsPublic(s)) {
        return true;
      }
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
    }),
    catchError(() => of(true))
  );
};
