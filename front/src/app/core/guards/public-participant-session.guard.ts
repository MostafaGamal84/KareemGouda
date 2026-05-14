import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const SESSION_ID_KEY = 'participant_session_id';
const ACCESS_TYPE_KEY = 'participant_session_access_type';

/** Logged-in users pass. Guests only if they joined a Public session for this sessionId in this browser. */
export const publicParticipantSessionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (auth.isLoggedIn()) {
    return true;
  }

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const sessionId = Number(route.paramMap.get('sessionId') || 0);
  if (!sessionId) {
    return router.createUrlTree(['/auth/login']);
  }

  const storedSid = localStorage.getItem(SESSION_ID_KEY);
  const accessType = localStorage.getItem(ACCESS_TYPE_KEY);
  const participantId = localStorage.getItem('participant_id');

  if (storedSid === String(sessionId) && accessType === '1' && participantId) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
