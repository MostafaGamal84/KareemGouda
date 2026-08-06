import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const skipLoading = req.headers.has('X-Skip-Loading');
  const normalizedRequest = skipLoading
    ? req.clone({ headers: req.headers.delete('X-Skip-Loading') })
    : req;

  if (skipLoading) {
    return next(normalizedRequest);
  }

  loading.beginRequest();

  return next(normalizedRequest).pipe(
    finalize(() => loading.endRequest())
  );
};
