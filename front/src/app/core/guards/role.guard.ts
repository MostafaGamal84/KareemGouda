import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login']);
  }

  const allowed = route.data['roles'] as string[];
  if (!allowed?.length) {
    return true;
  }

  const role = auth.role();
  
  if (role && allowed.includes(role)) {
    return true;
  }
  
  return router.createUrlTree(['/test-mode']);
};
